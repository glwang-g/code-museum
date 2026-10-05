const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { generateCatalogue } = require('./import-pldb.cjs');

const root = path.resolve(__dirname, '..');

function build(projectRoot = root) {
  // Generate and validate before touching the previous working site.
  const catalogue = generateCatalogue(projectRoot);
  const auditBytes = fs.readFileSync(path.join(projectRoot, 'data/audit/reviews.json'));
  if (crypto.createHash('sha256').update(auditBytes).digest('hex') !== catalogue.meta.reviewEvidence.sha256) {
    throw new Error('Audit reviews changed during build. Retry with stable inputs.');
  }
  const pyodideRoot = path.join(projectRoot, 'public/assets/pyodide');
  const pyodideManifest = JSON.parse(fs.readFileSync(path.join(pyodideRoot, 'manifest.json'), 'utf8'));
  if (pyodideManifest.version !== '314.0.7' || pyodideManifest.license !== 'MPL-2.0') {
    throw new Error('Unexpected Pyodide runtime version or license.');
  }
  for (const [name, expected] of Object.entries(pyodideManifest.files)) {
    if (name !== path.basename(name) || !/^[a-f0-9]{64}$/.test(expected)) throw new Error('Invalid Pyodide manifest entry.');
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(pyodideRoot, name))).digest('hex');
    if (actual !== expected) throw new Error('Pyodide runtime checksum mismatch: ' + name);
  }
  const output = path.join(projectRoot, 'dist');
  if (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink()) {
    throw new Error('Refusing to replace a symlinked dist directory.');
  }
  const stage = fs.mkdtempSync(path.join(projectRoot, '.build-'));
  const next = path.join(stage, 'next');
  const previous = path.join(stage, 'previous');
  let keepStage = false;
  try {
    fs.mkdirSync(next);
    fs.cpSync(path.join(projectRoot, 'public'), next, { recursive: true });
    fs.cpSync(path.join(projectRoot, 'src'), next, { recursive: true });
    fs.mkdirSync(path.join(next, 'data'), { recursive: true });
    fs.writeFileSync(path.join(next, 'data/catalogue.js'), 'window.MUSEUM_DATA=' + JSON.stringify(catalogue) + ';');
    fs.writeFileSync(path.join(next, 'data/audit-reviews.json'), auditBytes);
    fs.writeFileSync(path.join(next, 'data/provenance.json'), JSON.stringify({ meta: catalogue.meta, unresolved: [] }, null, 2));
    if (fs.existsSync(output)) fs.renameSync(output, previous);
    try { fs.renameSync(next, output); }
    catch (error) {
      if (fs.existsSync(previous)) {
        try { fs.renameSync(previous, output); }
        catch (restoreError) {
          keepStage = true;
          throw new Error(`Build failed and automatic restore failed. Previous site preserved at ${previous}. ${restoreError.message}`, { cause: error });
        }
      }
      throw error;
    }
    console.log(`Built dist: ${catalogue.meta.count} records, ${catalogue.meta.languages} languages, ${catalogue.meta.edgeCount} relationships.`);
  } finally {
    // This exact private staging directory is owned by this build.
    if (!keepStage) fs.rmSync(stage, { recursive: true, force: true });
  }
  return catalogue;
}

if (require.main === module) {
  try { build(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { build };
