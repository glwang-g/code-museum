const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {spawnSync}=require('node:child_process');
test('private executor validates payloads, Docker restrictions, owners and bounded job scheduling',t=>{
 const available=spawnSync('python3',['--version']);if(available.error?.code==='ENOENT'){t.skip('Requires Python 3');return;}
 const result=spawnSync('python3',['-m','unittest','discover','-s','server','-p','test_executor.py'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
});
