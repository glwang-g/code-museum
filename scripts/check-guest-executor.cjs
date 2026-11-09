// Opt-in anonymous execution acceptance. Never reads a production credential.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {startDualPreview}=require('./dual-executor-preview.cjs');
const {loadSmokeInventory}=require('./check-dual-runtime-inventory.cjs');
const root=path.resolve(__dirname,'..'),PRODUCTION='https://codemuseum.freexlib.com';
const FINAL=new Set(['completed','failed','compile_error','compile_timed_out','timed_out','cancelled','output_limit','memory_limit','infrastructure_error']);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function guestClient(origin){
 let cookie='';
 return async function request(method,pathname,body,headers={}){
  let response;
  try{response=await fetch(origin+pathname,{method,headers:{Origin:origin,Accept:'application/json',...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(12000)})}
  catch{const error=new Error('Guest '+method+' '+pathname.replace(/[a-f0-9]{32}/g,'<owned-job>')+' transport failed; no submission was retried');error.transport=true;throw error}
  const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];
  const raw=await response.text();assert.ok(Buffer.byteLength(raw)<=262144,'Bounded gateway response');
  return {status:response.status,value:JSON.parse(raw),retryAfter:response.headers.get('retry-after'),cookieIssued:!!set};
 };
}
async function checkGuestExecutor({origin,output='tmp/guest-executor/report.json',languages,resources=false}={}){
 if(origin){const parsed=new URL(origin);if(parsed.origin!==origin||origin!==PRODUCTION&&!(parsed.protocol==='http:'&&parsed.hostname==='127.0.0.1'))throw new Error('Expected approved production origin or loopback preview')}
 const inventory=loadSmokeInventory(),selected=languages||[...inventory.runtimes.keys()].sort();
 if(!selected.length||new Set(selected).size!==selected.length||selected.some(id=>!inventory.runtimes.has(id)))throw new Error('Expected unique configured languages');
 const checks=[],inputFiles=['scripts/check-guest-executor.cjs','server/execution_gateway.py','server/executor.py','server/deploy/gvisor-runtime.json'];
 const inputs=()=>({...inventory.inputHashes(),...Object.fromEntries(inputFiles.map(file=>[file,hash(fs.readFileSync(path.join(root,file)))]))});
 const startedInputs=inputs();let preview,lastPost=0,index=0,phase='initialization',pollRetries=0;
 try{
  if(!origin){preview=await startDualPreview({guestSessions:5,runtime:'runsc',nodes:inventory.placement.nodes.map(node=>({id:node.id,host:node.id,languages:node.languages,remotePort:4197}))});origin=preview.origin}
  const clients=Array.from({length:5},()=>guestClient(origin));
  const pace=async()=>{await delay(Math.max(0,2300-(Date.now()-lastPost)));lastPost=Date.now()};
  async function metadata(){const response=await clients[0]('GET','/api/runtimes');assert.equal(response.status,200);assert.equal(response.value.private,false);assert.equal(response.value.available,true);assert.equal(response.value.complete,true);assert.deepEqual(response.value.access,{mode:'guest',maxSessions:5,idleSeconds:300});assert.equal(response.value.limits.concurrency,2);assert.deepEqual([...response.value.runtimes].sort((a,b)=>a.id.localeCompare(b.id)),inventory.expectedMetadata);return response.value}
  await metadata();checks.push({name:'Exact 56-runtime metadata; five guest leases and two actual worker slots',passed:true});
  async function poll(client,job){const deadline=Date.now()+65000;let failures=0;while(Date.now()<deadline){let response;try{response=await client('GET','/api/executions/'+job.id)}catch(error){if(!error.transport||failures++>=3)throw error;pollRetries++;await delay(250);continue}if(response.status===503&&failures++<3){pollRetries++;await delay(250);continue}assert.equal(response.status,200,JSON.stringify(response.value));failures=0;if(FINAL.has(response.value.state))return response.value;await delay(180)}throw new Error('Guest execution timed out without a final response')}
  async function submit(client,language,code,stdin=''){await pace();const response=await client('POST','/api/executions',{language,code,stdin});assert.equal(response.status,202,language+': '+JSON.stringify(response.value));assert.match(response.value.id,/^[a-f0-9]{32}$/);return response.value}
  async function run(name,language,code,stdout,state='completed',stdin=''){
   phase=name;
   const client=clients[index++%clients.length],job=await submit(client,language,code,stdin),result=await poll(client,job);
   assert.equal(result.state,state,name+': '+JSON.stringify(result));if(stdout!==null)assert.equal(result.stdout,stdout,name);
   assert.ok(Buffer.byteLength(['stdout','stderr','compilerStdout','compilerStderr'].map(field=>result[field]||'').join(''))<=32768);
   checks.push({name,language,node:inventory.assigned.get(language),state:result.state,stdout:result.stdout,elapsedMs:result.elapsedMs,compileMs:result.compileMs??null,runMs:result.runMs??null,codeSha256:hash(code),stdinSha256:hash(stdin)});console.log('PASS guest '+name);return {client,job,result};
  }
  for(const language of selected){const sample=inventory.samples.get(language);const {result}=await run('Fixed positive '+language,language,sample.code,sample.stdout,'completed',sample.stdin);assert.equal(result.runtimeVersion,inventory.runtimes.get(language).version);assert.equal(result.exitCode,0)}
  if(resources){
   await run('Non-root, read-only root and absent Docker socket','python',"import os\nprint(os.getuid())\nprint(os.path.exists('/var/run/docker.sock'))\ntry: open('/etc/cm-guest-probe','w')\nexcept OSError: print('root blocked')",'65534\nFalse\nroot blocked\n');
   await run('No Internet or cloud metadata network','python',"import socket\nfor host in ['1.1.1.1','169.254.169.254']:\n try: socket.create_connection((host,80),timeout=.3); print('unexpected')\n except OSError: print('blocked')",'blocked\nblocked\n');
   await run('Bounded temporary filesystem','python',"try:\n for i in range(20): open('/work/f'+str(i),'wb').write(b'x'*2000000)\nexcept OSError: print('disk bounded')",'disk bounded\n');
   await run('Bounded output','python',"print('x'*200000)",null,'output_limit');
   await run('Wall-clock timeout','python','while True: pass',null,'timed_out');
   await run('Bounded memory','python','x=bytearray(600*1024*1024); print(len(x))',null,'memory_limit');
   await run('Guest process and thread limit','python',"import resource,threading\nprint(resource.getrlimit(resource.RLIMIT_NPROC)==(32,32))\ngate=threading.Event();threads=[]\ntry:\n for i in range(100):\n  t=threading.Thread(target=gate.wait);t.start();threads.append(t)\nexcept RuntimeError: print('tasks bounded',len(threads)<32)\nfinally:\n gate.set()\n for t in threads: t.join()",'True\ntasks bounded True\n');
   await run('Compiler rejection does not execute','bcpl','GET "libhdr"\nLET start( =\n','', 'compile_error');
   const {client,job}=await run('Owned final route','python','print(84)','84\n');
   const foreign=clients.find(row=>row!==client);assert.equal((await foreign('GET','/api/executions/'+job.id)).status,404);assert.equal((await foreign('DELETE','/api/executions/'+job.id)).status,404);
   for(const request of [client,guestClient(origin)]){assert.equal((await request('GET','/api/executor-status')).status,401);assert.equal((await request('POST','/mcp',{jsonrpc:'2.0',id:1,method:'tools/list'})).status,401)}
   checks.push({name:'Guest task isolation; private metrics and MCP remain authenticated',passed:true});
   const cancelled=await submit(client,'python','while True: pass');await delay(400);assert.equal((await client('DELETE','/api/executions/'+cancelled.id)).status,200);assert.equal((await poll(client,cancelled)).state,'cancelled');checks.push({name:'Guest cancellation reaches its original worker',passed:true});
   if(preview){
    await preview.restartGateway();assert.equal((await client('GET','/api/executions/'+job.id)).value.stdout,'84\n');checks.push({name:'Gateway restart retains signed guest identity and original route',passed:true});
    await preview.nodes.xshow2.pause();await delay(1200);const partial=await client('GET','/api/runtimes');assert.equal(partial.value.complete,false);assert.equal(partial.value.runtimes.length,42);
    await run('Healthy node during xshow2 outage','python','print(123)','123\n');await preview.nodes.xshow2.resume();await delay(1200);await metadata();await run('Recovered xshow2 node','bcpl','GET "libhdr"\nLET start()=VALOF { writef("42*n"); RESULTIS 0 }\n','42\n');
   }
  }
  // Fill any unused leases with real valid submissions, then check a fresh sixth client.
  if(selected.length<5){for(let i=selected.length;i<5;i++)await poll(clients[i],await submit(clients[i],'python','print(42)'))}
  await pace();const full=await guestClient(origin)('POST','/api/executions',{language:'python',code:'print(42)',stdin:''});assert.equal(full.status,429);assert.equal(full.value.code,'guest_capacity');assert.equal(full.value.error,'当前访问比较多，请稍后重试。');assert.ok(Number(full.retryAfter)>0);assert.equal(full.cookieIssued,false);checks.push({name:'Sixth guest is rejected once with the requested busy message and Retry-After',passed:true});
  await metadata();assert.deepEqual(inputs(),startedInputs,'Verification inputs changed during acceptance');
 }catch(error){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({schemaVersion:1,checkedAt:new Date().toISOString(),pass:false,phase,scope:'Incomplete guest acceptance; only the listed completed checks are evidence. No claim of full inventory success.',checks,inputs:startedInputs},null,2)+'\n');throw error}
 finally{if(preview)await preview.stop()}
 const report={schemaVersion:1,checkedAt:new Date().toISOString(),pass:true,scope:'Anonymous cookie-based execution through the guest gateway, whose health contract requires runsc worker metadata; no production credential. Temporary mode explicitly launches real xshow/xshow2 workers with runsc. One fixed positive per selected language, optional explicit resource/lifecycle checks. Only GET queries of an already accepted job may retry transient transport/503 errors (at most three consecutively); POST is never repeated. Temporary mode never changes permanent executor services. No cookies, job IDs or source text retained. This is not a container escape or full-language conformance assessment.',origin:preview?'temporary dual-node loopback preview':origin,runtimeCount:selected.length,fullInventory:selected.length===56,resources,pollRetries,checks,inputs:startedInputs};fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log('PASS '+checks.length+' guest executor checks; '+output);return report;
}
module.exports={guestClient,checkGuestExecutor};
if(require.main===module){const args=process.argv.slice(2);let origin,output,languages,resources=false;for(let i=0;i<args.length;i++){if(args[i]==='--origin'&&args[i+1])origin=args[++i];else if(args[i]==='--output'&&args[i+1])output=args[++i];else if(args[i]==='--language'&&args[i+1])(languages||=[]).push(args[++i]);else if(args[i]==='--resources')resources=true;else throw new Error('Unsupported guest executor check argument')}checkGuestExecutor({origin,output,languages,resources}).catch(error=>{console.error(error.stack);process.exitCode=1})}
