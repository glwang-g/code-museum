#!/usr/bin/env python3
"""Prepare Kotlin/Groovy from an explicitly downloaded official ZIP and checksum.

This command never downloads, builds images, or enables a language in the UI.
"""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--language', choices=['kotlin', 'groovy'], required=True)
    parser.add_argument('--version', required=True)
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--checksum', type=Path, required=True)
    parser.add_argument('--source', required=True)
    args = parser.parse_args()
    if not re.fullmatch(r'\d+\.\d+\.\d+', args.version):
        parser.error('Expected a fixed numeric release')
    if not args.source.startswith('https://'):
        parser.error('Expected an official HTTPS release source')
    checksum = args.checksum.read_text().strip().split()[0]
    raw = args.archive.read_bytes()
    if not re.fullmatch('[a-f0-9]{64}', checksum) or hashlib.sha256(raw).hexdigest() != checksum:
        raise ValueError('Archive differs from the supplied official SHA-256')
    lang, version = args.language, args.version
    context = ROOT / 'server/runtimes' / lang
    if context.exists():
        raise ValueError('Refusing to overwrite an existing runtime context')
    # Inspect every member before retaining the archive. Build extraction uses the JDK jar tool.
    prefix = 'kotlinc' if lang == 'kotlin' else 'groovy-' + version
    licenses = {}
    with zipfile.ZipFile(args.archive) as archive:
        seen = set()
        for member in archive.infolist():
            name = PurePosixPath(member.filename)
            if name.is_absolute() or '..' in name.parts or name.parts[0] != prefix or member.filename in seen:
                raise ValueError('Unexpected or duplicate ZIP path: ' + member.filename)
            seen.add(member.filename)
            if (member.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValueError('ZIP symlinks are not accepted')
            if member.is_dir():
                continue
            if any(p.lower().startswith(('license', 'notice', 'copying')) for p in name.parts[1:]):
                flat = '__'.join(name.parts[1:])
                if not re.fullmatch(r'[A-Za-z0-9_.+-]+', flat) or flat in licenses:
                    raise ValueError('Unexpected license filename')
                licenses[flat] = archive.read(member)
    if not licenses:
        raise ValueError('No original licensing material found')
    (context / 'assets').mkdir(parents=True)
    (context / 'licenses').mkdir()
    file = lang + '-' + version + '.zip'
    shutil.copyfile(args.archive, context / 'assets' / file)
    (context / 'assets' / (file + '.sha256')).write_bytes(args.checksum.read_bytes())
    for name, contents in licenses.items():
        (context / 'licenses' / name).write_bytes(contents)
    java = next(r for r in json.loads((ROOT / 'server/runtime-images.json').read_text())['runtimes'] if r['id'] == 'java')
    base = java['image']
    compiler = 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler' if lang == 'kotlin' else 'groovy.ui.GroovyMain'
    home = '/opt/kotlinc' if lang == 'kotlin' else '/opt/groovy'
    move = '' if lang == 'kotlin' else ' && mv ' + prefix + ' groovy'
    (context / 'Dockerfile').write_text('FROM ' + base + '\nCOPY assets/ /opt/museum-assets/\nWORKDIR /opt\nRUN /opt/java/openjdk/bin/jar xf /opt/museum-assets/' + file + move + ' && rm -rf /opt/museum-assets\nENV LANG=C.UTF-8 TZ=UTC\nWORKDIR /work\nUSER 65534:65534\nCMD ["/bin/false"]\n')
    limits = ('Single Main.kt compiled to a JVM JAR, JVM target 17. 768 MiB, compiler heap 384 MiB, 30 seconds compilation / 3 seconds execution, runtime heap 256 MiB. No Gradle/Maven restore or scripting plugins.' if lang == 'kotlin' else 'Single main.groovy, fixed bundled core JAR only. 768 MiB, JVM heap 256 MiB, 3 seconds includes startup. No Grape/Ivy/Maven restore, plugins, GUI or interactive REPL.')
    (context / 'NOTICE.md').write_text('# ' + lang + ' / ' + version + '\n\nOriginal official release ZIP, verified against its separately downloaded official SHA-256. This is checksum verification, not a signature verification claim. Original archive and all bundled license/notice documents are retained.\n\nRelease: ' + args.source + '\n\nOffline preparation reuses the exact existing Temurin Java 17 base digest and its jar extraction tool. Website builds and execution tasks never download dependencies.\n\n' + limits + '\n')
    (context / 'acquisition.json').write_text(json.dumps(dict(source=args.source, verification='official-release-sha256', archive=dict(file='assets/' + file, bytes=len(raw), sha256=checksum), baseImage=base), indent=2) + '\n')
    files = [dict(file=p.relative_to(context).as_posix(), bytes=p.stat().st_size, sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in sorted(context.rglob('*')) if p.is_file()]
    runtime = dict(id=lang, executable='/opt/java/openjdk/bin/java', memoryMiB=768, versionArgs=['-Xmx256m', '-XX:ActiveProcessorCount=1', '-cp', home + '/lib/*', compiler, '-version' if lang == 'kotlin' else '--version'], versionPattern=('kotlinc-jvm ' if lang == 'kotlin' else 'Groovy Version: ') + version)
    (context / 'manifest.json').write_text(json.dumps(dict(schemaVersion=1, platform='linux/amd64', baseImage=base, sourceDateEpoch=1793923200, version=version, source=args.source, license='Apache-2.0 and bundled component licenses', runtime=runtime, files=files), indent=2) + '\n')
    print('Verified fixed context:', context)


if __name__ == '__main__':
    main()
