const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
// Stable aliases remain available for workers, diagnostics and source comparison.
// The HTML uses content-addressed files, so long caching cannot mix releases.
function fingerprintAssets(directory){
 const manifest={};
 const html=fs.readFileSync(path.join(directory,'index.html'),'utf8').replace(/\b(src|href)="([^"#]+\.(?:js|css))"/g,(match,attribute,name)=>{
  if(/^(?:https?:|\/\/)/.test(name))return match;
  if(!manifest[name]){
   const bytes=fs.readFileSync(path.join(directory,name)),extension=path.extname(name);
   const digest=crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12);
   const versioned=name.slice(0,-extension.length)+'.'+digest+extension;
   fs.writeFileSync(path.join(directory,versioned),bytes);manifest[name]=versioned;
  }
  return `${attribute}="${manifest[name]}"`;
 });
 fs.writeFileSync(path.join(directory,'index.html'),html);
 fs.writeFileSync(path.join(directory,'data/asset-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 return manifest;
}
module.exports={fingerprintAssets};
