const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {spawnSync}=require('node:child_process');
test('guest book keeps public messages, hashes the visitor id and never claims an undelivered notice',()=>{
 const r=spawnSync('python3',['-m','unittest','discover','-s','server','-p','test_messages.py'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);
});
