#!/usr/bin/env python3
"""Explicit online acquisition; fixed outputs support later offline image builds.

Downloads official Debian indices locally, verifies them with Debian APT in a
throwaway container, and downloads only the solved packages with SHA-256 checks.
Never invoked by site builds or user execution tasks; does not install on host.
"""
import argparse
import concurrent.futures
import hashlib
import io
import json
from pathlib import Path
import re
import secrets
import shlex
import subprocess
import tarfile
import tempfile
import shutil
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
BASE = 'gcc@sha256:5e927c284bf55a7dc796262e311a0703344f62f41f5621eb56843111b1d37e15'
REPOS = [('debian','bookworm'),('debian','bookworm-updates'),('debian-security','bookworm-security')]


def download(url, target, mirror_root=None):
    # A new curl process resumes an incomplete owned temporary file. Package
    # bytes are still checked against the signed-index digest before retention.
    last = None
    for attempt in range(3):
        retrieval_url = mirror_root + url.removeprefix('https://deb.debian.org') if mirror_root else url
        last = subprocess.run(['curl','-fLsS','-C','-','--connect-timeout','15','--max-time','0','--speed-time','60','--speed-limit','1024',retrieval_url,'-o',str(target)])
        if last.returncode == 0:
            return
        if last.returncode == 33 and target.exists():
            target.unlink()  # This mirror does not support resume; retry fresh.
    last.check_returncode()


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--ssh-host',required=True); p.add_argument('--directory',required=True)
    p.add_argument('--index-cache',type=Path,help='Reuse a fixed signed index snapshot; APT still verifies signatures, hashes and expiry')
    p.add_argument('--refresh-index-cache',action='store_true')
    p.add_argument('--package-cache',type=Path,help='Retain owned partial package downloads for resume; full signed SHA-256 is always required')
    p.add_argument('--mirror-root',help='Optional HTTPS mirror host; canonical repository URLs and signed-index SHA-256 remain authoritative')
    p.add_argument('packages',nargs='+'); a=p.parse_args()
    if a.mirror_root and not re.fullmatch(r'https://[A-Za-z0-9.-]+',a.mirror_root): p.error('Expected an HTTPS mirror host without path or credentials')
    if not all(re.fullmatch('[a-zA-Z0-9][a-zA-Z0-9_.+-]*',x) for x in [a.ssh_host,a.directory,*a.packages]):
        p.error('Invalid host, directory or package name')
    dest=ROOT/'server/runtimes'/a.directory
    if (dest/'assets').exists(): p.error('Refusing to overwrite an existing acquisition')
    name='cm-prepare-'+secrets.token_hex(8)
    def remote(cmd, **kwargs):
        return subprocess.run(['ssh','-T','-o','BatchMode=yes','-o','ConnectTimeout=10',a.ssh_host,shlex.join(cmd)],**kwargs)
    def execute(cmd, **kwargs): return remote(['docker','exec','-i',name,*cmd],**kwargs)
    with tempfile.TemporaryDirectory(prefix='museum-debian-acquire-') as tmp:
        work=Path(tmp);jobs=[]
        for repo,suite in REPOS:
            for file in ['InRelease','main/binary-amd64/Packages.xz']:
                rel=repo+'/dists/'+suite+'/'+file; target=work/rel;target.parent.mkdir(parents=True,exist_ok=True)
                jobs.append(('https://deb.debian.org/'+rel,target))
        def fetch_index(job):
            url,target=job
            cached=a.index_cache/target.relative_to(work) if a.index_cache else None
            if cached and cached.is_file() and not a.refresh_index_cache:
                shutil.copyfile(cached,target)
            else:
                download(url,target,a.mirror_root)
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            list(pool.map(fetch_index,jobs))
        archive=io.BytesIO()
        with tarfile.open(fileobj=archive,mode='w',format=tarfile.USTAR_FORMAT) as tar:
            for _,f in jobs:
                raw=f.read_bytes();entry=tarfile.TarInfo(f.relative_to(work).as_posix());entry.size=len(raw);entry.mode=0o644;tar.addfile(entry,io.BytesIO(raw))
        try:
            remote(['docker','run','--detach','--rm','--pull=never','--network=none','--name',name,'--entrypoint=/bin/sleep',BASE,'1800'],check=True,stdout=subprocess.DEVNULL)
            execute(['/bin/sh','-c','mkdir -p /opt/museum-repo && tar -xf - -C /opt/museum-repo'],input=archive.getvalue(),check=True)
            sources='\n'.join('deb [signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] file:/opt/museum-repo/'+repo+' '+suite+' main' for repo,suite in REPOS)+'\n'
            execute(['/bin/sh','-c','rm -f /etc/apt/sources.list.d/*; cat > /etc/apt/sources.list'],input=sources.encode(),check=True)
            verified=execute(['apt-get','update'],check=True,capture_output=True)
            if a.index_cache:
                for _,file in jobs:
                    cached=a.index_cache/file.relative_to(work)
                    cached.parent.mkdir(parents=True,exist_ok=True)
                    shutil.copyfile(file,cached)
            print('Debian signed indices verified in network-disabled preparation container',flush=True)
            plan=execute(['apt-get','--print-uris','--yes','--download-only','--no-install-recommends','install',*a.packages],check=True,capture_output=True).stdout.decode()
            wanted=[]
            for line in plan.splitlines():
                match=re.match(r"'file:/opt/museum-repo/([^']+)' (\S+) (\d+) .*",line)
                if match:wanted.append((unquote(match[1]),Path(unquote(match[1])).name,int(match[3])))
            if not wanted:raise ValueError('No runtime packages in APT solution: '+plan)
            metadata=execute(['apt-cache','show',*[x.split('_')[0] for _,x,_ in wanted]],check=True,capture_output=True).stdout.decode()
            package_rows=[]
            for rel,file,size in wanted:
                blocks=[b for b in metadata.split('\n\n') if re.search(r'^Filename: .*/'+re.escape(file)+r'$',b,re.M)]
                hashes={m[1] for b in blocks if (m:=re.search(r'^SHA256: ([a-f0-9]{64})$',b,re.M))}
                if len(hashes)!=1:raise ValueError('Missing or ambiguous package metadata: '+file+' ('+str(len(blocks))+' blocks)')
                sha=re.search(r'^SHA256: ([a-f0-9]{64})$',blocks[0],re.M)
                if not sha:raise ValueError('No signed-index hash: '+file)
                package_rows.append(dict(file='assets/'+file,sha256=sha[1],bytes=size,source='https://deb.debian.org/'+rel,metadata=blocks[0]+'\n'))
            def fetch_package(row):
                target=work/Path(row['file']).name
                cached=a.package_cache/(row['sha256']+'.partial') if a.package_cache else None
                if cached and cached.is_file():
                    if cached.stat().st_size<=row['bytes']:
                        shutil.copyfile(cached,target)
                if target.exists() and target.stat().st_size==row['bytes']:
                    if hashlib.sha256(target.read_bytes()).hexdigest()==row['sha256']:
                        return
                    target.unlink()
                try:
                    download(row['source'],target,a.mirror_root)
                finally:
                    if cached and target.exists():
                        cached.parent.mkdir(parents=True,exist_ok=True)
                        staging=cached.with_suffix('.next')
                        shutil.copyfile(target,staging);staging.replace(cached)
            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
                list(pool.map(fetch_package,package_rows))
            for row in package_rows:
                raw=(work/Path(row['file']).name).read_bytes()
                if len(raw)!=row['bytes'] or hashlib.sha256(raw).hexdigest()!=row['sha256']:raise ValueError('Package checksum mismatch: '+row['file'])
            # Mutate repository only after every package has been obtained and verified.
            for row in package_rows:
                target=dest/row['file'];target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((work/target.name).read_bytes())
                target=dest/'metadata'/(target.name+'.metadata');target.parent.mkdir(parents=True,exist_ok=True);target.write_text(row.pop('metadata'))
                row['metadata']=target.relative_to(dest).as_posix()
            (dest/'metadata/apt-verification.txt').write_bytes(verified.stdout+verified.stderr)
            for repo,suite in REPOS:
                (dest/'metadata'/(suite+'-InRelease')).write_bytes((work/repo/'dists'/suite/'InRelease').read_bytes())
            (dest/'acquisition.json').write_text(json.dumps(dict(baseImage=BASE,requestedPackages=a.packages,preferredMirrorRoot=a.mirror_root,verification='Debian APT verified InRelease and index hashes without network; each acquired package matches the solved signed-index SHA-256. Canonical source URLs retained; cached or mirror bytes require the same full verification.',indexInputs=[dict(source=url,sha256=hashlib.sha256(f.read_bytes()).hexdigest()) for url,f in jobs],packages=package_rows),indent=2)+'\n')
            print('Acquired',len(package_rows),'verified packages into',dest,flush=True)
        finally:
            remote(['docker','rm','--force',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)


if __name__=='__main__':main()
