// Opt-in real Chrome acceptance for the guest UI. No execution credential is read or injected.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {loadSmokeInventory}=require('./check-dual-runtime-inventory.cjs');
const PRODUCTION='https://codemuseum.freexlib.com',FINAL=new Set(['completed','failed','compile_error','compile_timed_out','timed_out','cancelled','output_limit','memory_limit','infrastructure_error']);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function checkGuestBrowser({origin,output='tmp/guest-browser/report.json',screenshots='tmp/guest-browser',languages=['python','bcpl'],fillCapacity=false}={}){
 const parsed=new URL(origin);
 if(parsed.origin!==origin||origin!==PRODUCTION&&!(parsed.protocol==='http:'&&parsed.hostname==='127.0.0.1'))throw new Error('Expected the approved production origin or a loopback HTTP preview');
 const inventory=loadSmokeInventory();
 if(!languages.length||new Set(languages).size!==languages.length||languages.some(language=>!inventory.samples.has(language)))throw new Error('Expected unique configured language IDs');
 fs.mkdirSync(screenshots,{recursive:true});
 const chrome=process.env.CHROME_BIN||'/Applications/GoogleChrome.app/Contents/MacOS/Google Chrome',profile=fs.mkdtempSync(path.join(os.tmpdir(),'museum-guest-browser-'));
 let browser,session,sequence=0,buffer='';const pending=new Map(),checks=[];
 function send(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(new Error('Chrome command timed out: '+method))},20000);pending.set(id,{resolve,reject,timer});browser.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0')})}
 const page=(method,params)=>send(method,params,session);
 async function evaluate(expression){const result=await page('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error('Guest browser evaluation failed: '+JSON.stringify(result.exceptionDetails));return result.result.value}
 async function until(predicate,message,seconds=65){const end=Date.now()+seconds*1000;while(Date.now()<end){if(await predicate())return;await delay(150)}throw new Error(message)}
 const wait=(expression,message)=>until(()=>evaluate(expression),message||'Guest browser condition timed out: '+expression);
 async function screenshot(name){await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');const result=await page('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(screenshots,name),Buffer.from(result.data,'base64'))}
 async function openTarget(contextId){const target=await send('Target.createTarget',{url:'about:blank',...(contextId?{browserContextId:contextId}:{})});session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;await page('Page.enable');await page('Runtime.enable');await page('Network.enable');await page('Page.addScriptToEvaluateOnNewDocument',{source:`window.__guestChecks={posts:0,paths:[],authorization:false};const guestOriginalFetch=window.fetch;window.fetch=(url,options={})=>{if(options.method==='POST')window.__guestChecks.posts++;window.__guestChecks.paths.push(String(url));if(new Headers(options.headers).has('Authorization'))window.__guestChecks.authorization=true;return guestOriginalFetch(url,options)};`});await page('Page.navigate',{url:origin+'/#lab'});await wait(`document.readyState!=='loading'&&!!window.MUSEUM_LAB&&!!window.MUSEUM_EXECUTION`);await wait(`window.MUSEUM_EXECUTION.canRun('python')`);return session}
 async function edit(code){await evaluate(`(()=>{const input=document.querySelector('#lab-code');input.value=${JSON.stringify(code)};input.dispatchEvent(new Event('input',{bubbles:true}))})()`)}
 async function run(expected){await evaluate(`document.querySelector('#lab-run').click()`);await wait(`document.querySelector('#lab-result').dataset.state==='ok'&&document.querySelector('#lab-result').textContent===${JSON.stringify(expected)}`,'Guest browser did not show the expected real output')}
 async function capacityHolder(){
  let cookie='';
  async function request(method,pathname,body){const response=await fetch(origin+pathname,{method,headers:{Origin:origin,Accept:'application/json',...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(12000)});const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];return {status:response.status,value:await response.json()}}
  const accepted=await request('POST','/api/executions',{language:'python',code:'print(42)\n',stdin:''});assert.equal(accepted.status,202,'Capacity holder must be an accepted real execution');assert.ok(cookie);
  await until(async()=>{const result=await request('GET','/api/executions/'+accepted.value.id);assert.equal(result.status,200);if(!FINAL.has(result.value.state))return false;assert.equal(result.value.state,'completed');assert.equal(result.value.stdout,'42\n');return true},'Capacity holder execution did not finish');
 }
 try{
  browser=spawn(chrome,['--headless=new','--disable-gpu','--disable-background-networking','--no-first-run','--no-default-browser-check','--remote-debugging-pipe','--user-data-dir='+profile],{stdio:['ignore','ignore','pipe','pipe','pipe']});
  browser.on('error',()=>{for(const request of pending.values()){clearTimeout(request.timer);request.reject(new Error('Unable to start installed Chrome'))}pending.clear()});browser.stderr.resume();
  browser.stdio[4].on('data',chunk=>{buffer+=chunk.toString();let end;while((end=buffer.indexOf('\0'))!==-1){const message=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);const request=pending.get(message.id);if(request){pending.delete(message.id);clearTimeout(request.timer);message.error?request.reject(new Error('Chrome protocol error: '+message.error.message)):request.resolve(message.result)}}});
  const version=await send('Browser.getVersion');await openTarget();const mainSession=session;
  const metadata=await evaluate(`fetch('/api/runtimes',{credentials:'same-origin'}).then(r=>r.json())`);assert.equal(metadata.private,false);assert.equal(metadata.access.mode,'guest');assert.equal(metadata.access.maxSessions,5);assert.equal(metadata.access.idleSeconds,300);
  assert.equal(await evaluate(`!!document.querySelector('#lab-remote-token,#access-request-open,#access-request-dialog')`),false);
  checks.push({name:'Public guest metadata and retired token/application controls',passed:true});
  for(const width of [1440,390]){
   await page('Emulation.setDeviceMetricsOverride',{width,height:width===1440?1000:844,mobile:width===390,deviceScaleFactor:1});await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(width===1440?'dark':'light')}`);
   for(const language of languages){
    const sample=inventory.samples.get(language);await evaluate(`window.MUSEUM_LAB.open(${JSON.stringify(language)});document.querySelector('#lab-stdin').value=${JSON.stringify(sample.stdin)}`);
    const before=await evaluate('window.__guestChecks.posts');await edit(sample.code);await delay(500);assert.equal(await evaluate('window.__guestChecks.posts'),before,'Editing must not submit code');await run(sample.stdout);
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await evaluate(`document.querySelector('#lab-result').scrollIntoView({block:'center'})`);await screenshot('guest-'+language+'-'+width+'.png');checks.push({name:'Real anonymous browser execution without editing submission or horizontal overflow',language,width,stdout:sample.stdout,passed:true});
   }
  }
  await evaluate(`document.querySelector('#lab-service-health').open=true;document.querySelector('#lab-service-refresh').click()`);await wait(`document.querySelector('#lab-service-summary').textContent.includes('服务可用')`);
  const observed=await evaluate('window.__guestChecks');assert.equal(observed.authorization,false);assert.ok(observed.paths.every(path=>!path.includes('/executor-status')&&!path.includes('/mcp')&&!path.includes('/access-requests')));
  const cookies=(await page('Network.getCookies',{urls:[origin]})).cookies,guestCookie=cookies.find(cookie=>cookie.httpOnly&&cookie.name===(parsed.protocol==='https:'?'__Host-museum-execution':'museum-execution'));assert.ok(guestCookie,'Admission cookie must be HttpOnly');assert.equal(guestCookie.sameSite,'Strict');assert.equal(guestCookie.secure,parsed.protocol==='https:');assert.equal(guestCookie.path,'/');assert.equal(await evaluate(`document.cookie.split(';').some(cookie=>cookie.trim().startsWith(${JSON.stringify(guestCookie.name+'=')}))`),false);
  checks.push({name:'Same-origin HttpOnly admission cookie; public availability never requests private metrics, MCP or access application',secure:guestCookie.secure,sameSite:guestCookie.sameSite,passed:true});
  if(fillCapacity){
   // Four distinct real clients plus the existing browser occupy the five leases.
   // This opt-in check deliberately reserves those leases until their idle timeout.
   for(let i=1;i<metadata.access.maxSessions;i++)await capacityHolder();
   const context=await send('Target.createBrowserContext');
   try{
    await openTarget(context.browserContextId);await page('Emulation.setDeviceMetricsOverride',{width:390,height:844,mobile:true,deviceScaleFactor:1});await evaluate(`window.MUSEUM_LAB.open('python')`);await edit('print(42)\n');await evaluate(`document.querySelector('#lab-run').click()`);
    await wait(`document.querySelector('#lab-result').dataset.state==='error'&&document.querySelector('#lab-result').textContent.includes('当前访问比较多，请稍后重试。')`,'The sixth guest did not see the requested busy message');await delay(700);assert.equal(await evaluate('window.__guestChecks.posts'),1,'Busy requests must never be resubmitted automatically');assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await evaluate(`document.querySelector('#lab-result').scrollIntoView({block:'center'})`);await screenshot('guest-sixth-session-busy-390.png');checks.push({name:'Sixth independent browser receives the requested busy message; exactly one POST',width:390,passed:true});
   }finally{await send('Target.disposeBrowserContext',{browserContextId:context.browserContextId});session=mainSession}
  }
  const report={schemaVersion:1,checkedAt:new Date().toISOString(),origin,browser:version.product,scope:'Actual installed Chrome guest UI checks. Every execution uses same-origin browser cookies with no execution token. Capacity checks, when requested, create five short-lived real leases and let them expire normally. No credentials, cookies, sessions or job identifiers retained.',fillCapacity,checks,inputs:Object.fromEntries(['src/index.html','src/execution-modes.js','src/service-status.js','src/lab-tools.js','scripts/check-guest-browser.cjs'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..',file))).digest('hex')]))};fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log('PASS '+checks.length+' guest browser checks; '+output);return report;
 }finally{
  for(const request of pending.values()){clearTimeout(request.timer);request.reject(new Error('Browser closed'))}pending.clear();
  if(browser?.pid&&browser.exitCode===null&&browser.signalCode===null)await new Promise(resolve=>{const timer=setTimeout(()=>browser.kill('SIGKILL'),5000);browser.once('exit',()=>{clearTimeout(timer);resolve()});browser.kill('SIGTERM')});fs.rmSync(profile,{recursive:true,force:true});
 }
}
module.exports={checkGuestBrowser};
if(require.main===module){const args=process.argv.slice(2);let origin,output,screenshots,languages,fillCapacity=false;for(let i=0;i<args.length;i++){if(args[i]==='--origin'&&args[i+1])origin=args[++i];else if(args[i]==='--output'&&args[i+1])output=args[++i];else if(args[i]==='--screenshots'&&args[i+1])screenshots=args[++i];else if(args[i]==='--language'&&args[i+1])(languages||=[]).push(args[++i]);else if(args[i]==='--fill-capacity')fillCapacity=true;else throw new Error('Unsupported guest browser argument')}checkGuestBrowser({origin,output,screenshots,languages,fillCapacity}).catch(error=>{console.error(error.stack);process.exitCode=1})}
