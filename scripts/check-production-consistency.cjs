// Read-only production consistency check. It never submits code or requires an executor token.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const DEFAULT_ORIGIN = 'https://codemuseum.freexlib.com';
const COMPILE_SECONDS = { c: 10, cpp: 10, rust: 15, go: 30, java: 15 };
const LIMITS = { seconds: 3, outputBytes: 32768, concurrency: 1, network: false };

function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function readJson(file) { return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); }
function canonicalRuntime(runtime) {
  return {
    id: runtime.id,
    version: runtime.version,
    memoryMiB: runtime.memoryMiB,
    source: runtime.source,
    compileSeconds: COMPILE_SECONDS[runtime.id] || 0,
    runSeconds: 3
  };
}
function expectedRuntimes() {
  return readJson('server/runtime-images.json').runtimes.map(canonicalRuntime)
    .sort((a, b) => a.id.localeCompare(b.id));
}
function equalJson(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

async function getJson(origin, pathname) {
  const response = await fetch(new URL(pathname, origin), { signal: AbortSignal.timeout(15000) });
  const bytes = Buffer.from(await response.arrayBuffer());
  let body;
  try { body = JSON.parse(bytes.toString('utf8')); } catch { body = null; }
  return { pathname, status: response.status, ok: response.ok, bytes, body };
}

function localReport() {
  const files = ['dist/data/provenance.json', 'dist/data/relationship-status.json', 'dist/data/execution-capabilities.json'];
  const missing = files.filter(file => !fs.existsSync(path.join(root, file)));
  if (missing.length) throw new Error(`Missing build output: ${missing.join(', ')}; run npm run build first.`);
  const relationships = readJson('dist/data/relationship-status.json');
  return {
    runtimeManifest: expectedRuntimes(),
    limits: LIMITS,
    files: Object.fromEntries(files.map(file => [file.replace(/^dist\//, ''), {
      sha256: sha256(fs.readFileSync(path.join(root, file))),
      bytes: fs.statSync(path.join(root, file)).size
    }])),
    relationshipSummary: relationships.summary || null
  };
}

async function productionReport(origin = DEFAULT_ORIGIN) {
  const local = localReport();
  const endpoints = await Promise.all([
    getJson(origin, '/api/runtimes'),
    getJson(origin, '/data/provenance.json'),
    getJson(origin, '/data/relationship-status.json'),
    getJson(origin, '/data/execution-capabilities.json')
  ]);
  const [runtime, provenance, relationships, capabilities] = endpoints;
  const errors = [];
  if (!runtime.ok || !runtime.body) errors.push(`/api/runtimes returned HTTP ${runtime.status}`);
  if (!runtime.body?.available) errors.push('production executor reports available=false');
  const remoteRuntimes = (runtime.body?.runtimes || []).map(canonicalRuntime).sort((a, b) => a.id.localeCompare(b.id));
  if (!equalJson(remoteRuntimes, local.runtimeManifest)) errors.push('runtime versions, memory, source, or phase budgets differ');
  if (!equalJson(runtime.body?.limits, local.limits)) errors.push('executor limits differ');
  for (const endpoint of [provenance, relationships, capabilities]) {
    if (!endpoint.ok || !endpoint.body) errors.push(`${endpoint.pathname} returned HTTP ${endpoint.status}`);
  }
  const fileChecks = {};
  for (const endpoint of [provenance, relationships, capabilities]) {
    const key = endpoint.pathname.replace(/^\//, '');
    const localFile = local.files[key];
    fileChecks[key] = {
      httpStatus: endpoint.status,
      remoteSha256: sha256(endpoint.bytes),
      localSha256: localFile?.sha256 || null,
      matchesLocal: Boolean(localFile && sha256(endpoint.bytes) === localFile.sha256)
    };
    if (!fileChecks[key].matchesLocal) errors.push(`${endpoint.pathname} differs from the local build`);
  }
  return {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    origin,
    scope: 'Read-only HTTP metadata check; no execution, source upload, token, session, or job ID.',
    pass: errors.length === 0,
    errors,
    local: { runtimeManifest: local.runtimeManifest, limits: local.limits, relationshipSummary: local.relationshipSummary },
    remote: { available: runtime.body?.available ?? null, runtimeCount: remoteRuntimes.length, limits: runtime.body?.limits ?? null },
    fileChecks
  };
}

async function main(argv = process.argv.slice(2)) {
  const origin = process.env.PRODUCTION_ORIGIN || DEFAULT_ORIGIN;
  const json = argv.includes('--json');
  const outputIndex = argv.indexOf('--output');
  const output = outputIndex >= 0 ? argv[outputIndex + 1] : null;
  if (outputIndex >= 0 && (!output || output.startsWith('--'))) throw new Error('--output requires a path.');
  const report = await productionReport(origin);
  if (output) fs.writeFileSync(path.resolve(root, output), JSON.stringify(report, null, 2) + '\n');
  if (json) console.log(JSON.stringify(report, null, 2));
  else console.log(`${report.pass ? 'PASS' : 'FAIL'} production consistency: ${origin}\n${report.errors.map(error => `  error: ${error}`).join('\n') || '  runtime manifest and public evidence match local build; no code was executed.'}`);
  return report.pass ? 0 : 1;
}

if (require.main === module) main().then(code => { process.exitCode = code; }).catch(error => { console.error(`check-production-consistency: ${error.message}`); process.exitCode = 2; });
module.exports = { canonicalRuntime, expectedRuntimes, localReport, productionReport };
