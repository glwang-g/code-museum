const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process'),{generateCatalogue}=require('../scripts/import-pldb.cjs'),{generateRelationshipAudit}=require('../scripts/relationship-audit.cjs'),{executionCapabilities}=require('../scripts/execution-capabilities.cjs');
const root=path.resolve(__dirname,'..');
function run(requests,alter=false){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cm-mcp-'));try{
  const catalogue=generateCatalogue(root),files={'catalogue.json':JSON.stringify(catalogue),'relationship-status.json':JSON.stringify(generateRelationshipAudit(root,catalogue)),'execution-capabilities.json':JSON.stringify(executionCapabilities(root)),'audit-reviews.json':fs.readFileSync(path.join(root,'data/audit/reviews.json'),'utf8')};
  for(const [name,body] of Object.entries(files))fs.writeFileSync(path.join(dir,name),body);
  fs.writeFileSync(path.join(dir,'mcp-manifest.json'),JSON.stringify(Object.fromEntries(Object.entries(files).map(([name,body])=>[name,crypto.createHash('sha256').update(body).digest('hex')]))));
  if(alter)fs.appendFileSync(path.join(dir,'catalogue.json'),' ');
  return spawnSync('python3',[path.join(root,'server/mcp.py'),'--data',dir],{input:requests.map(r=>typeof r==='string'?r:JSON.stringify(r)).join('\n')+'\n',encoding:'utf8',maxBuffer:8*1024*1024});
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
}
const req=(id,method,params={})=>({jsonrpc:'2.0',id,method,params}),init=req(1,'initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'offline-check',version:'1'}}),call=(id,name,args)=>req(id,'tools/call',{name,arguments:args});
test('read-only MCP negotiates stdio and queries catalogue, evidence, lineage and capabilities',()=>{
 const result=run([init,{jsonrpc:'2.0',method:'notifications/initialized'},req(2,'tools/list'),call(3,'search_languages',{query:'pythn'}),call(4,'get_language',{id:'python'}),call(5,'get_lineage',{id:'python',direction:'upstream',depth:2}),call(6,'get_relationship',{key:'b|c|influencedBy'}),call(7,'get_execution_capabilities',{id:'rust'}),req(8,'resources/read',{uri:'museum://coverage'})]);
 assert.equal(result.status,0,result.stderr);const rows=result.stdout.trim().split('\n').map(JSON.parse);assert.equal(rows.length,8);
 assert.equal(rows[0].result.protocolVersion,'2025-06-18');assert.equal(rows[1].result.tools.length,5);assert.ok(rows[1].result.tools.every(t=>t.annotations.readOnlyHint));
 const data=i=>JSON.parse(rows[i].result.content[0].text);
 assert.equal(data(2).results[0].id,'python');assert.equal(data(3).record.id,'python');assert.ok(data(4).relations.some(r=>r.from==='modula-3'&&r.to==='python'));assert.equal(data(5).state,'excerpt-recorded');assert.ok(data(5).sources[0].excerpt.includes('parent B'));assert.equal(data(6).liveAvailabilityChecked,false);assert.equal(data(6).configured.languages[0].remote.requiresToken,true);assert.equal(JSON.parse(rows[7].result.contents[0].text).catalogue.count,5155);
});
test('MCP rejects execution, path inputs, bad arguments and preserves C++ / C# distinction',()=>{
 const result=run([init,call(2,'execute_code',{code:'print(1)'}),call(3,'get_language',{id:'../../etc/passwd'}),call(4,'search_languages',{query:'C++'}),call(5,'search_languages',{query:'C#'}),call(6,'get_lineage',{id:'python',depth:99}),req(7,'resources/read',{uri:'file:///etc/passwd'}),'invalid json']);
 assert.equal(result.status,0,result.stderr);const rows=result.stdout.trim().split('\n').map(JSON.parse);assert.equal(rows[1].result.isError,true);assert.equal(rows[2].result.isError,true);assert.equal(JSON.parse(rows[3].result.content[0].text).results[0].id,'cpp');assert.equal(JSON.parse(rows[4].result.content[0].text).results[0].id,'csharp');assert.equal(rows[5].result.isError,true);assert.ok(rows[6].error);assert.equal(rows[7].error.code,-32700);
});
test('MCP refuses changed data bytes and oversized request lines',()=>{
 const corrupt=run([init],true);assert.notEqual(corrupt.status,0);assert.match(corrupt.stderr,/hash mismatch/);
 const result=run(['x'.repeat(70000),init,req(2,'ping')]);assert.equal(result.status,0,result.stderr);const rows=result.stdout.trim().split('\n').map(JSON.parse);assert.equal(rows[0].error.code,-32700);assert.equal(rows[2].id,2);
});
