const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const root = path.resolve(__dirname, '../public/assets/pyodide');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const names = ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'];
const files = names.map(name => {
  const body = fs.readFileSync(path.join(root, name));
  if (crypto.createHash('sha256').update(body).digest('hex') !== manifest.files[name]) throw new Error('Runtime checksum mismatch: ' + name);
  const alreadyCompressed = name.endsWith('.zip');
  return {
    name, rawBytes: body.length,
    brotliBytes: alreadyCompressed ? body.length : zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }).length,
    gzipBytes: alreadyCompressed ? body.length : zlib.gzipSync(body).length
  };
});
const totals = Object.fromEntries(['rawBytes', 'brotliBytes', 'gzipBytes'].map(key => [key, files.reduce((sum, file) => sum + file[key], 0)]));
console.log(JSON.stringify({ version: manifest.version, nodeVersion: process.version, scope: 'Five core runtime files; ZIP is transferred unchanged. Sizes exclude HTTP headers and cache hits. Production encoding depends on hosting configuration.', files, totals }, null, 2));
