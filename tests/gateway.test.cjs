const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os');
const {executionNodes}=require('../scripts/execution-nodes.cjs');
const {executionCapabilities}=require('../scripts/execution-capabilities.cjs');
test('dual-node gateway isolates owners, preserves routes and never retries uncertain submissions',t=>{
 const available=spawnSync('python3',['--version']);if(available.error?.code==='ENOENT'){t.skip('Requires Python 3');return;}
 const result=spawnSync('python3',['-m','unittest','discover','-s','server','-p','test_execution_gateway.py'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8',timeout:60000});
 assert.equal(result.status,0,result.stdout+result.stderr);
});
test('build refuses an incomplete node partition and keeps private routing addresses out of public capabilities',()=>{
 const root=path.resolve(__dirname,'..'),caps=executionCapabilities(root);
 assert.equal(caps.remoteLimits.concurrency,2);assert.equal(caps.remoteLimits.perNodeConcurrency,1);
 assert.doesNotMatch(JSON.stringify(caps),/127\.0\.0\.1:418[23]|EXECUTOR_NODE_/);
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'museum-node-partition-'));
 try{
  fs.mkdirSync(path.join(directory,'server'));
  const config={schemaVersion:1,nodes:[{id:'one',url:'http://127.0.0.1:4182',tokenEnv:'EXECUTOR_NODE_ONE_TOKEN',languages:['python']},{id:'two',url:'http://127.0.0.1:4183',tokenEnv:'EXECUTOR_NODE_TWO_TOKEN',languages:['bcpl']}]};
  const filename=path.join(directory,'server/execution-nodes.json'),rows=[{id:'python'},{id:'bcpl'}];
  const write=value=>fs.writeFileSync(filename,JSON.stringify(value));write(config);assert.equal(executionNodes(directory,rows).nodes.length,2);
  for(const change of [c=>c.nodes.pop(),c=>c.nodes[1].languages=['python'],c=>c.nodes[1].url='http://example.com:4183',c=>c.nodes[1].url=c.nodes[0].url,c=>c.nodes[1].tokenEnv=c.nodes[0].tokenEnv]){
   const changed=structuredClone(config);change(changed);write(changed);assert.throws(()=>executionNodes(directory,rows));
  }
 }finally{fs.rmSync(directory,{recursive:true,force:true})}
});
