// Build the retained UI from tracked source inputs and the same fixed public data.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {fingerprintAssets}=require('./fingerprint-assets.cjs');
function preserveClassic(root,output,runtimeManifests){
 const snapshot=path.join(root,'archive/classic-ui');
 if(!fs.existsSync(path.join(snapshot,'index.html')))throw new Error('Missing tracked classic UI snapshot');
 const directory=path.join(output,'classic');fs.mkdirSync(directory);
 fs.cpSync(path.join(root,'public'),directory,{recursive:true});
 fs.cpSync(snapshot,directory,{recursive:true});
 for(const folder of ['data','licenses'])fs.cpSync(path.join(output,folder),path.join(directory,folder),{recursive:true});
 for(const name of ['build-info.js','build-info.json','asset-manifest.json'])fs.rmSync(path.join(directory,'data',name),{force:true});
 const hash=crypto.createHash('sha256');
 for(const folder of ['','data'])for(const name of fs.readdirSync(path.join(directory,folder)).sort()){
  const file=path.join(directory,folder,name);
  if(fs.statSync(file).isFile()&&/\.(js|css|html|json)$/.test(name))hash.update(folder+'/'+name+'\0').update(fs.readFileSync(file));
 }
 hash.update(JSON.stringify(runtimeManifests));
 const info={schemaVersion:1,contentSha256:hash.digest('hex')};
 fs.writeFileSync(path.join(directory,'data/build-info.json'),JSON.stringify(info,null,2)+'\n');
 fs.writeFileSync(path.join(directory,'data/build-info.js'),'window.MUSEUM_BUILD_INFO='+JSON.stringify(info)+';');
 fingerprintAssets(directory);
}
module.exports={preserveClassic};
