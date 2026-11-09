#!/usr/bin/env python3
"""Prepare reviewable node bundles. Never installs services or opens SSH connections."""
import argparse
import ast
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
CODE_FILES = ['executor.py', 'execution_gateway.py', 'execution_nodes.py', 'observability.py',
              'mcp.py', 'mcp_http.py', 'runtime-images.json', 'execution-nodes.json']
MUSEUM_FILES = ['catalogue.json', 'audit-reviews.json', 'relationship-status.json',
                'execution-capabilities.json', 'mcp-manifest.json']
UNITS = ['code-museum-worker@.service', 'code-museum-execution-gateway.service',
         'code-museum-execution-tunnel.service']
SSH_CONFIG = 'code-museum-forward.sshd.conf'

PREFLIGHT = '''#!/usr/bin/env python3
"""Read-only node preflight: validate prepared files and provisioned local image IDs."""
import argparse, hashlib, json, subprocess, sys
from pathlib import Path
root = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check-images', action='store_true')
args = parser.parse_args()
inventory = json.loads((root/'bundle-manifest.json').read_text())
for row in inventory['files']:
    file = root/row['file']
    if file.is_symlink() or not file.is_file() or file.stat().st_size != row['bytes'] or hashlib.sha256(file.read_bytes()).hexdigest() != row['sha256']:
        raise SystemExit('Prepared file mismatch: '+row['file'])
sys.path.insert(0,str(root/'code'))
from execution_nodes import load_nodes
from executor import load_runtimes, select_runtimes, DockerRunner
runtimes = load_runtimes(root/'code/runtime-images.json')
load_nodes(root/'code/execution-nodes.json', runtimes)
config = json.loads((root/'code/execution-nodes.json').read_text())
node = next(node for node in config['nodes'] if node['id'] == inventory['node'])
selected = select_runtimes(runtimes,node['languages'])
if args.check_images:
    info=json.loads(subprocess.check_output(['docker','info','--format','{{json .}}'],timeout=10))
    if info.get('CgroupVersion') != '2' or not any('seccomp' in value for value in info.get('SecurityOptions',[])):
        raise SystemExit('Docker cgroup v2 and default seccomp are required')
    for row in selected.values():
        image=json.loads(subprocess.check_output(['docker','image','inspect',row['image']],timeout=10))[0]
        if image['Id'] != row['imageId'] or image['Architecture'] != row['architecture'] or image['Os'] != 'linux':
            raise SystemExit('Pinned local image mismatch for '+row['id'])
print(json.dumps({'pass':True,'node':inventory['node'],'languages':list(selected),'localImagesChecked':args.check_images},indent=2))
'''


def read_file(path):
    if path.is_symlink() or not path.is_file():
        raise ValueError('Expected regular source file: ' + str(path))
    return path.read_bytes()


