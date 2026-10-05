const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { Writable } = require('node:stream');
const { createRequestHandler } = require('../scripts/serve.cjs');

function request(handler, url, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const res = new Writable({ write(chunk, encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
    res.writeHead = (status, responseHeaders = {}) => { res.status = status; res.headers = responseHeaders; return res; };
    res.on('error', reject);
    res.on('finish', () => resolve({ status: res.status, headers: res.headers, body: Buffer.concat(chunks) }));
    handler({ url, method, headers }, res);
  });
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'code-museum-preview-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'assets/pyodide'), { recursive: true });
  fs.writeFileSync(path.join(root, 'index.html'), '<p>Museum</p>');
  const updateRuntime = body => {
    const hash = crypto.createHash('sha256').update(body).digest('hex');
    fs.writeFileSync(path.join(root, 'assets/pyodide/runtime.wasm'), body);
    fs.writeFileSync(path.join(root, 'assets/pyodide/manifest.json'), JSON.stringify({ files: { 'runtime.wasm': hash } }));
  };
  updateRuntime('old runtime');
  return { root, updateRuntime, handler: createRequestHandler(root) };
}

test('preview reuses unchanged runtime and invalidates it after a rebuild without restarting', async t => {
  const { handler, updateRuntime } = fixture(t);
  const first = await request(handler, '/assets/pyodide/runtime.wasm');
  assert.equal(first.status, 200);
  assert.equal(first.headers['Content-Type'], 'application/wasm');
  assert.equal(first.headers['Cache-Control'], 'no-cache');
  assert.equal(first.body.toString(), 'old runtime');
  const cached = await request(handler, '/assets/pyodide/runtime.wasm', 'GET', { 'if-none-match': first.headers.ETag });
  assert.equal(cached.status, 304);
  assert.equal(cached.body.length, 0);
  const weak = await request(handler, '/assets/pyodide/runtime.wasm', 'GET', { 'if-none-match': `"other", W/${first.headers.ETag}` });
  assert.equal(weak.status, 304);
  updateRuntime('new runtime');
  const rebuilt = await request(handler, '/assets/pyodide/runtime.wasm', 'GET', { 'if-none-match': first.headers.ETag });
  assert.equal(rebuilt.status, 200);
  assert.notEqual(rebuilt.headers.ETag, first.headers.ETag);
  assert.equal(rebuilt.body.toString(), 'new runtime');
});

test('preview HEAD and invalid requests preserve response and filesystem boundaries', async t => {
  const { handler } = fixture(t);
  const head = await request(handler, '/', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.headers['Content-Length'], Buffer.byteLength('<p>Museum</p>'));
  assert.equal(head.body.length, 0);
  assert.equal((await request(handler, '/missing')).status, 404);
  assert.equal((await request(handler, '/', 'POST')).status, 405);
  assert.equal((await request(handler, '/%zz')).status, 400);
  assert.equal((await request(handler, '/..%2foutside.txt')).status, 403);
});

test('preview negotiates compression, separates cached encodings and reads rebuilt content', async t => {
  const { handler, root, updateRuntime } = fixture(t);
  const body = 'runtime bytes '.repeat(2000);
  updateRuntime(body);
  const plain = await request(handler, '/assets/pyodide/runtime.wasm');
  const br = await request(handler, '/assets/pyodide/runtime.wasm', 'GET', { 'accept-encoding': 'gzip, br', 'if-none-match': plain.headers.ETag });
  assert.equal(br.status, 200);
  assert.equal(br.headers['Content-Encoding'], 'br');
  assert.equal(br.headers.Vary, 'Accept-Encoding');
  assert.equal(br.headers['Content-Type'], 'application/wasm');
  assert.notEqual(br.headers.ETag, plain.headers.ETag);
  assert.deepEqual(zlib.brotliDecompressSync(br.body), plain.body);
  assert.ok(br.body.length < plain.body.length);
  const cached = await request(handler, '/assets/pyodide/runtime.wasm', 'GET', { 'accept-encoding': 'br', 'if-none-match': br.headers.ETag });
  assert.equal(cached.status, 304);
  assert.equal(cached.body.length, 0);
  const gzip = await request(handler, '/assets/pyodide/runtime.wasm', 'GET', { 'accept-encoding': 'br;q=0.3, gzip;q=0.8' });
  assert.equal(gzip.headers['Content-Encoding'], 'gzip');
  assert.notEqual(gzip.headers.ETag, br.headers.ETag);
  assert.deepEqual(zlib.gunzipSync(gzip.body), plain.body);
  const identity = await request(handler, '/assets/pyodide/runtime.wasm', 'GET', { 'accept-encoding': 'br;q=0, gzip;q=0' });
  assert.equal(identity.headers['Content-Encoding'], undefined);
  assert.deepEqual(identity.body, plain.body);
  assert.equal((await request(handler, '/', 'GET', { 'accept-encoding': '*;q=0' })).status, 406);
  const head = await request(handler, '/assets/pyodide/runtime.wasm', 'HEAD', { 'accept-encoding': 'br' });
  assert.equal(head.headers['Content-Encoding'], 'br');
  assert.equal(head.body.length, 0);
  fs.writeFileSync(path.join(root, 'archive.zip'), body);
  const zip = await request(handler, '/archive.zip', 'GET', { 'accept-encoding': 'br, gzip' });
  assert.equal(zip.headers['Content-Encoding'], undefined);
  assert.equal(zip.body.toString(), body);
  updateRuntime('rebuilt ' + body);
  const rebuilt = await request(handler, '/assets/pyodide/runtime.wasm', 'GET', { 'accept-encoding': 'br', 'if-none-match': br.headers.ETag });
  assert.equal(rebuilt.status, 200);
  assert.equal(zlib.brotliDecompressSync(rebuilt.body).toString(), 'rebuilt ' + body);
});

test('compressed delivery preserves the actual bundled Python WebAssembly bytes', async () => {
  const publicRoot = path.resolve(__dirname, '../public');
  const handler = createRequestHandler(publicRoot);
  const response = await request(handler, '/assets/pyodide/pyodide.asm.wasm', 'GET', { 'accept-encoding': 'br' });
  const original = fs.readFileSync(path.join(publicRoot, 'assets/pyodide/pyodide.asm.wasm'));
  assert.equal(response.status, 200);
  assert.equal(response.headers['Content-Encoding'], 'br');
  assert.deepEqual(zlib.brotliDecompressSync(response.body), original);
  assert.ok(response.body.length < original.length);
});
