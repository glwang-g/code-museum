// Build a small ordinary-site release; runtime SDKs are provisioned independently.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const RELEASE_SERVER_FILES=['analytics.py','messages.py','explanations.py','mcp.py','mcp_http.py','observability.py','executor.py','execution_nodes.py','execution_gateway.py','runtime-images.json','execution-nodes.json'];
const MAX_RELEASE_BYTES=128*1024*1024;
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function packageRelease(root,output){
 root=path.resolve(root);output=path.resolve(output);
 if(fs.existsSync(output))throw new Error('Release output must not exist; choose a new staging directory');
 if(output===root||output.startsWith(path.join(root,'dist')+path.sep)||output===path.join(root,'dist')||root.startsWith(output+path.sep))throw new Error('Release output overlaps source inputs');
 const files=[];
 function add(relative){
  const source=path.join(root,relative),stat=fs.lstatSync(source);
  if(!stat.isFile()||stat.isSymbolicLink())throw new Error('Release inputs must be regular files: '+relative);
  const bytes=fs.readFileSync(source);files.push({relative,bytes,sha256:hash(bytes)});
 }
 function walk(relative){
  const directory=path.join(root,relative),stat=fs.lstatSync(directory);
  if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('Release directory must not be a symlink: '+relative);
  for(const name of fs.readdirSync(directory).sort()){
   const child=path.join(relative,name),s=fs.lstatSync(path.join(root,child));
   if(s.isSymbolicLink())throw new Error('Release inputs must not be symlinks: '+child);
   if(s.isDirectory())walk(child);else add(child);
  }
 }
 walk('dist');
 if(!files.some(row=>row.relative==='dist/index.html'))throw new Error('Build dist/index.html before packaging');
 for(const file of RELEASE_SERVER_FILES)add('server/'+file);
 add('deploy/activate.sh');
 const totalBytes=files.reduce((n,row)=>n+row.bytes.length,0);
 if(totalBytes>MAX_RELEASE_BYTES)throw new Error('Ordinary-site release exceeds 128 MiB; inspect accidentally bundled build inputs');
 const manifest={schemaVersion:1,scope:'Ordinary site release only. No runtime SDKs, image layers, deployment credentials or automatic executor installation.',totalBytes,files:files.map(({relative,bytes,sha256})=>({file:relative.split(path.sep).join('/'),bytes:bytes.length,sha256})).sort((a,b)=>a.file<b.file?-1:a.file>b.file?1:0)};
 fs.mkdirSync(path.dirname(output),{recursive:true});
 const staging=fs.mkdtempSync(path.join(path.dirname(output),'.museum-release-'));
 try{
  for(const row of files){const target=path.join(staging,row.relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,row.bytes,{mode:0o644});}
  fs.writeFileSync(path.join(staging,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o644});
  fs.renameSync(staging,output);
 }finally{if(fs.existsSync(staging))fs.rmSync(staging,{recursive:true,force:true});}
 return manifest;
}
module.exports={packageRelease,RELEASE_SERVER_FILES,MAX_RELEASE_BYTES};
if(require.main===module){
 try{
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--output')throw new Error('Usage: node scripts/package-release.cjs --output <new staging directory>');
  const manifest=packageRelease(path.resolve(__dirname,'..'),args[1]);
  console.log('Prepared ordinary-site release: '+manifest.files.length+' files, '+manifest.totalBytes+' bytes; '+path.resolve(args[1]));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
