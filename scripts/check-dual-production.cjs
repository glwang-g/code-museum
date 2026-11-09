// Opt-in backend HTTPS acceptance against the one approved production origin.
// Reads only the existing public execution token into process memory; never logs it.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {spawn,execFileSync}=require('node:child_process');
const {loadSmokeInventory}=require('./check-dual-runtime-inventory.cjs');
const root=path.resolve(__dirname,'..'),PRODUCTION_ORIGIN='https://codemuseum.freexlib.com';
const FINAL=new Set(['completed','failed','compile_error','compile_timed_out','timed_out','cancelled','output_limit','memory_limit','infrastructure_error']);
const delay=ms=>new Promise(ok=>setTimeout(ok,ms)),hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const shellQuote=value=>"'"+value.replaceAll("'","'\\''")+"'";
function readPublicExecutionToken(){
 const program=String.raw`import shlex,sys
from pathlib import Path
values=[]
for line in Path('/etc/code-museum-executor/private.env').read_text().splitlines():
 fields=shlex.split(line,comments=True,posix=True)
 for field in fields:
  if field.startswith('EXECUTOR_TOKEN='): values.append(field.partition('=')[2])
if len(values)!=1 or len(values[0])<32 or any(ord(c)<33 or ord(c)>126 for c in values[0]): raise SystemExit('Invalid private execution token configuration')
sys.stdout.write(values[0])
`;
 let value;
 try{value=execFileSync('ssh',['-T','-o','BatchMode=yes','-o','ConnectTimeout=10','xshow','sudo -n python3 -c '+shellQuote(program)],{encoding:'utf8',timeout:25000,stdio:['ignore','pipe','pipe']})}
 catch{throw new Error('Unable to read existing execution credential through approved xshow administrator connection')}
 if(typeof value!=='string'||value.length<32||!/^[\x21-\x7e]+$/.test(value))throw new Error('Invalid existing execution credential');
 return value;
}
function createProductionClient(token){
 if(token!==undefined&&(typeof token!=='string'||token.length<32||!/^[\x21-\x7e]+$/.test(token)))throw new Error('Invalid execution credential');
 return async function request(method,pathname,session,body){
  if(!['GET','POST','DELETE'].includes(method)||!/^\/api\/(?:runtimes|executor-status|executions(?:\/[a-f0-9]{32})?)$/.test(pathname))throw new Error('Unsupported production check request');
  if(pathname!=='/api/runtimes'&&(!token||!/^[a-f0-9]{32}$/.test(session||'')))throw new Error('Private execution credential/session required');
  const headers={Origin:PRODUCTION_ORIGIN,Accept:'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(session?{'X-Execution-Session':session}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})};
  let response;
  try{response=await fetch(PRODUCTION_ORIGIN+pathname,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(12000)})}
  catch{throw new Error('Production HTTPS request failed; no retry or failover was performed')}
  if(response.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new Error('Production execution endpoint returned a non-JSON response');
  const raw=await response.text();if(Buffer.byteLength(raw)>262144)throw new Error('Production execution response exceeded limit');
  let value;try{value=JSON.parse(raw)}catch{throw new Error('Production execution endpoint returned invalid JSON')}
  return {status:response.status,value};
 };
}
function verifyProductionMetadata(value,expectedMetadata){
 assert.equal(value.available,true,'Production gateway must be available');assert.equal(value.complete,true,'Both production workers must be healthy');assert.equal(value.private,true);
 assert.equal(value.limits.concurrency,2);assert.equal(value.limits.seconds,8,'Configured maximum run budget must include Groovy startup');assert.equal(value.limits.outputBytes,32768);assert.equal(value.limits.network,false);
 assert.deepEqual([...value.runtimes].sort((a,b)=>a.id.localeCompare(b.id)),expectedMetadata,'Production runtime metadata must match the complete fixed inventory');
 assert.equal(Math.max(...value.runtimes.map(row=>row.runSeconds)),8);assert.equal(value.runtimes.length,56);return {runtimeCount:56,concurrency:2,maxRunSeconds:8,complete:true};
}
async function until(predicate,message,seconds=40){const end=Date.now()+seconds*1000;while(Date.now()<end){if(await predicate())return;await delay(150)}throw new Error(message)}
async function productionBrowserChecks({token,screenshots,checks,pace}){
 const chrome=process.env.CHROME_BIN||'/Applications/GoogleChrome.app/Contents/MacOS/Google Chrome',profile=fs.mkdtempSync(path.join(os.tmpdir(),'museum-dual-production-browser-'));
 let browser,session,sequence=0,buffer='';const pending=new Map();
 function send(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(new Error('Production Chrome command timed out: '+method))},20000);pending.set(id,{resolve,reject,timer});browser.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0')})}
 const page=(method,params)=>send(method,params,session);
 async function evaluate(expression){const result=await page('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error('Production Chrome page evaluation failed');return result.result.value}
 async function wait(expression,message){await until(()=>evaluate(expression),message||'Production Chrome page condition timed out')}
 async function edit(code){await evaluate(`(()=>{const input=document.querySelector('#lab-code');input.value=${JSON.stringify(code)};input.dispatchEvent(new Event('input',{bubbles:true}))})()`)}
 async function run(expected){await pace();await evaluate(`document.querySelector('#lab-run').click()`);await wait(`document.querySelector('#lab-result').dataset.state==='ok'&&document.querySelector('#lab-result').textContent===${JSON.stringify(expected)}`,'Production Chrome did not show expected real execution output')}
 async function screenshot(name){await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');const result=await page('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(screenshots,name),Buffer.from(result.data,'base64'))}
 try{
  browser=spawn(chrome,['--headless=new','--disable-gpu','--disable-background-networking','--no-first-run','--no-default-browser-check','--remote-debugging-pipe','--user-data-dir='+profile],{stdio:['ignore','ignore','pipe','pipe','pipe']});
  browser.on('error',()=>{for(const request of pending.values()){clearTimeout(request.timer);request.reject(new Error('Unable to start installed Chrome'))}pending.clear()});browser.stderr.resume();
  browser.stdio[4].on('data',chunk=>{buffer+=chunk.toString();let end;while((end=buffer.indexOf('\0'))!==-1){const message=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);const request=pending.get(message.id);if(request){pending.delete(message.id);clearTimeout(request.timer);message.error?request.reject(new Error('Production Chrome protocol command failed')):request.resolve(message.result)}}});
  const version=await send('Browser.getVersion'),target=await send('Target.createTarget',{url:'about:blank'});session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
  await page('Page.enable');await page('Runtime.enable');
  await page('Page.addScriptToEvaluateOnNewDocument',{source:'window.__productionCheckPosts=0;const originalFetch=window.fetch;window.fetch=(url,options)=>{if(options?.method===\'POST\')window.__productionCheckPosts++;return originalFetch(url,options)};'});
  await page('Page.navigate',{url:PRODUCTION_ORIGIN+'/#lab'});await wait(`document.readyState!=='loading'&&!!window.MUSEUM_LAB&&!!window.MUSEUM_EXECUTION`);
  await evaluate(`document.querySelector('#lab-remote-token').value=${JSON.stringify(token)}`);await wait(`window.MUSEUM_EXECUTION.canRun('python')&&window.MUSEUM_EXECUTION.canRun('sql')`);
  for(const width of [1440,390]){
   await page('Emulation.setDeviceMetricsOverride',{width,height:width===1440?1000:844,mobile:width===390,deviceScaleFactor:1});await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(width===1440?'dark':'light')}`);
   for(const [language,code,stdin,expected] of [['python','print(input()); print(6*7)\n','博物馆\n','博物馆\n42\n'],['sql','SELECT 6 * 7;\n','','42\n']]){
    await evaluate(`window.MUSEUM_LAB.open(${JSON.stringify(language)});document.querySelector('#lab-stdin').value=${JSON.stringify(stdin)}`);const before=await evaluate('window.__productionCheckPosts');await edit(code);await delay(700);assert.equal(await evaluate('window.__productionCheckPosts'),before,'Editing must not automatically POST code');await run(expected);assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await evaluate(`document.querySelector('#lab-result').scrollIntoView({block:'center'})`);await screenshot('production-'+language+'-'+width+'.png');checks.push({kind:'served-frontend-browser',language,width,name:'Existing served frontend executes through production HTTPS gateway without automatic editing submission',stdout:expected});
   }
  }
  await evaluate(`window.MUSEUM_LAB.open('python');document.querySelector('#lab-stdin').value=''`);await edit('raise RuntimeError("museum production acceptance")\n');await pace();await evaluate(`document.querySelector('#lab-run').click()`);await wait(`document.querySelector('#lab-result').dataset.state==='error'`);assert.ok(await evaluate(`document.querySelector('#lab-result').textContent.includes('museum production acceptance')`));checks.push({kind:'served-frontend-browser',language:'python',name:'Actual production runtime error appears in existing served frontend',passed:true});
  await edit('print(84)\n');await run('84\n');await screenshot('production-python-recovery-390.png');checks.push({kind:'served-frontend-browser',language:'python',name:'Existing served frontend recovers after real runtime error',stdout:'84\n'});
  const resources=await evaluate(`Array.from(new Set(performance.getEntriesByType('resource').map(entry=>entry.name).filter(name=>name.startsWith(location.origin+'/')).map(name=>new URL(name).pathname).filter(path=>!path.startsWith('/api/')&&path!=='/mcp'))).sort()`);
  const servedResources=[];
  // Capture current HTTPS response bodies only. Never compare the served release with local dist.
  for(const resource of ['/',...resources]){
   if(!resource.startsWith('/')||resource.startsWith('//')||resource.includes('..'))continue;
   const response=await fetch(PRODUCTION_ORIGIN+resource,{redirect:'error',signal:AbortSignal.timeout(15000)});assert.ok(response.ok,'Served resource unavailable');const body=Buffer.from(await response.arrayBuffer());servedResources.push({path:resource,bytes:body.length,sha256:hash(body)});
  }
  return {browser:version.product,servedResources,servedResourceScope:'HTTPS GET response bodies observed after browser acceptance; no comparison against local dist or claim that the frontend has been republished.'};
 }finally{
  for(const request of pending.values()){clearTimeout(request.timer);request.reject(new Error('Production browser closed'))}pending.clear();
  if(browser?.pid&&browser.exitCode===null&&browser.signalCode===null)await new Promise(ok=>{const timer=setTimeout(()=>browser.kill('SIGKILL'),5000);browser.once('exit',()=>{clearTimeout(timer);ok()});browser.kill('SIGTERM')});fs.rmSync(profile,{recursive:true,force:true});
 }
}
async function checkDualProduction({output='data/audit/dual-node-production-checks.json',screenshots='tmp/dual-node-production-browser',metadataOnly=false,languages,browser}={}){
 const inventory=loadSmokeInventory();
 if(languages!==undefined&&(!Array.isArray(languages)||!languages.length||new Set(languages).size!==languages.length||languages.some(language=>!inventory.runtimes.has(language))))throw new Error('Expected unique configured --language IDs');
 const inputHashes=()=>({...inventory.inputHashes(),'scripts/check-dual-production.cjs':hash(fs.readFileSync(__filename))});const startedInputs=inputHashes(),checks=[];
 let token,request=createProductionClient(),lastSubmission=0,browserEvidence=null;
 const pace=async()=>{await delay(Math.max(0,2200-(Date.now()-lastSubmission)));lastSubmission=Date.now()};
 const initial=await request('GET','/api/runtimes');assert.equal(initial.status,200);const metadata=verifyProductionMetadata(initial.value,inventory.expectedMetadata);checks.push({kind:'backend-metadata',name:'Formal HTTPS gateway exposes complete exact 56-runtime union',...metadata});
 const selected=metadataOnly?[]:(languages||[...inventory.runtimes.keys()].sort());
 if(!metadataOnly){
  token=readPublicExecutionToken();request=createProductionClient(token);
  for(const language of selected){
   const sample=inventory.samples.get(language),runtime=inventory.runtimes.get(language),session=crypto.randomBytes(16).toString('hex');await pace();
   const accepted=await request('POST','/api/executions',session,{language,code:sample.code,stdin:sample.stdin});assert.equal(accepted.status,202,language+' submission was not accepted');assert.match(accepted.value.id,/^[a-f0-9]{32}$/);
   const deadline=Date.now()+60000;let result;
   while(Date.now()<deadline){const response=await request('GET','/api/executions/'+accepted.value.id,session);assert.equal(response.status,200,language+' result was unavailable');if(FINAL.has(response.value.state)){result=response.value;break}await delay(150)}
   assert.ok(result,language+' did not finish within 60 seconds');assert.equal(result.state,'completed',language+' did not complete');assert.equal(result.stdout,sample.stdout,language+' output differs from recorded positive');assert.equal(result.exitCode,0);assert.equal(result.runtimeVersion,runtime.version,language+' runtime version differs');
   checks.push({kind:'backend-positive',language,node:inventory.assigned.get(language),sample:sample.name,evidence:sample.evidence,codeSha256:hash(sample.code),stdinSha256:hash(sample.stdin),state:result.state,stdout:result.stdout,runtimeVersion:result.runtimeVersion,elapsedMs:result.elapsedMs,compileMs:result.compileMs??null,runMs:result.runMs??null,compilerDiagnosticBytes:Buffer.byteLength((result.compilerStdout||'')+(result.compilerStderr||''))});console.log('PASS production '+language);
  }
  if(browser??!languages?.length){fs.mkdirSync(screenshots,{recursive:true});browserEvidence=await productionBrowserChecks({token,screenshots,checks,pace})}
 }
 const final=await request('GET','/api/runtimes');assert.equal(final.status,200);verifyProductionMetadata(final.value,inventory.expectedMetadata);assert.deepEqual(inputHashes(),startedInputs,'Approved implementation or recorded sample inputs changed during production acceptance');
 const report={schemaVersion:1,checkedAt:new Date().toISOString(),origin:PRODUCTION_ORIGIN,scope:'Backend-only production HTTPS acceptance of the approved dual-node execution gateway. Runs one existing recorded positive per selected runtime; a full default run covers all 56. Does not install, restart, pause nodes, change routing, or publish the frontend. Browser checks, if enabled, use the frontend already served at the production origin; observed resource hashes are evidence of that served release and are not compared with local dist. No credentials, sessions or job identifiers retained.',metadataOnly,runtimeCount:selected.length,expectedRuntimeCount:56,fullInventory:!metadataOnly&&selected.length===56,nodes:inventory.placement.nodes.map(node=>({id:node.id,languages:node.languages})),checks,...(browserEvidence||{}),inputs:startedInputs};
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log('PASS '+checks.length+' production HTTPS checks; report '+output);return report;
}
module.exports={PRODUCTION_ORIGIN,readPublicExecutionToken,createProductionClient,verifyProductionMetadata,checkDualProduction};
if(require.main===module){const args=process.argv.slice(2);let output,screenshots,metadataOnly=false,languages,browser;for(let i=0;i<args.length;i++){if(args[i]==='--output'&&args[i+1])output=args[++i];else if(args[i]==='--screenshots'&&args[i+1])screenshots=args[++i];else if(args[i]==='--metadata-only')metadataOnly=true;else if(args[i]==='--language'&&args[i+1])(languages||=[]).push(args[++i]);else if(args[i]==='--browser')browser=true;else if(args[i]==='--skip-browser')browser=false;else throw new Error('Unsupported production check argument')}checkDualProduction({output,screenshots,metadataOnly,languages,browser}).catch(error=>{console.error(error.stack);process.exitCode=1})}
