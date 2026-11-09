const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=name=>fs.readFileSync(path.join(__dirname,'../src',name),'utf8');
function ui(){
  const elements=new Map();
  const get=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:false,dataset:{},textContent:'',removeAttribute(name){delete this[name]}});return elements.get(id)};
  const window={MUSEUM_RUNTIME_ASSETS:{python:{version:'Pyodide test'}}};
  vm.runInNewContext(source('runtime-status.js'),{window,document:{getElementById:get}});
  return {get,status:window.MUSEUM_RUNTIME_STATUS};
}
test('runtime state separates local/remote and displays measured progress and retry',()=>{
  const {get,status}=ui();status.select('python','local');
  status.update('python','local',{stage:'downloading',loaded:1024,total:4096,detail:'读取资源'});
  assert.equal(get('lab-state-label').textContent,'读取资源');assert.equal(get('lab-state-progress').value,1024);assert.equal(get('lab-state-progress').max,4096);
  status.select('python','remote');status.update('python','remote',{stage:'queued',version:'Python 3.13.16'});
  assert.equal(get('lab-state-label').textContent,'排队中');assert.equal(get('lab-state-version').textContent,'远端 · Python 3.13.16');assert.equal('value' in get('lab-state-progress'),false);
  status.update('python','local',{stage:'completed'});assert.equal(get('lab-state-label').textContent,'排队中');
  status.update('python','remote',{stage:'failed',retryLabel:'重试运行'});assert.equal(get('lab-runtime-retry').hidden,false);
  let retried;status.configure((id,mode)=>{retried=[id,mode]});get('lab-runtime-retry').onclick();assert.deepEqual(retried,['python','remote']);
});
test('core resource observation preserves streamed bytes and reports initialization without fake progress',async()=>{
  const messages=[],payload=Uint8Array.from({length:1024},(_,i)=>i%256);
  const original=async()=>new Response(payload,{headers:{'Content-Type':'application/wasm','Content-Encoding':'br'}});
  const context={fetch:original,URL,ReadableStream,Response,Date,location:{href:'https://museum.test/python-worker.js'}};
  vm.runInNewContext(source('runtime-progress.js'),context);
  context.MUSEUM_RUNTIME_PROGRESS.start({'core.wasm':1024},message=>messages.push(message));
  const response=await context.fetch('https://museum.test/assets/core.wasm');
  assert.equal(response.headers.get('Content-Type'),'application/wasm');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()),payload);
  assert.equal(messages[0].loaded,0);assert.equal(messages.at(-1).loaded,1024);assert.equal(messages.at(-1).total,1024);assert.equal(messages.at(-1).stage,'initializing');
  const count=messages.length;await (await context.fetch('https://museum.test/other.wasm')).arrayBuffer();assert.equal(messages.length,count);
  context.MUSEUM_RUNTIME_PROGRESS.stop();assert.equal(context.fetch,original);
});
test('execution mode changes survive cancellation redraw and unhandled languages retain their credits',async()=>{
  const elements=new Map(),states=[];
  const get=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:false,dataset:{},textContent:'',options:new Map(),listeners:new Map(),addEventListener(type,fn){this.listeners.set(type,fn)},querySelector(s){if(!this.options.has(s))this.options.set(s,{});return this.options.get(s)}});return elements.get(id)};
  const window={MUSEUM_EXECUTION_CONFIG:{enabled:true,endpoint:'/api'},MUSEUM_RUNTIME_STATUS:{select(){},update:(...args)=>states.push(args)}};
  const requests=[];let calls=0;
  const fetch=async()=>{requests.push(++calls);return {ok:true,json:async()=>({available:true,private:false,access:{mode:'guest',maxSessions:5,idleSeconds:300},runtimes:[{id:'python',version:'Python 3.13.16',source:'https://example.test'}]})}};
  vm.runInNewContext(source('execution-modes.js'),{window,document:{getElementById:get},fetch,crypto:require('node:crypto'),AbortSignal,setTimeout,Date});
  await new Promise(resolve=>setImmediate(resolve));
  window.MUSEUM_EXECUTION.show('python');get('lab-execution-mode').value='local';get('lab-execution-mode').onchange();
  assert.equal(get('lab-execution-mode').value,'local');assert.equal(get('lab-enable-local').hidden,false);assert.equal(get('lab-remote-access').hidden,true);
  get('lab-execution-mode').value='remote';get('lab-execution-mode').onchange();assert.equal(get('lab-execution-mode').value,'remote');
  get('lab-runtime-credit').hidden=true;get('lab-runtime-credit').textContent='';window.MUSEUM_EXECUTION.show('rust');
  assert.equal(get('lab-runtime-credit').hidden,true);assert.equal(get('lab-runtime-credit').textContent,'');
  assert.ok(states.some(([id,mode,value])=>id==='python'&&mode==='remote'&&value.stage==='ready'));
});
test('remote runtime stages follow API queue/run/results and a failed request can retry',async()=>{
  const elements=new Map(),states=[];let polled=0,fail=false;
  const get=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:false,dataset:{},options:new Map(),addEventListener(){},querySelector(s){if(!this.options.has(s))this.options.set(s,{});return this.options.get(s)}});return elements.get(id)};
  const window={MUSEUM_EXECUTION_CONFIG:{enabled:true,endpoint:'/api'},MUSEUM_RUNTIME_STATUS:{select(){},update:(...args)=>states.push(args)}};
  const fetch=async(url,options={})=>{
    if(fail&&options.method==='POST')throw Error('Connection interrupted');
    const data=url==='/api/runtimes'?{available:true,private:false,access:{mode:'guest',maxSessions:5,idleSeconds:300},runtimes:[{id:'python',version:'Python 3.13.16'}]}:options.method==='POST'?(polled=0,{id:'test-job',state:'queued'}):++polled===1?{id:'test-job',state:'running'}:{id:'test-job',state:'completed',stdout:'42',elapsedMs:12,runtimeVersion:'Python 3.13.16'};
    return {ok:true,json:async()=>data};
  };
  vm.runInNewContext(source('execution-modes.js'),{window,document:{getElementById:get},fetch,crypto:require('node:crypto'),AbortSignal,setTimeout:callback=>queueMicrotask(callback),Date});
  await new Promise(resolve=>setImmediate(resolve));window.MUSEUM_EXECUTION.show('python');
  await window.MUSEUM_EXECUTION.run('python','print(42)');
  for(const stage of ['submitting','queued','running','completed'])assert.ok(states.some(([,mode,value])=>mode==='remote'&&value.stage===stage));
  assert.equal(get('lab-result').textContent,'42');assert.equal(states.at(-1)[2].version,'Python 3.13.16');
  fail=true;await window.MUSEUM_EXECUTION.run('python','print(42)');assert.equal(states.at(-1)[2].stage,'failed');assert.match(states.at(-1)[2].detail,/Connection interrupted/);
  fail=false;await window.MUSEUM_EXECUTION.retry('python','print(42)');assert.equal(states.at(-1)[2].stage,'completed');
});

