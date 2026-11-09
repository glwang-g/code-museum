// Opt-in full fixed-inventory smoke regression through the temporary dual-node gateway.
// Uses one recorded positive per runtime. Does not install or change production services.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {startDualPreview}=require('./dual-executor-preview.cjs');
const {executionCapabilities}=require('./execution-capabilities.cjs');
const root=path.resolve(__dirname,'..'),delay=ms=>new Promise(ok=>setTimeout(ok,ms));
const FINAL=new Set(['completed','failed','compile_error','compile_timed_out','timed_out','cancelled','output_limit','memory_limit','infrastructure_error']);
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const baseSeven={
 python:'print(sum(range(1,11))); print(input())',
 ruby:'puts (1..10).sum; puts STDIN.gets',
 c:'#include <stdio.h>\nint main(void){char s[32];scanf("%31s",s);printf("55\\n%s\\n",s);}',
 cpp:'#include <iostream>\n#include <string>\nint main(){std::string s;std::cin>>s;std::cout<<"55\\n"<<s<<"\\n";}',
 rust:'use std::io;fn main(){let mut s=String::new();io::stdin().read_line(&mut s).unwrap();println!("55\\n{}",s.trim());}',
 go:'package main\nimport("fmt";"bufio";"os")\nfunc main(){s:=bufio.NewScanner(os.Stdin);s.Scan();fmt.Println(55);fmt.Println(s.Text())}',
 java:'import java.util.Scanner;class Museum{public static void main(String[]a){System.out.println(55);System.out.println(new Scanner(System.in).nextLine());}}'
};
function loadSmokeInventory(){
 const manifest=read('server/runtime-images.json'),placement=read('server/execution-nodes.json'),rollout=read('data/audit/runtime-rollout.json');
 assert.equal(manifest.schemaVersion,1);assert.equal(placement.schemaVersion,1);assert.equal(rollout.schemaVersion,1);
 const runtimes=new Map(manifest.runtimes.map(row=>[row.id,row]));assert.equal(runtimes.size,manifest.runtimes.length);assert.equal(runtimes.size,56,'This acceptance expects the reviewed 56-runtime inventory');
 assert.equal(placement.nodes.length,2);const assigned=new Map();
 for(const node of placement.nodes){assert.ok(['xshow','xshow2'].includes(node.id));for(const language of node.languages){assert.ok(runtimes.has(language),'Unknown placed runtime '+language);assert.ok(!assigned.has(language),'Duplicate runtime placement '+language);assigned.set(language,node.id)}}
 assert.deepEqual([...assigned.keys()].sort(),[...runtimes.keys()].sort(),'Every runtime must be placed exactly once');
 const evidenceFiles=new Set(['data/audit/runtime-rollout.json','data/audit/p1-runtime-checks.json','scripts/check-executor-browser.cjs']);
 const samples=new Map();
 for(const row of rollout.languages){
  assert.equal(row.stage,'temporary-browser-verified','Unverified rollout row '+row.id);assert.ok(runtimes.has(row.id));assert.ok(!samples.has(row.id),'Duplicate rollout sample '+row.id);
  assert.match(row.containerEvidence,/^data\/audit\/[a-z0-9.-]+\.json$/);evidenceFiles.add(row.containerEvidence);
  const sample=read(row.containerEvidence).checks.find(check=>check.language===row.id&&check.result?.state==='completed'&&typeof check.code==='string'&&typeof check.result.stdout==='string');
  assert.ok(sample,'No completed recorded code/output sample for '+row.id);
  samples.set(row.id,{language:row.id,code:sample.code,stdin:sample.stdin||'',stdout:sample.result.stdout,name:sample.name,evidence:row.containerEvidence});
 }
 assert.equal(samples.size,37,'Expected all original B-group positive samples');
 const p1=read('data/audit/p1-runtime-checks.json');
 for(const language of runtimes.keys()){
  if(samples.has(language)||Object.hasOwn(baseSeven,language))continue;
  const sample=p1.checks.find(check=>check.language===language&&check.result?.state==='completed'&&typeof check.code==='string'&&typeof check.result.stdout==='string');
  assert.ok(sample,'No recorded P1 code/output sample for '+language);
  samples.set(language,{language,code:sample.code,stdin:sample.stdin||'',stdout:sample.result.stdout,name:sample.name,evidence:'data/audit/p1-runtime-checks.json'});
 }
 assert.equal(samples.size,49,'Expected 37 B-group and 12 P1 recorded positives');
 for(const [language,code] of Object.entries(baseSeven)){
  assert.ok(runtimes.has(language));assert.ok(!samples.has(language));samples.set(language,{language,code,stdin:'hello\n',stdout:'55\nhello\n',name:'Original seven real browser execution and standard input',evidence:'scripts/check-executor-browser.cjs'});
 }
 assert.deepEqual([...samples.keys()].sort(),[...runtimes.keys()].sort());
 const expectedMetadata=executionCapabilities(root).languages.filter(row=>row.remote).map(({remote})=>Object.fromEntries(['id','version','memoryMiB','source','compileSeconds','runSeconds'].map(key=>[key,remote[key]]))).sort((a,b)=>a.id.localeCompare(b.id));
 const inputFiles=[...new Set(['scripts/check-dual-runtime-inventory.cjs','scripts/dual-executor-preview.cjs','scripts/executor-preview.cjs','scripts/serve.cjs','scripts/execution-capabilities.cjs','server/execution_gateway.py','server/execution_nodes.py','server/execution-nodes.json','server/executor.py','server/observability.py','server/mcp.py','server/mcp_http.py','server/runtime-images.json',...evidenceFiles])].sort();
 const inputHashes=()=>Object.fromEntries(inputFiles.map(file=>[file,hash(fs.readFileSync(path.join(root,file)))]));
 return {runtimes,placement,assigned,samples,expectedMetadata,inputHashes};
}
async function checkDualRuntimeInventory({output='data/audit/dual-node-all-runtimes.json'}={}){
 const inventory=loadSmokeInventory(),startedInputs=inventory.inputHashes(),checks=[];let preview,lastSubmission=0;
 try{
  preview=await startDualPreview({nodes:inventory.placement.nodes.map(node=>({id:node.id,host:node.id,languages:node.languages,remotePort:4197}))});
  async function request(method,pathname,session,body){
   const response=await fetch(preview.origin+pathname,{method,headers:{Authorization:'Bearer '+preview.token,'X-Execution-Session':session,Origin:preview.origin,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)});
   const value=await response.json();return {status:response.status,value};
  }
  const initial=await request('GET','/api/runtimes',crypto.randomBytes(16).toString('hex'));
  assert.equal(initial.status,200);assert.equal(initial.value.available,true);assert.equal(initial.value.complete,true);assert.equal(initial.value.limits.concurrency,2);
  assert.deepEqual(initial.value.runtimes.sort((a,b)=>a.id.localeCompare(b.id)),inventory.expectedMetadata,'Gateway must expose the complete exact verified metadata union');
  for(const language of [...inventory.runtimes.keys()].sort()){
   const sample=inventory.samples.get(language),runtime=inventory.runtimes.get(language),session=crypto.randomBytes(16).toString('hex');
   // One session per language and at most 28 POSTs/minute across both workers.
   await delay(Math.max(0,2200-(Date.now()-lastSubmission)));lastSubmission=Date.now();
   const accepted=await request('POST','/api/executions',session,{language,code:sample.code,stdin:sample.stdin});
   assert.equal(accepted.status,202,language+' submission failed: '+JSON.stringify(accepted.value));assert.match(accepted.value.id,/^[a-f0-9]{32}$/);
   const deadline=Date.now()+60000;let result;
   while(Date.now()<deadline){
    const response=await request('GET','/api/executions/'+accepted.value.id,session);
    assert.equal(response.status,200,language+' polling failed: '+JSON.stringify(response.value));
    if(FINAL.has(response.value.state)){result=response.value;break}await delay(150);
   }
   assert.ok(result,language+' did not finish within 60 seconds');
   assert.equal(result.state,'completed',language+' did not complete: '+JSON.stringify({state:result.state,stderr:result.stderr,compilerStderr:result.compilerStderr}));
   assert.equal(result.stdout,sample.stdout,language+' output differs from its recorded positive');assert.equal(result.exitCode,0,language+' returned nonzero');assert.equal(result.runtimeVersion,runtime.version,language+' runtime version differs from fixed manifest');
   checks.push({language,node:inventory.assigned.get(language),sample:sample.name,evidence:sample.evidence,codeSha256:hash(sample.code),stdinSha256:hash(sample.stdin),state:result.state,stdout:result.stdout,runtimeVersion:result.runtimeVersion,elapsedMs:result.elapsedMs,compileMs:result.compileMs??null,runMs:result.runMs??null,compilerDiagnosticBytes:Buffer.byteLength((result.compilerStdout||'')+(result.compilerStderr||''))});
   console.log('PASS '+language+' on '+inventory.assigned.get(language));
  }
  const final=await request('GET','/api/runtimes',crypto.randomBytes(16).toString('hex'));assert.equal(final.status,200);assert.equal(final.value.complete,true);assert.deepEqual(final.value.runtimes.sort((a,b)=>a.id.localeCompare(b.id)),inventory.expectedMetadata);
  assert.deepEqual(inventory.inputHashes(),startedInputs,'Source inputs or sample evidence changed during full inventory smoke');
 }finally{if(preview)await preview.stop()}
 assert.equal(checks.length,56);
 const report={schemaVersion:1,checkedAt:new Date().toISOString(),scope:'One positive real execution per all 56 fixed private-remote runtimes through a temporary unified gateway and two SSH-connected Docker workers. Includes the original 19-remote baseline and all 37 B-group runtimes. Uses existing recorded code/stdin/output, fresh isolated credentials and per-language sessions. This is an inventory/metadata/routing smoke regression, not full semantics, error/resource/concurrency validation for every language, and not production deployment or production HTTPS acceptance. No production credentials were read.',nodes:inventory.placement.nodes.map(node=>({id:node.id,languages:node.languages})),runtimeCount:checks.length,checks,inputs:startedInputs};
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log('PASS '+checks.length+' actual dual-node runtime inventory smoke checks; report '+output);return report;
}
module.exports={loadSmokeInventory,checkDualRuntimeInventory};
if(require.main===module){const args=process.argv.slice(2);let output;for(let i=0;i<args.length;i++){if(args[i]==='--output'&&args[i+1])output=args[++i];else throw new Error('Expected --output <report.json>')}checkDualRuntimeInventory({output}).catch(error=>{console.error(error.stack);process.exitCode=1})}
