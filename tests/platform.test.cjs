const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {spawnSync}=require('node:child_process');
test('aggregate metrics retain no user payloads and private HTTP MCP bounds protocol and refreshes verified data',()=>{
 const r=spawnSync('python3',['-m','unittest','discover','-s','server','-p','test_platform.py'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);
});