test('remote compiler diagnostics and timings stay separate and clear on edits and language changes',async()=>{
  const elements=new Map();let broken=false;
  const get=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:false,textContent:'',dataset:{},options:new Map(),addEventListener(){},querySelector(s){if(!this.options.has(s))this.options.set(s,{});return this.options.get(s)}});return elements.get(id)};
  const window={MUSEUM_EXECUTION_CONFIG:{enabled:true,endpoint:'/api'}};
  const fetch=async url=>({ok:true,json:async()=>url==='/api/runtimes'?{available:true,private:false,access:{mode:'guest',maxSessions:5,idleSeconds:300},runtimes:[{id:'rust',version:'rustc test'}]}:{state:broken?'compile_error':'completed',compilerStdout:'',compilerStderr:broken?'compiler syntax diagnostic':'warning: learning warning',stdout:broken?'':'42',stderr:broken?'':'runtime stderr',queueMs:5,compileMs:20,...(broken?{}:{runMs:8}),elapsedMs:50}});
  vm.runInNewContext(source('execution-modes.js'),{window,document:{getElementById:get},fetch,crypto:require('node:crypto'),AbortSignal,setTimeout,Date});
  await new Promise(resolve=>setImmediate(resolve));window.MUSEUM_EXECUTION.show('rust');
  await window.MUSEUM_EXECUTION.run('rust','fn main(){}');
  assert.equal(get('lab-result').textContent,'42\nruntime stderr');assert.equal(get('lab-compiler-result').textContent,'\nwarning: learning warning');assert.equal(get('lab-compiler').open,true);
  assert.match(get('lab-timings').textContent,/排队 5 ms.*编译 20 ms.*运行 8 ms/);
  window.MUSEUM_EXECUTION.edited();assert.equal(get('lab-compiler').hidden,true);assert.equal(get('lab-timings').hidden,true);
  broken=true;await window.MUSEUM_EXECUTION.run('rust','invalid');assert.equal(get('lab-result').textContent.trim(),'编译失败，未执行程序。');assert.match(get('lab-compiler-result').textContent,/compiler syntax/);assert.doesNotMatch(get('lab-timings').textContent,/ · 运行/);
  window.MUSEUM_EXECUTION.show('javascript');assert.equal(get('lab-compiler-result').textContent,'');assert.equal(get('lab-timings').hidden,true);
});

