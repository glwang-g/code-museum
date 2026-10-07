const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { generateCatalogue } = require('./import-pldb.cjs');
const { generateCredits } = require('./credits.cjs');

const root = path.resolve(__dirname, '..');

function build(projectRoot = root) {
  // Generate and validate before touching the previous working site.
  const catalogue = generateCatalogue(projectRoot);
  const {credits,linguistLicense} = generateCredits(projectRoot);
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
  const luaRoot = path.join(projectRoot, 'public/assets/lua');
  const luaManifest = JSON.parse(fs.readFileSync(path.join(luaRoot, 'manifest.json'), 'utf8'));
  if (luaManifest.package !== 'wasmoon' || luaManifest.version !== '1.16.0' || luaManifest.luaVersion !== '5.4.5' || luaManifest.license !== 'MIT' ||
      Object.keys(luaManifest.files).sort().join(',') !== 'LICENSE,glue.wasm,wasmoon.js') {
    throw new Error('Unexpected Lua runtime manifest.');
  }
  for (const [name, expected] of Object.entries(luaManifest.files)) {
    if (!/^[a-f0-9]{64}$/.test(expected) || crypto.createHash('sha256').update(fs.readFileSync(path.join(luaRoot, name))).digest('hex') !== expected) {
      throw new Error('Lua runtime checksum mismatch: ' + name);
    }
  }
  const schemeRoot = path.join(projectRoot, 'public/assets/scheme');
  const schemeManifest = JSON.parse(fs.readFileSync(path.join(schemeRoot, 'manifest.json'), 'utf8'));
  if (schemeManifest.package !== 'biwascheme' || schemeManifest.version !== '0.8.3' || schemeManifest.license !== 'MIT' ||
      Object.keys(schemeManifest.files).sort().join(',') !== 'LICENSE,biwascheme-core.mjs,biwascheme-source.mjs') {
    throw new Error('Unexpected Scheme runtime manifest.');
  }
  for (const [name, expected] of Object.entries(schemeManifest.files)) {
    if (!/^[a-f0-9]{64}$/.test(expected) || crypto.createHash('sha256').update(fs.readFileSync(path.join(schemeRoot, name))).digest('hex') !== expected) {
      throw new Error('Scheme runtime checksum mismatch: ' + name);
    }
  }
  const schemeSource = fs.readFileSync(path.join(schemeRoot, 'biwascheme-source.mjs'), 'utf8');
  const boundary = 'const current_input = new Port.CustomInput(function (callback) {';
  if (schemeSource.split(boundary).length !== 2 ||
      fs.readFileSync(path.join(schemeRoot, 'biwascheme-core.mjs'), 'utf8') !== schemeSource.split(boundary)[0] + 'export default BiwaScheme$1;\n') {
    throw new Error('Scheme Worker adaptation must match the fixed upstream interpreter core.');
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
    fs.writeFileSync(path.join(next, 'data/credits.js'), 'window.MUSEUM_CREDITS=' + JSON.stringify(credits) + ';');
    fs.writeFileSync(path.join(next, 'data/credits.json'), JSON.stringify(credits,null,2)+'\n');
    fs.mkdirSync(path.join(next,'licenses'),{recursive:true});
    fs.writeFileSync(path.join(next,'licenses/linguist-LICENSE'),linguistLicense);
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
