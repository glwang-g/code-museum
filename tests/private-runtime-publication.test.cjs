const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {validateFixedRuntime}=require('../scripts/fixed-runtime.cjs');
const {build}=require('../scripts/build.cjs');
const root=path.resolve(__dirname,'..'),policy=JSON.parse(fs.readFileSync(path.join(root,'data/runtime-input-policy.json'))),privateFiles=policy.runtimes.bcpl.privateFiles;
const publicMetadata=dir=>validateFixedRuntime(dir,'bcpl','bcpl',{mode:'public-metadata'});
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'museum-private-policy-'));
 fs.cpSync(path.join(root,'server/runtimes/bcpl'),path.join(dir,'server/runtimes/bcpl'),{recursive:true,filter:file=>!privateFiles.includes(path.relative(path.join(root,'server/runtimes/bcpl'),file).split(path.sep).join('/'))});
 fs.copyFileSync(path.join(root,'server/runtime-images.json'),path.join(dir,'server/runtime-images.json'));
 fs.mkdirSync(path.join(dir,'data'));fs.copyFileSync(path.join(root,'data/runtime-input-policy.json'),path.join(dir,'data/runtime-input-policy.json'));
 return dir;
}
function writeJSON(file,value){fs.writeFileSync(file,JSON.stringify(value));}
test('only the pinned BCPL publication policy permits absent private inputs',()=>{
 const dir=fixture(),base=path.join(dir,'server/runtimes/bcpl');
 try{
  const metadata=publicMetadata(dir);
  assert.equal(metadata.publication.publicRepoToolchainComplete,false);
  assert.equal(metadata.publication.manifestSha256,hash(fs.readFileSync(path.join(base,'manifest.json'))));
  assert.deepEqual(metadata,publicMetadata(root),'public metadata cannot depend on privately retained source files');
  assert.throws(()=>validateFixedRuntime(dir,'bcpl','bcpl'),/full image rebuilding requires the exact private BCPL inputs/);
  const policyFile=path.join(dir,'data/runtime-input-policy.json'),originalPolicy=fs.readFileSync(policyFile),altered=JSON.parse(originalPolicy);
  altered.runtimes.bcpl.privateFiles.push('assets/museum-bcpl-runner.b');writeJSON(policyFile,altered);
  assert.throws(()=>publicMetadata(dir),/Invalid restricted BCPL input publication policy/);
  fs.writeFileSync(policyFile,originalPolicy);
  const manifestFile=path.join(base,'manifest.json'),originalManifest=fs.readFileSync(manifestFile),manifest=JSON.parse(originalManifest);
  manifest.sourceDateEpoch++;writeJSON(manifestFile,manifest);
  assert.throws(()=>publicMetadata(dir),/Invalid restricted BCPL input publication policy/);
  fs.writeFileSync(manifestFile,originalManifest);
  const dockerfile=path.join(base,'Dockerfile'),originalDockerfile=fs.readFileSync(dockerfile);
  fs.unlinkSync(dockerfile);assert.throws(()=>publicMetadata(dir),/inventory mismatch/);
  fs.writeFileSync(dockerfile,originalDockerfile);fs.appendFileSync(dockerfile,'tamper');assert.throws(()=>publicMetadata(dir),/checksum mismatch/);
  fs.writeFileSync(dockerfile,originalDockerfile);
  const privateFile=path.join(base,privateFiles[0]);fs.mkdirSync(path.dirname(privateFile),{recursive:true});fs.writeFileSync(privateFile,'unverified private input');
  assert.throws(()=>publicMetadata(dir),/checksum mismatch/,'present private payloads must still match the original manifest');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

function treeHashes(dir,base=dir,all={}){
 for(const name of fs.readdirSync(dir).sort()){
  const file=path.join(dir,name);
  if(fs.statSync(file).isDirectory())treeHashes(file,base,all);else all[path.relative(base,file)]=hash(fs.readFileSync(file));
 }
 return all;
}
test('public website builds offline without BCPL private inputs and never publishes them',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'museum-public-build-'));
 try{
  for(const name of ['src','public','data','server'])fs.cpSync(path.join(root,name),path.join(dir,name),{recursive:true,mode:fs.constants.COPYFILE_FICLONE});
  fs.cpSync(path.join(root,'archive/classic-ui'),path.join(dir,'archive/classic-ui'),{recursive:true});
  build(dir);const initial=treeHashes(path.join(dir,'dist'));
  for(const name of privateFiles)fs.rmSync(path.join(dir,'server/runtimes/bcpl',name),{force:true});
  build(dir);assert.deepEqual(treeHashes(path.join(dir,'dist')),initial,'retained private inputs must not influence any published byte');
  const result=JSON.parse(fs.readFileSync(path.join(dir,'dist/data/bcpl-runtime-build.json')));
  assert.equal(result.publication.publicRepoToolchainComplete,false);
  assert.equal(fs.existsSync(path.join(dir,'dist/licenses/bcpl/licenses/upstream-README.txt')),false);
  assert.ok(fs.existsSync(path.join(dir,'dist/licenses/bcpl/licenses/GNU-licence')));
  assert.match(fs.readFileSync(path.join(dir,'dist/licenses/bcpl/PUBLICATION.txt'),'utf8'),/rebuilding the BCPL image requires the exact independently authorized private inputs/);
  assert.equal(Object.keys(initial).some(name=>/bcpl-20261109|upstream-sysboot|cintcode-noninteractive/.test(name)),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
