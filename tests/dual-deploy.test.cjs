const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const repository=path.resolve(__dirname,'..');
const codeFiles=['executor.py','execution_gateway.py','execution_nodes.py','observability.py','mcp.py','mcp_http.py','runtime-images.json','execution-nodes.json'];
const units=['code-museum-worker@.service','code-museum-execution-gateway.service','code-museum-execution-tunnel.service'];
const dataFiles=['catalogue.json','audit-reviews.json','relationship-status.json','execution-capabilities.json','mcp-manifest.json'];
test('dual-node preparation produces separate minimal bundles and rejects altered prepared code',t=>{
 if(spawnSync('python3',['--version']).error?.code==='ENOENT'){t.skip('Requires Python 3');return;}
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'museum-dual-package-'));
 try{
  for(const name of codeFiles){fs.mkdirSync(path.join(root,'server'),{recursive:true});fs.copyFileSync(path.join(repository,'server',name),path.join(root,'server',name));}
  for(const name of units){fs.mkdirSync(path.join(root,'server/deploy'),{recursive:true});fs.copyFileSync(path.join(repository,'server/deploy',name),path.join(root,'server/deploy',name));}
  fs.copyFileSync(path.join(repository,'server/deploy/code-museum-forward.sshd.conf'),path.join(root,'server/deploy/code-museum-forward.sshd.conf'));
  fs.mkdirSync(path.join(root,'dist/data'),{recursive:true});for(const name of dataFiles)fs.writeFileSync(path.join(root,'dist/data',name),'{}\n');
  fs.writeFileSync(path.join(root,'server/private.env'),'DO_NOT_COPY');
  const script='import importlib.util,pathlib,sys; spec=importlib.util.spec_from_file_location("prepare",sys.argv[1]); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m); m.ROOT=pathlib.Path(sys.argv[2]); m.prepare(pathlib.Path(sys.argv[3]))';
  const args=['-c',script,path.join(repository,'deploy/prepare-dual-executor.py'),root,path.join(root,'prepared')];
  let result=spawnSync('python3',args,{encoding:'utf8'});assert.equal(result.status,0,result.stdout+result.stderr);
  const plan=JSON.parse(fs.readFileSync(path.join(root,'prepared/plan.json')));
  assert.equal(plan.nodes.reduce((n,node)=>n+node.languageCount,0),56);
  for(const node of plan.nodes){
   const directory=path.join(root,'prepared',node.id);
   assert.equal(fs.existsSync(path.join(directory,'code/private.env')),false);
   assert.equal(fs.existsSync(path.join(directory,'code/runtimes')),false);
   assert.equal(fs.existsSync(path.join(directory,'units/code-museum-execution-gateway.service')),node.id==='xshow');
   assert.equal(fs.existsSync(path.join(directory,'ssh/code-museum-forward.sshd.conf')),node.id==='xshow2');
   const placeholders=fs.readFileSync(path.join(directory,'worker-'+node.id+'.env.example'),'utf8');
   assert.ok(placeholders.match(/^EXECUTOR_TOKEN=(.*)$/m)[1].length<32,'unfilled credential example must fail worker token validation');
   const metrics=node.id==='xshow'?'/var/lib/code-museum-executor/metrics.sqlite':'/var/lib/code-museum-executor/worker-xshow2-metrics.sqlite';
   assert.equal(node.metricsDatabase,metrics);
   assert.ok(placeholders.includes('EXECUTOR_METRICS_DB='+metrics+'\n'),'legacy metrics must be reused once, without cloning history to the second node');
   result=spawnSync('python3',[path.join(directory,'preflight.py')],{encoding:'utf8'});assert.equal(result.status,0,result.stdout+result.stderr);
   assert.equal(JSON.parse(result.stdout).localImagesChecked,false);
  }
  fs.appendFileSync(path.join(root,'prepared/xshow2/code/executor.py'),'\n# changed after review\n');
  result=spawnSync('python3',[path.join(root,'prepared/xshow2/preflight.py')],{encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/Prepared file mismatch: code\/executor.py/);
  result=spawnSync('python3',args,{encoding:'utf8'});assert.notEqual(result.status,0);assert.match(result.stderr,/Output must not exist/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
