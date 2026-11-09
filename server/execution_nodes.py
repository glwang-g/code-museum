"""Static, complete language placement. Endpoints are local workers or SSH forwards."""
import json
import re
from pathlib import Path
from urllib.parse import urlsplit


def load_nodes(filename, runtimes, require_all=True):
    data = json.loads(Path(filename).read_text(encoding='utf-8'))
    if not isinstance(data, dict) or set(data) != {'schemaVersion', 'nodes'} or type(data['schemaVersion']) is not int or data['schemaVersion'] != 1:
        raise ValueError('Invalid execution node configuration')
    if not isinstance(data['nodes'], list) or not 1 <= len(data['nodes']) <= 8:
        raise ValueError('Expected one to eight execution nodes')
    nodes, placed, endpoints, token_names = {}, set(), set(), set()
    for row in data['nodes']:
        if not isinstance(row, dict) or set(row) != {'id', 'url', 'tokenEnv', 'languages'}:
            raise ValueError('Invalid execution node fields')
        ident, url, env, languages = (row[k] for k in ('id', 'url', 'tokenEnv', 'languages'))
        if not isinstance(ident, str) or not re.fullmatch('[a-z][a-z0-9-]{0,23}', ident) or ident in nodes:
            raise ValueError('Invalid or duplicate node ID')
        if not isinstance(url, str): raise ValueError('Expected loopback worker URL')
        parsed = urlsplit(url)
        try: port = parsed.port
        except ValueError: raise ValueError('Invalid worker port') from None
        if (parsed.scheme != 'http' or parsed.hostname not in {'127.0.0.1', '::1'} or
                not port or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment or
                url != ('http://[' + parsed.hostname + ']:' + str(port) if ':' in parsed.hostname else 'http://' + parsed.hostname + ':' + str(port)) or url in endpoints):
            raise ValueError('Expected unique literal loopback HTTP worker URL without path or credentials')
        if not isinstance(env, str) or not re.fullmatch('EXECUTOR_NODE_[A-Z0-9_]+_TOKEN', env) or env in token_names:
            raise ValueError('Expected unique node token environment name')
        if (not isinstance(languages, list) or not languages or any(not isinstance(x, str) or x not in runtimes for x in languages) or
                len(set(languages)) != len(languages) or placed.intersection(languages)):
            raise ValueError('Expected unique configured language placement')
        nodes[ident] = dict(row)
        placed.update(languages); endpoints.add(url); token_names.add(env)
    if require_all and placed != set(runtimes): raise ValueError('Execution nodes must cover every configured runtime exactly once')
    return nodes
