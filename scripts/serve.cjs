const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const zlib = require('node:zlib');
const { pipeline } = require('node:stream');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm', '.zip': 'application/zip', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
const compressible = new Set(['.html', '.css', '.js', '.mjs', '.wasm', '.json', '.svg']);
function chooseEncoding(header, canCompress) {
  if (!header) return null;
  const preferences = new Map();
  for (const entry of header.split(',')) {
    const [name, ...parameters] = entry.trim().toLowerCase().split(';');
    const quality = parameters.map(value => value.trim()).find(value => value.startsWith('q='));
    const value = quality === undefined ? 1 : Number(quality.slice(2));
    preferences.set(name.trim(), Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0);
  }
  const identityAllowed = preferences.has('identity') ? preferences.get('identity') > 0 : preferences.get('*') !== 0;
  if (canCompress) {
    const candidates = ['br', 'gzip'].map(name => ({ name, quality: preferences.get(name) ?? preferences.get('*') ?? 0 })).sort((a, b) => b.quality - a.quality);
    const best = candidates[0];
    if (best.quality > 0 && best.quality >= (preferences.get('identity') ?? 0)) return best.name;
  }
  return identityAllowed ? null : false;
}
function createRequestHandler(directory, options={}) {
  const root = fs.realpathSync(path.resolve(directory));
  const upstream=options.executor?new URL(options.executor):null;
  if(upstream&&(upstream.protocol!=='http:'||!['127.0.0.1','localhost'].includes(upstream.hostname)||upstream.username||upstream.password||upstream.pathname!=='/'||upstream.search||upstream.hash))throw new Error('Executor proxy must target local HTTP');
  return (req, res) => {
  if(upstream&&/^\/api\/(?:runtimes|executions(?:\/[a-f0-9]{32})?)$/.test(req.url)){
    if(!['GET','POST','DELETE'].includes(req.method)){res.writeHead(405).end();return;}
    const length=Number(req.headers['content-length']||0);
    if(req.headers['transfer-encoding']||!Number.isInteger(length)||length>98304||length<0){res.writeHead(413).end();return;}
    const headers={};for(const key of ['authorization','origin','content-type','content-length','x-execution-session'])if(req.headers[key])headers[key]=req.headers[key];
    const proxy=http.request(new URL(req.url,upstream),{method:req.method,headers,timeout:10000},response=>{res.writeHead(response.statusCode,{'Content-Type':'application/json','Cache-Control':'no-store'});response.pipe(res)});
    proxy.on('timeout',()=>proxy.destroy());proxy.on('error',()=>{if(!res.headersSent)res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'}).end('{"error":"Execution service unavailable"}');else res.destroy()});
    req.on('aborted',()=>proxy.destroy());req.pipe(proxy);return;
  }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end('Not found'); return; }
    if (!fs.realpathSync(file).startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const stat = fs.statSync(file);
    const encoding = chooseEncoding(req.headers['accept-encoding'], compressible.has(path.extname(file)));
    if (encoding === false) { res.writeHead(406, { Vary: 'Accept-Encoding' }).end('No acceptable content encoding'); return; }
    const relative = path.relative(root, file).split(path.sep).join('/');
    const pyodideName = relative.startsWith('assets/pyodide/') ? relative.slice('assets/pyodide/'.length) : '';
    // Read the current build's manifest, including when dist was replaced without restarting preview.
    const hash = pyodideName && JSON.parse(fs.readFileSync(path.join(root, 'assets/pyodide/manifest.json'), 'utf8')).files[pyodideName];
    const etag = encoding ? `W/"${hash || `${stat.size}-${stat.mtimeMs}`}-${encoding}"` : hash ? `"${hash}"` : `W/"${stat.size}-${stat.mtimeMs}"`;
    const headers = { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', ETag: etag, Vary: 'Accept-Encoding' };
    if (encoding) headers['Content-Encoding'] = encoding;
    if (req.headers['if-none-match']?.split(',').some(value => value.trim().replace(/^W\//, '') === etag.replace(/^W\//, '') || value.trim() === '*')) {
      res.writeHead(304, headers).end(); return;
    }
    if (!encoding) headers['Content-Length'] = stat.size;
    res.writeHead(200, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    const input = fs.createReadStream(file);
    const streams = encoding ? [input, encoding === 'br' ? zlib.createBrotliCompress({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }) : zlib.createGzip(), res] : [input, res];
    pipeline(...streams, error => { if (error && !res.destroyed) res.destroy(error); });
  } catch { res.writeHead(400).end('Bad request'); }
  };
}
module.exports = { createRequestHandler };
if (require.main === module) {
  const root = path.resolve(__dirname, '../dist');
  if (!fs.existsSync(path.join(root, 'index.html'))) {
    console.error('Run npm run build before preview.');
    process.exit(1);
  }
  const server = http.createServer(createRequestHandler(root,{executor:process.env.EXECUTOR_UPSTREAM}));
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log(`Code Museum: http://127.0.0.1:${server.address().port}`));
}
