const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{spawnSync}=require('node:child_process');
require('../scripts/explanation-preview.cjs');
test('on-demand model service validates output, deduplicates requests, persists spending limits and keeps secrets private',()=>{
 const result=spawnSync('python3',['-m','unittest','discover','-s','server','-p','test_explanations.py'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8',timeout:30000});
 assert.equal(result.status,0,result.stdout+result.stderr);
});