function guestExecution(fetch,{timer=setTimeout}={}){
  const elements=new Map(),requests=[];
  const get=id=>{
    assert.notEqual(id,'lab-remote-token','the visitor UI must not request a token input');
    if(!elements.has(id))elements.set(id,{value:'',hidden:false,dataset:{},textContent:'',options:new Map(),addEventListener(){},querySelector(selector){if(!this.options.has(selector))this.options.set(selector,{});return this.options.get(selector)}});
    return elements.get(id);
  };
  const window={MUSEUM_EXECUTION_CONFIG:{enabled:true,endpoint:'/api'}};
  vm.runInNewContext(source('execution-modes.js'),{window,document:{getElementById:get},fetch:async(url,options)=>{requests.push({url,options});return fetch(url,options)},AbortSignal,setTimeout:timer,Date});
  return {get,execution:()=>window.MUSEUM_EXECUTION,requests};
}
const guestMetadata={available:true,complete:true,private:false,access:{mode:'guest',maxSessions:5,idleSeconds:300},runtimes:[{id:'python',version:'Python test'}]};
test('visitor execution uses same-origin cookies without credentials in JavaScript and never retries a busy submission',async()=>{
  const ui=guestExecution(async(url)=>({ok:url==='/api/runtimes',status:url==='/api/runtimes'?200:429,json:async()=>url==='/api/runtimes'?guestMetadata:{error:'capacity'}}));
  await new Promise(resolve=>setImmediate(resolve));ui.execution().show('python');
  assert.equal(ui.execution().canRun('python'),true);
  await ui.execution().run('python','print(42)');
  assert.match(ui.get('lab-result').textContent,/当前访问比较多，请稍后重试。/);
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(ui.requests.filter(row=>row.options.method==='POST').length,1);
  for(const {options} of ui.requests){assert.equal(options.credentials,'same-origin');assert.equal(options.headers?.Authorization,undefined);assert.equal(options.headers?.['X-Execution-Session'],undefined);}
  await ui.execution().serviceStatus();
  assert.equal(ui.requests.at(-1).url,'/api/runtimes');
  assert.ok(ui.requests.every(row=>row.url!=='/api/executor-status'&&row.url!=='/mcp'));
});
test('private gateway metadata leaves the visitor execution closed and cannot submit code',async()=>{
  const ui=guestExecution(async()=>({ok:true,json:async()=>({...guestMetadata,private:true,access:undefined})}));
  await new Promise(resolve=>setImmediate(resolve));ui.execution().show('python');
  assert.equal(ui.execution().canRun('python'),false);assert.equal(ui.get('lab-run').disabled,true);
  assert.equal(ui.get('lab-execution-info').textContent,'远端执行暂未开放。');
  await ui.execution().run('python','print(42)');assert.equal(ui.requests.length,1);
});
test('uncertain submission asks the visitor to avoid immediate resubmission and does not POST twice',async()=>{
  const ui=guestExecution(async(url)=>({ok:url==='/api/runtimes',status:url==='/api/runtimes'?200:503,json:async()=>url==='/api/runtimes'?guestMetadata:{error:'提交结果暂不可确认。',retrySafe:false}}));
  await new Promise(resolve=>setImmediate(resolve));ui.execution().show('python');await ui.execution().run('python','print(42)');
  assert.match(ui.get('lab-result').textContent,/提交结果暂不确定，请勿立即重复提交/);
  assert.equal(ui.requests.filter(row=>row.options.method==='POST').length,1);
});
test('visitor shell retires the token input and permission application while keeping standard input and public service status',()=>{
  const html=source('index.html');assert.doesNotMatch(html,/lab-remote-token|access-request|私有执行令牌|申请运行权限/);
  assert.match(html,/id="lab-stdin"/);assert.match(html,/id="lab-service-health"/);
  assert.doesNotMatch(source('service-status.js'),/executor-status|Authorization|令牌|metrics\.states/);
});

