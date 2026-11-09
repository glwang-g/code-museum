const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {packageRelease,RELEASE_SERVER_FILES}=require('../scripts/package-release.cjs');
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'museum-release-test-'));
 for(const file of ['dist/index.html','dist/assets/example.js','deploy/activate.sh',...RELEASE_SERVER_FILES.map(f=>'server/'+f)]){
  const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,file+'\n');
 }
 return root;
}
test('ordinary releases omit SDKs and secrets while keeping service dependencies and reproducible bytes',()=>{
 const root=fixture();
 try{
  for(const file of ['server/runtimes/swift/assets/sdk.part00','server/private.env','server/test_executor.py']){const p=path.join(root,file);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,'never publish this input');}
  const first=packageRelease(root,path.join(root,'release-one')),second=packageRelease(root,path.join(root,'release-two'));
  assert.deepEqual(first,second);assert.equal(first.files.some(r=>/runtimes\/|private\.env|test_executor/.test(r.file)),false);
  for(const file of RELEASE_SERVER_FILES)assert.ok(fs.existsSync(path.join(root,'release-one/server',file)));
  assert.equal(fs.existsSync(path.join(root,'release-one/server/runtimes')),false);
  assert.equal(fs.readFileSync(path.join(root,'release-one/dist/index.html'),'utf8'),'dist/index.html\n');
  assert.throws(()=>packageRelease(root,path.join(root,'release-one')),/must not exist/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('ordinary releases reject symlinked dist inputs before publishing any staging output',()=>{
 const root=fixture();
 try{
  fs.symlinkSync(path.join(root,'server/private.env'),path.join(root,'dist/secret.env'));
  assert.throws(()=>packageRelease(root,path.join(root,'rejected')),/symlink/);
  assert.equal(fs.existsSync(path.join(root,'rejected')),false);
  assert.throws(()=>packageRelease(root,path.join(root,'dist/nested')),/overlaps/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
