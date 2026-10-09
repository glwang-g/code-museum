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
  const fetch=async()=>{requests.push(++calls);return {ok:true,json:async()=>({available:true,runtimes:[{id:'python',version:'Python 3.13.16',source:'https://example.test'}]})}};
  vm.runInNewContext(source('execution-modes.js'),{window,document:{getElementById:get},fetch,crypto:require('node:crypto'),AbortSignal,setTimeout,Date});
  await new Promise(resolve=>setImmediate(resolve));
  window.MUSEUM_EXECUTION.show('python');get('lab-execution-mode').value='local';get('lab-execution-mode').onchange();
  assert.equal(get('lab-execution-mode').value,'local');assert.equal(get('lab-enable-local').hidden,false);assert.equal(get('lab-remote-access').hidden,true);
  get('lab-execution-mode').value='remote';get('lab-execution-mode').onchange();assert.equal(get('lab-execution-mode').value,'remote');
  get('lab-runtime-credit').hidden=true;get('lab-runtime-credit').textContent='';window.MUSEUM_EXECUTION.show('rust');
  assert.equal(get('lab-runtime-credit').hidden,true);assert.equal(get('lab-runtime-credit').textContent,'');
  assert.ok(states.some(([id,mode,value])=>id==='python'&&mode==='remote'&&value.stage==='waiting-token'));
});
test('remote runtime stages follow API queue/run/results and a failed request can retry',async()=>{
  const elements=new Map(),states=[];let polled=0,fail=false;
  const get=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:false,dataset:{},options:new Map(),addEventListener(){},querySelector(s){if(!this.options.has(s))this.options.set(s,{});return this.options.get(s)}});return elements.get(id)};
  const window={MUSEUM_EXECUTION_CONFIG:{enabled:true,endpoint:'/api'},MUSEUM_RUNTIME_STATUS:{select(){},update:(...args)=>states.push(args)}};
  const fetch=async(url,options={})=>{
    if(fail&&options.method==='POST')throw Error('Connection interrupted');
    const data=url==='/api/runtimes'?{available:true,runtimes:[{id:'python',version:'Python 3.13.16'}]}:options.method==='POST'?(polled=0,{id:'test-job',state:'queued'}):++polled===1?{id:'test-job',state:'running'}:{id:'test-job',state:'completed',stdout:'42',elapsedMs:12,runtimeVersion:'Python 3.13.16'};
    return {ok:true,json:async()=>data};
  };
  vm.runInNewContext(source('execution-modes.js'),{window,document:{getElementById:get},fetch,crypto:require('node:crypto'),AbortSignal,setTimeout:callback=>queueMicrotask(callback),Date});
  await new Promise(resolve=>setImmediate(resolve));window.MUSEUM_EXECUTION.show('python');get('lab-remote-token').value='test-token-'.repeat(4);
  await window.MUSEUM_EXECUTION.run('python','print(42)');
  for(const stage of ['submitting','queued','running','completed'])assert.ok(states.some(([,mode,value])=>mode==='remote'&&value.stage===stage));
  assert.equal(get('lab-result').textContent,'42');assert.equal(states.at(-1)[2].version,'Python 3.13.16');
  fail=true;await window.MUSEUM_EXECUTION.run('python','print(42)');assert.equal(states.at(-1)[2].stage,'failed');assert.match(states.at(-1)[2].detail,/Connection interrupted/);
  fail=false;await window.MUSEUM_EXECUTION.retry('python','print(42)');assert.equal(states.at(-1)[2].stage,'completed');
});