def prepare(output):
    output = output.absolute()
    if output.exists() or output.is_symlink():
        raise ValueError('Output must not exist; choose a new preparation directory')
    code = {name: read_file(ROOT / 'server' / name) for name in CODE_FILES}
    for name, content in code.items():
        if name.endswith('.py'):
            ast.parse(content, filename=name)
    sys.path.insert(0, str(ROOT / 'server'))
    from execution_nodes import load_nodes
    from executor import load_runtimes
    runtimes = load_runtimes(ROOT / 'server/runtime-images.json')
    load_nodes(ROOT / 'server/execution-nodes.json', runtimes)
    config = json.loads(code['execution-nodes.json'])
    if {node['id'] for node in config['nodes']} != {'xshow', 'xshow2'}:
        raise ValueError('This reviewed deployment plan expects xshow and xshow2')
    expected_urls = {'xshow': 'http://127.0.0.1:4184', 'xshow2': 'http://127.0.0.1:4183'}
    for node in config['nodes']:
        if node['url'] != expected_urls[node['id']]:
            raise ValueError('Node URL differs from reviewed systemd/tunnel port mapping')
    museum = {name: read_file(ROOT / 'dist/data' / name) for name in MUSEUM_FILES}
    units = {name: read_file(ROOT / 'server/deploy' / name) for name in UNITS}
    ssh_config = read_file(ROOT / 'server/deploy' / SSH_CONFIG)
    plan = {
        'schemaVersion': 1,
        'scope': 'Prepared files only. No production installation, service restart, network connection, image download or credential generation.',
        'codeDirectory': '/opt/code-museum-executor-dual',
        'legacyCodeDirectoryPreserved': '/opt/code-museum-executor',
        'publicEntry': 'https://codemuseum.freexlib.com/api/',
        'gatewayPort': 4181,
        'nodes': [],
        'activationOrder': ['Verify both node bundles and local pinned images',
                            'Install reviewed root-owned bundles, accounts and private environment files',
                            'Start xshow worker on 4184 and xshow2 worker on loopback 4181',
                            'Verify restricted SSH tunnel and private worker health',
                            'Test gateway on a temporary port using all nodes',
                            'Stop legacy executor and start gateway on 4181',
                            'Verify formal HTTPS execution and partial-node outage/recovery',
                            'Enable reviewed new services and disable the preserved legacy unit only after acceptance; avoid reboot port conflicts'],
        'rollback': ['Stop code-museum-execution-gateway.service on xshow',
                     'Start preserved code-museum-executor.service on xshow port 4181',
                     'Restore legacy enable state and disable the new gateway if activation previously changed boot state',
                     'Verify original 19 remote runtime IDs and private-token execution',
                     'Stop new workers and tunnel after active jobs have drained; keep legacy state and all images'],
        'credentials': 'Not included. Preserve existing public token; generate distinct worker tokens and dedicated tunnel key during explicitly authorized installation.',
        'notes': ['Each worker accepts only its configured language subset and keeps concurrency 1.',
                  'No arbitrary runtime SDK or Docker layer is included in these bundles.',
                  'xshow worker reuses the original /var/lib/code-museum-executor/metrics.sqlite so aggregate history remains visible; xshow2 uses an independent worker-xshow2-metrics.sqlite. Never copy the legacy database into both nodes.',
                  'BCPL remains subject to the retained author private/academic terms; a private token does not grant commercial redistribution rights.']
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix='.museum-dual-prepare-', dir=output.parent))
    try:
        for node in config['nodes']:
            directory = staging / node['id']
            (directory / 'code/museum-data').mkdir(parents=True)
            (directory / 'units').mkdir()
            for name, content in code.items():
                (directory / 'code' / name).write_bytes(content)
            for name, content in museum.items():
                (directory / 'code/museum-data' / name).write_bytes(content)
            names = UNITS if node['id'] == 'xshow' else [UNITS[0]]
            for name in names:
                (directory / 'units' / name).write_bytes(units[name])
            (directory / 'preflight.py').write_text(PREFLIGHT)
            worker_port = 4184 if node['id'] == 'xshow' else 4181
            metrics_db = '/var/lib/code-museum-executor/' + ('metrics.sqlite' if node['id'] == 'xshow' else 'worker-xshow2-metrics.sqlite')
            (directory / ('worker-' + node['id'] + '.env.example')).write_text(
                'EXECUTOR_TOKEN=REPLACE_ME\n'
                'EXECUTOR_ORIGIN=https://codemuseum.freexlib.com\n'
                'EXECUTOR_WORKER_PORT=' + str(worker_port) + '\n'
                'EXECUTOR_METRICS_DB=' + metrics_db + '\n')
            if node['id'] == 'xshow':
                (directory / 'gateway.env.example').write_text(
                    'EXECUTOR_TOKEN=PRESERVE_EXISTING_TOKEN\n'
                    'EXECUTOR_NODE_XSHOW_TOKEN=SET_XSHOW_WORKER_TOKEN\n'
                    'EXECUTOR_NODE_XSHOW2_TOKEN=SET_XSHOW2_WORKER_TOKEN\n')
                (directory / 'tunnel.env.example').write_text('EXECUTOR_TUNNEL_TARGET=code-museum-forward@REPLACE_WITH_XSHOW2_HOST\n')
            else:
                (directory / 'ssh').mkdir()
                (directory / 'ssh' / SSH_CONFIG).write_bytes(ssh_config)
            rows = []
            for file in sorted(directory.rglob('*')):
                if file.is_file():
                    data = file.read_bytes()
                    rows.append({'file': file.relative_to(directory).as_posix(), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
                    file.chmod(0o644)
            inventory = {'schemaVersion': 1, 'node': node['id'], 'files': rows}
            (directory / 'bundle-manifest.json').write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + '\n')
            plan['nodes'].append({'id': node['id'], 'gatewayUrl': node['url'], 'workerPort': worker_port,
                                  'metricsDatabase': metrics_db,
                                  'languageCount': len(node['languages']), 'languages': node['languages'],
                                  'bundleManifestSha256': hashlib.sha256((directory/'bundle-manifest.json').read_bytes()).hexdigest(),
                                  'bundleBytes': sum(row['bytes'] for row in rows), 'units': names})
        (staging / 'plan.json').write_text(json.dumps(plan, ensure_ascii=False, indent=2) + '\n')
        staging.rename(output)
    finally:
        if staging.exists():
            shutil.rmtree(staging)
    return plan


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path, help='New local directory for reviewable node bundles')
    args = parser.parse_args()
    try:
        plan = prepare(args.output)
    except (OSError, ValueError, ImportError) as error:
        parser.exit(1, str(error) + '\n')
    print(json.dumps({'prepared': str(args.output.absolute()), 'nodes': [
        {'id': row['id'], 'languageCount': row['languageCount'], 'bundleBytes': row['bundleBytes']}
        for row in plan['nodes']], 'productionChanged': False}, indent=2))
