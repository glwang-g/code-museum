// Offline release diagnostics, with an optional read-only remote provenance check.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function jsonFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function distManifest(directory) {
  const files = [];
  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) visit(file);
      else files.push([path.relative(directory, file).split(path.sep).join('/'), sha256(fs.readFileSync(file))]);
    }
  }
  visit(directory);
  return files;
}

function gitValue(args, fallback = null) {
  try {
    return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim() || fallback;
  } catch {
    return fallback;
  }
}

function localDiagnostics() {
  const dist = path.join(root, 'dist');
  const provenancePath = path.join(dist, 'data/provenance.json');
  const rawPath = path.join(root, 'data/raw/pldb.json');
  const reviewPath = path.join(root, 'data/audit/reviews.json');
  const errors = [];
  if (!fs.existsSync(dist)) errors.push('dist/ is missing; run npm run build first.');
  if (!fs.existsSync(provenancePath)) errors.push('dist/data/provenance.json is missing; run npm run build first.');
  if (errors.length) return { errors, warnings: [], local: { branch: gitValue(['branch', '--show-current']), commit: gitValue(['rev-parse', 'HEAD']) } };

  const provenance = jsonFile(provenancePath);
  const meta = provenance.meta || {};
  const rawSha = sha256(fs.readFileSync(rawPath));
  const reviewSha = sha256(fs.readFileSync(reviewPath));
  const manifest = distManifest(dist);
  const manifestSha = sha256(manifest.map(([file, hash]) => `${file}\0${hash}\n`).join(''));
  if (meta.sha256 !== rawSha) errors.push(`PLDB snapshot mismatch: provenance=${meta.sha256}, source=${rawSha}.`);
  if (meta.reviewEvidence?.sha256 !== reviewSha) errors.push(`Review evidence mismatch: provenance=${meta.reviewEvidence?.sha256}, source=${reviewSha}.`);
  if (meta.unresolved?.length) errors.push(`Build provenance contains ${meta.unresolved.length} unresolved item(s).`);
  return {
    errors,
    warnings: [],
    local: {
      branch: gitValue(['branch', '--show-current']),
      commit: gitValue(['rev-parse', 'HEAD']),
      commitDate: gitValue(['show', '-s', '--format=%cI', 'HEAD']),
      manifestSha,
      distFileCount: manifest.length,
      provenance: meta
    }
  };
}

async function remoteDiagnostics(url, local) {
  const endpoint = new URL('/data/provenance.json', url).toString();
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Remote provenance returned HTTP ${response.status}.`);
  const remote = await response.json();
  const expected = local.provenance || {};
  const fields = ['sha256', 'count', 'languages', 'mapLanguageCount', 'edgeCount', 'ecosystemEdgeCount'];
  const mismatches = fields.filter(field => remote.meta?.[field] !== expected[field]);
  return { url: endpoint, status: response.status, mismatches, provenance: remote.meta || {} };
}

async function main(argv = process.argv.slice(2)) {
  const json = argv.includes('--json');
  const urlIndex = argv.indexOf('--url');
  const url = urlIndex >= 0 ? argv[urlIndex + 1] : null;
  if (urlIndex >= 0 && (!url || url.startsWith('--'))) throw new Error('--url requires an HTTP(S) URL.');
  if (url && !/^https?:\/\//.test(url)) throw new Error('--url must use http:// or https://.');
  const report = localDiagnostics();
  if (!report.errors.length && url) {
    try {
      report.remote = await remoteDiagnostics(url, report.local);
      if (report.remote.mismatches.length) report.errors.push(`Remote provenance differs in: ${report.remote.mismatches.join(', ')}.`);
    } catch (error) {
      report.errors.push(`Remote check failed: ${error.message}`);
    }
  }
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    const state = report.errors.length ? 'FAIL' : 'PASS';
    console.log(`${state} release diagnostics`);
    if (report.local?.branch) console.log(`  local: ${report.local.branch} ${report.local.commit || '(no commit)'}`);
    if (report.local?.manifestSha) console.log(`  dist: ${report.local.distFileCount} files, manifest ${report.local.manifestSha}`);
    for (const warning of report.warnings) console.log(`  warning: ${warning}`);
    for (const error of report.errors) console.log(`  error: ${error}`);
    if (report.remote) console.log(`  remote: ${report.remote.url} HTTP ${report.remote.status}`);
  }
  return report.errors.length ? 1 : 0;
}

if (require.main === module) main().then(code => { process.exitCode = code; }).catch(error => { console.error(`diagnose-release: ${error.message}`); process.exitCode = 2; });
module.exports = { distManifest, localDiagnostics, remoteDiagnostics };
