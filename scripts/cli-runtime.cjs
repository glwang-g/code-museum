const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function validateCliRuntime(root){
  const base=path.join(root,'server/runtimes/cli'),bytes=fs.readFileSync(path.join(base,'manifest.json'));
  const manifest=JSON.parse(bytes),seen=new Set();
  if(manifest.schemaVersion!==1||manifest.platform!=='linux/amd64'||!/^node@sha256:[a-f0-9]{64}$/.test(manifest.baseImage)||!Array.isArray(manifest.files))throw new Error('Invalid CLI runtime manifest');
  for(const row of manifest.files){
    if(!/^(Dockerfile|NOTICE\.md|(?:assets|licenses)\/[A-Za-z0-9_.-]+)$/.test(row.file)||seen.has(row.file)||!/^[a-f0-9]{64}$/.test(row.sha256))throw new Error('Invalid CLI runtime asset');
    seen.add(row.file);
    const asset=fs.readFileSync(path.join(base,row.file));
    if(asset.length!==row.bytes||crypto.createHash('sha256').update(asset).digest('hex')!==row.sha256)throw new Error('CLI runtime checksum mismatch: '+row.file);
  }
  const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  const ids=['typescript','sql','bash','awk','sed','php','perl','xslt'];
  const rows=JSON.parse(fs.readFileSync(path.join(root,'server/runtime-images.json'))).runtimes.filter(r=>ids.includes(r.id));
  if(rows.length!==ids.length||rows.some(r=>r.image!==r.imageId||!/^sha256:[a-f0-9]{64}$/.test(r.imageId)||r.buildManifestSha256!==sha256))throw new Error('CLI runtime image identity/build evidence mismatch');
  return manifest;
}
module.exports={validateCliRuntime};
