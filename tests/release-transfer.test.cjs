const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
test('release transfer reuses identical bytes despite fresh artifact timestamps and isolates changed files',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'museum-transfer-'));
 try{
  const old=path.join(root,'old'),source=path.join(root,'source'),next=path.join(root,'next');for(const folder of [old,source,next])fs.mkdirSync(folder);
  for(const folder of [old,source]){fs.writeFileSync(path.join(folder,'asset'),'fixed-asset');fs.writeFileSync(path.join(folder,'changed'),'old-content')}
  for(const file of ['asset','changed']){fs.utimesSync(path.join(old,file),1000000000,1000000000);fs.utimesSync(path.join(source,file),1100000000,1100000000)}
  fs.writeFileSync(path.join(source,'changed'),'new-content');
  execFileSync('rsync',['-az','--no-times','--checksum','--link-dest='+old,source+'/',next+'/']);
  assert.equal(fs.statSync(path.join(old,'asset')).ino,fs.statSync(path.join(next,'asset')).ino);
  assert.notEqual(fs.statSync(path.join(old,'changed')).ino,fs.statSync(path.join(next,'changed')).ino);
  assert.equal(fs.readFileSync(path.join(old,'changed'),'utf8'),'old-content');assert.equal(fs.readFileSync(path.join(next,'changed'),'utf8'),'new-content');
  assert.equal(fs.statSync(path.join(old,'asset')).mtimeMs,1000000000000);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
