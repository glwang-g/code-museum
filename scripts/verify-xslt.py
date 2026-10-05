"""Execute original XSLT 1.0 samples with an already installed xsltproc.

No downloads, installation or webpage execution. Uses --nonet and plain input
without external entities. This is sample evidence, not conformance testing.
"""
import datetime
import hashlib
import json
from pathlib import Path
import platform
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
INPUT = '<museum>' + ''.join(f'<n>{n}</n>' for n in range(10, 0, -1)) + '</museum>\n'
PREFIX = '<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"><xsl:output method="text"/><xsl:template match="/">'
SUFFIX = '</xsl:template></xsl:stylesheet>\n'
SAMPLES = [
    ('sum', PREFIX + '<xsl:value-of select="sum(museum/n)"/>' + SUFFIX, '55'),
    ('sort-condition', PREFIX + '<xsl:for-each select="museum/n"><xsl:sort data-type="number"/><xsl:if test=". &gt; 7"><xsl:value-of select="."/><xsl:text>,</xsl:text></xsl:if></xsl:for-each>' + SUFFIX, '8,9,10,'),
]
INVALID = PREFIX + '<xsl:value-of select="1 +"/>' + SUFFIX


def digest(text):
    return hashlib.sha256(text.encode()).hexdigest()


def main():
    executable = shutil.which('xsltproc')
    if not executable:
        raise SystemExit('xsltproc is not installed; no evidence file replaced.')
    version = subprocess.run([executable, '--version'], capture_output=True, text=True, timeout=10)
    if version.returncode:
        raise SystemExit('xsltproc version query failed; no evidence file replaced.')
    samples = []
    with tempfile.TemporaryDirectory(prefix='code-museum-xslt-') as tmp:
        work = Path(tmp)
        (work/'input.xml').write_text(INPUT)
        def run(name, source):
            (work/(name+'.xsl')).write_text(source)
            result = subprocess.run([executable, '--nonet', name+'.xsl', 'input.xml'], cwd=work, capture_output=True, text=True, timeout=10)
            return {'commandTemplate': ['xsltproc', '--nonet', name+'.xsl', 'input.xml'], 'exitCode': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr}
        for name, source, expected in SAMPLES:
            command = run(name, source)
            if command['exitCode'] or command['stdout'] != expected:
                raise SystemExit(f'{name} failed; no evidence file replaced.')
            samples.append({'name': name, 'sample': source, 'sampleSha256': digest(source), 'expectedStdout': expected, 'status': 'sample-passed', 'command': command})
        invalid = run('invalid-expression', INVALID)
        if invalid['exitCode'] == 0:
            raise SystemExit('Invalid XPath expression was accepted; no evidence file replaced.')
    report = {'id': 'xslt', 'status': 'sample-passed', 'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'platform': platform.platform(), 'executable': executable, 'version': (version.stdout+version.stderr).strip(),
              'scope': 'Two original XSLT 1.0 samples and one invalid XPath expression, local xsltproc only; no complete compliance or webpage runtime claim.',
              'input': INPUT, 'inputSha256': digest(INPUT), 'samples': samples,
              'invalidSyntax': {'sample': INVALID, 'sampleSha256': digest(INVALID), **invalid}}
    (ROOT/'data/audit/xslt-runtime-checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print('XSLT: sum=55; sorted conditional output=8,9,10,; invalid expression rejected.')


if __name__ == '__main__':
    main()
