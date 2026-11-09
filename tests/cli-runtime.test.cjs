const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {validateCliRuntime}=require('../scripts/cli-runtime.cjs');
const {executionCapabilities}=require('../scripts/execution-capabilities.cjs');
const root=path.resolve(__dirname,'..');
test('Perl default example prints UTF-8 source literals as well as its numeric result', t=>{
  const {spawnSync}=require('node:child_process');
  const probe=spawnSync('perl',['-e','exit 0']);
  if(probe.error?.code==='ENOENT'){t.skip('Native Perl is not installed; fixed-image check covers this separately');return;}
  assert.equal(probe.status,0);
  const context={window:{}};
  require('node:vm').runInNewContext(fs.readFileSync(path.join(root,'src/lab-examples.js'),'utf8'),context);
  const example=context.window.MUSEUM_LAB_EXAMPLES.find(e=>e.id==='perl');
  const result=spawnSync('perl',['-CS','-e',example.code+'print "博物馆\\n";'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.equal(result.stdout,'55\n博物馆\n');
});
test('CLI preparation assets are fixed, checked offline, and never copied as browser downloads',()=>{
  const manifest=validateCliRuntime(root),capabilities=executionCapabilities(root);
  assert.ok(manifest.files.some(r=>r.file==='assets/typescript-5.9.3.tgz'));
  for(const id of ['typescript','sql','bash','awk','sed','php','perl','xslt']){
    const language=capabilities.languages.find(r=>r.id===id);
    assert.equal(language.local,null);assert.equal(language.defaultMode,'remote');
    assert.equal(language.remote.compileSeconds,id==='typescript'?15:0);
    assert.equal(language.remote.requiresToken,false);
  }
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'museum-cli-hash-'));
  try{
    fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true});
    const asset=path.join(dir,'server/runtimes/cli/assets/typescript-5.9.3.tgz');
    const bytes=fs.readFileSync(asset);bytes[bytes.length-1]^=1;fs.writeFileSync(asset,bytes);
    assert.throws(()=>validateCliRuntime(dir),/checksum mismatch/);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
