const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {validatePascalRRuntime}=require('../scripts/pascal-r-runtime.cjs');
const {executionCapabilities}=require('../scripts/execution-capabilities.cjs');
const root=path.resolve(__dirname,'..');
test('Pascal/R fixed packages have verified hashes and expose limited remote execution',()=>{
  const manifest=validatePascalRRuntime(root),capabilities=executionCapabilities(root);
  for(const id of ['pascal','r']){
    const language=capabilities.languages.find(r=>r.id===id);
    assert.equal(language.local,null);assert.equal(language.defaultMode,'remote');
    assert.equal(language.remote.compileSeconds,id==='pascal'?10:0);
    assert.equal(language.remote.memoryMiB,512);assert.equal(language.remote.requiresToken,false);
  }
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'museum-pascal-r-hash-'));
  try{
    fs.cpSync(path.join(root,'server/runtimes/pascal-r'),path.join(dir,'server/runtimes/pascal-r'),{recursive:true});
    fs.copyFileSync(path.join(root,'server/runtime-images.json'),path.join(dir,'server/runtime-images.json'));
    const file=path.join(dir,'server/runtimes/pascal-r',manifest.files.find(r=>r.package==='fp-compiler-3.2.2').file);
    const bytes=fs.readFileSync(file);bytes[bytes.length-1]^=1;fs.writeFileSync(file,bytes);
    assert.throws(()=>validatePascalRRuntime(dir),/checksum mismatch/);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