test('transient job queries recover the original task without submitting code twice',async t=>{
  for(const fault of ['503','timeout','network'])await t.test(fault,async()=>{
    const id='a'.repeat(32);let polls=0;
    const ui=guestExecution(async(url,options)=>{
      if(url==='/api/runtimes')return {ok:true,json:async()=>guestMetadata};
      if(options.method==='POST')return {ok:true,json:async()=>({id,state:'queued'})};
      assert.equal(url,'/api/executions/'+id);
      if(++polls===1){
        if(fault==='503')return {ok:false,status:503,json:async()=>({error:'Original worker temporarily unavailable'})};
        const error=new Error('Temporary network interruption');if(fault==='timeout')error.name='TimeoutError';throw error;
      }
      return {ok:true,json:async()=>({id,state:'completed',stdout:'42',elapsedMs:5})};
    },{timer:callback=>queueMicrotask(callback)});
    await new Promise(resolve=>setImmediate(resolve));ui.execution().show('python');await ui.execution().run('python','print(42)');
    assert.equal(ui.get('lab-result').textContent,'42');assert.equal(ui.get('lab-result').dataset.state,'ok');
    assert.equal(polls,2);assert.equal(ui.requests.filter(({options})=>options.method==='POST').length,1);
    assert.deepEqual([...new Set(ui.requests.filter(({url})=>url.startsWith('/api/executions/')).map(({url})=>url))],['/api/executions/'+id]);
  });
});
test('unauthorized and expired task queries fail once instead of retrying or submitting replacement jobs',async t=>{
  for(const status of [401,404])await t.test(String(status),async()=>{
    const id='b'.repeat(32);let polls=0;
    const ui=guestExecution(async(url,options)=>{
      if(url==='/api/runtimes')return {ok:true,json:async()=>guestMetadata};
      if(options.method==='POST')return {ok:true,json:async()=>({id,state:'queued'})};
      if(options.method==='DELETE')return {ok:true,json:async()=>({id,state:'cancelled'})};
      polls++;return {ok:false,status,json:async()=>({error:'Job is unavailable'})};
    },{timer:callback=>queueMicrotask(callback)});
    await new Promise(resolve=>setImmediate(resolve));ui.execution().show('python');await ui.execution().run('python','print(42)');
    assert.equal(polls,1);assert.equal(ui.get('lab-result').dataset.state,'error');assert.equal(ui.requests.filter(({options})=>options.method==='POST').length,1);
  });
});
test('a persistently unavailable task stops querying after three attempts',async()=>{
  const id='c'.repeat(32);let polls=0;
  const ui=guestExecution(async(url,options)=>{
    if(url==='/api/runtimes')return {ok:true,json:async()=>guestMetadata};
    if(options.method==='POST')return {ok:true,json:async()=>({id,state:'queued'})};
    if(options.method==='DELETE')return {ok:true,json:async()=>({id,state:'cancelled'})};
    polls++;return {ok:false,status:503,json:async()=>({error:'Original worker remains unavailable'})};
  },{timer:callback=>queueMicrotask(callback)});
  await new Promise(resolve=>setImmediate(resolve));ui.execution().show('python');await ui.execution().run('python','print(42)');
  assert.equal(polls,3);assert.equal(ui.requests.filter(({options})=>options.method==='POST').length,1);assert.equal(ui.get('lab-result').dataset.state,'error');assert.match(ui.get('lab-result').textContent,/Original worker remains unavailable/);
});
