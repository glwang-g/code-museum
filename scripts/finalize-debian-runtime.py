#!/usr/bin/env python3
"""Finish a fixed runtime context after explicit Debian package acquisition.

Does not download, build images, or add executable frontend/backend support.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import tarfile

ROOT=Path(__file__).resolve().parents[1]


def main():
    p=argparse.ArgumentParser(description=__doc__)
    for field in ['directory','id','version','executable','version-pattern','source','license','limits-file']:
        p.add_argument('--'+field,required=True)
    p.add_argument('--memory',type=int,default=512)
    a=p.parse_args()
    if not re.fullmatch('[a-z][a-z0-9-]*',a.directory) or not re.fullmatch('[a-z][a-z0-9.-]*',a.id):p.error('Invalid runtime identity')
    context=ROOT/'server/runtimes'/a.directory
    acquisition=json.loads((context/'acquisition.json').read_text())
    for row in acquisition['packages']:
        file=context/row['file']
        if hashlib.sha256(file.read_bytes()).hexdigest()!=row['sha256']:raise ValueError('Changed acquired input')
    (context/'licenses').mkdir(exist_ok=True)
    for deb in sorted((context/'assets').glob('*.deb')):
        names=subprocess.check_output(['ar','t',str(deb)],text=True).splitlines()
        name=next(n for n in names if n.startswith('data.tar'))
        raw=subprocess.check_output(['ar','p',str(deb),name])
        with tarfile.open(fileobj=io.BytesIO(raw),mode='r:*') as tar:
            for member in tar.getmembers():
                if member.name.endswith('/copyright') and member.isfile():
                    package=Path(member.name).parent.name
                    (context/'licenses'/(package+'.copyright')).write_bytes(tar.extractfile(member).read())
    base=acquisition['baseImage']
    (context/'Dockerfile').write_text('FROM '+base+'\nCOPY assets/ /opt/museum-assets/\nRUN dpkg -i /opt/museum-assets/*.deb && rm -rf /opt/museum-assets\nENV LANG=C.UTF-8 TZ=UTC\nWORKDIR /work\nUSER 65534:65534\nCMD ["/bin/false"]\n')
    (context/'NOTICE.md').write_text('# '+a.id+' / '+a.version+'\n\nFixed Debian packages acquired from official signed repositories. InRelease signatures and package-index hashes were verified by Debian APT in a disposable network-disabled container. Every package matches the signed-index SHA-256; exact versions, URLs and hashes are in acquisition.json. Original package metadata and signature verification logs are in metadata/, and original copyright texts are in licenses/. Debian source package names and upstream links are in those records.\n\nThe offline build uses only saved packages and the fixed base image. Site builds and execution tasks never download dependencies. This is a modern named implementation, not a historical-machine reproduction.\n\n'+Path(a.limits_file).read_text().strip()+'\n')
    files=[dict(file=x.relative_to(context).as_posix(),bytes=x.stat().st_size,sha256=hashlib.sha256(x.read_bytes()).hexdigest()) for x in sorted(context.rglob('*')) if x.is_file() and x.name!='manifest.json']
    manifest=dict(schemaVersion=1,platform='linux/amd64',baseImage=base,sourceDateEpoch=1793923200,version=a.version,source=a.source,license=a.license,runtime=dict(id=a.id,executable=a.executable,memoryMiB=a.memory,versionArgs=['--version'],versionPattern=a.version_pattern),files=files)
    (context/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print('Fixed context:',context)


if __name__=='__main__':main()
