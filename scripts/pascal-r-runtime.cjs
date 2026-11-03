const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function validatePascalRRuntime(root){
  const base=path.join(root,'server/runtimes/pascal-r'),bytes=fs.readFileSync(path.join(base,'manifest.json'));
  const manifest=JSON.parse(bytes),seen=new Set();
  if(manifest.schemaVersion!==1||manifest.platform!=='linux/amd64'||!/^gcc@sha256:[a-f0-9]{64}$/.test(manifest.baseImage)||!Array.isArray(manifest.files))throw new Error('Invalid Pascal/R manifest');
  for(const row of manifest.files){
    if(!/^(Dockerfile|NOTICE\.md|(?:assets|licenses)\/[A-Za-z0-9_.+-]+)$/.test(row.file)||seen.has(row.file)||!/^[a-f0-9]{64}$/.test(row.sha256))throw new Error('Invalid Pascal/R asset');
    seen.add(row.file);
    const asset=fs.readFileSync(path.join(base,row.file));
    if(asset.length!==row.bytes||crypto.createHash('sha256').update(asset).digest('hex')!==row.sha256)throw new Error('Pascal/R checksum mismatch: '+row.file);
  }
  const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  const rows=JSON.parse(fs.readFileSync(path.join(root,'server/runtime-images.json'))).runtimes.filter(r=>['pascal','r'].includes(r.id));
  if(rows.length!==2||rows.some(r=>r.image!==r.imageId||!/^sha256:[a-f0-9]{64}$/.test(r.imageId)||r.buildManifestSha256!==sha256))throw new Error('Pascal/R image identity/build evidence mismatch');
  return manifest;
}
module.exports={validatePascalRRuntime};
