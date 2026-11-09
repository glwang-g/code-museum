const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function validateAlgol60Runtime(root){
  const base=path.join(root,'server/runtimes/algol60'),bytes=fs.readFileSync(path.join(base,'manifest.json'));
  const manifest=JSON.parse(bytes),seen=new Set();
  if(manifest.schemaVersion!==1||manifest.platform!=='linux/amd64'||!/^gcc@sha256:[a-f0-9]{64}$/.test(manifest.baseImage)||!Array.isArray(manifest.files))throw new Error('Invalid ALGOL 60 manifest');
  for(const row of manifest.files){
    if(!/^(Dockerfile|compile|NOTICE\.md|(?:assets|licenses)\/[A-Za-z0-9_.+-]+)$/.test(row.file)||seen.has(row.file)||!/^[a-f0-9]{64}$/.test(row.sha256))throw new Error('Invalid ALGOL 60 asset');
    seen.add(row.file);
    const asset=fs.readFileSync(path.join(base,row.file));
    if(asset.length!==row.bytes||crypto.createHash('sha256').update(asset).digest('hex')!==row.sha256)throw new Error('ALGOL 60 checksum mismatch: '+row.file);
  }
  const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  const rows=JSON.parse(fs.readFileSync(path.join(root,'server/runtime-images.json'))).runtimes.filter(r=>r.id==='algol-60');
  if(rows.length!==1||rows.some(r=>r.image!==r.imageId||!/^sha256:[a-f0-9]{64}$/.test(r.imageId)||r.buildManifestSha256!==sha256))throw new Error('ALGOL 60 image identity/build evidence mismatch');
  return manifest;
}
module.exports={validateAlgol60Runtime};
