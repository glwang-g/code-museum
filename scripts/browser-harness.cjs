// Isolated installed Chrome for interaction checks. Does not use the user's browser profile.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),{spawn}=require('node:child_process');
const {createRequestHandler}=require('./serve.cjs');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function withBrowser(options,run){
 const root=path.resolve(__dirname,'..'),directory=path.resolve(root,options.output);fs.mkdirSync(directory,{recursive:true});
 const server=options.production||options.origin?null:http.createServer(createRequestHandler(path.join(root,'dist')));
 if(server)await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 const origin=options.origin||(options.production?'https://codemuseum.freexlib.com':'http://127.0.0.1:'+server.address().port);
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'museum-interaction-')),pending=new Map();let browser,session,sequence=0,buffer='';
 const send=(method,params={},sid)=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(new Error('Chrome timeout: '+method))},30000);pending.set(id,{resolve,reject,timer});browser.stdio[3].write(JSON.stringify({id,method,params,...(sid?{sessionId:sid}:{})})+'\0')});
 const page=(method,params)=>send(method,params,session);
 async function evaluate(expression){const r=await page('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error('Page error: '+r.exceptionDetails.text+' '+(r.exceptionDetails.exception?.description||''));return r.result.value}
 async function wait(expression,timeout=30000){const end=Date.now()+timeout;while(Date.now()<end){if(await evaluate(expression))return;await delay(80)}throw new Error('Timed out: '+expression)}
 async function screenshot(name){await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');const r=await page('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(directory,name),Buffer.from(r.data,'base64'))}
 async function point(selector){return evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing interaction target');e.scrollIntoView({block:'nearest',inline:'nearest'});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`)}
 async function mouse(type,p,button='left'){return page('Input.dispatchMouseEvent',{type,...p,button,clickCount:1})}
 async function click(selector,releaseOnly=false){const p=await point(selector);await mouse('mouseMoved',p,'none');if(!releaseOnly)await mouse('mousePressed',p);await mouse('mouseReleased',p);await delay(120)}
 try{
  browser=spawn(process.env.CHROME_BIN||'/Applications/GoogleChrome.app/Contents/MacOS/Google Chrome',['--headless=new','--disable-gpu','--disable-background-networking','--no-first-run','--no-default-browser-check','--remote-debugging-pipe','--user-data-dir='+profile],{stdio:['ignore','ignore','pipe','pipe','pipe']});browser.stderr.resume();
  browser.stdio[4].on('data',chunk=>{buffer+=chunk.toString();let n;while((n=buffer.indexOf('\0'))!==-1){const m=JSON.parse(buffer.slice(0,n));buffer=buffer.slice(n+1);const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(new Error('Chrome protocol error: '+JSON.stringify(m.error))):p.resolve(m.result)}}});
  const version=await send('Browser.getVersion'),target=await send('Target.createTarget',{url:'about:blank'});session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
  await page('Page.enable');await page('Runtime.enable');if(options.fixture)await page('Page.addScriptToEvaluateOnNewDocument',{source:options.fixture});
  await page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,mobile:false,deviceScaleFactor:1});
  const navigation=await page('Page.navigate',{url:origin+(options.hash||'/')});if(navigation.errorText)throw new Error(navigation.errorText);await page('Page.bringToFront');
  // The lab API is exposed before initial route restoration. Interacting while
  // later classic scripts still load can let that restoration cancel a test run.
  await wait(options.ready||"document.readyState==='complete'&&!!window.MUSEUM_NAV&&!!window.MUSEUM_LAB");
  return await run({root,directory,origin,browserVersion:version.product,page,evaluate,wait,screenshot,point,mouse,click,delay});
 }catch(error){await screenshot('failure.png').catch(()=>{});throw error}
 finally{
  if(browser?.exitCode===null)await new Promise(resolve=>{const timer=setTimeout(()=>browser.kill('SIGKILL'),3000);browser.once('exit',()=>{clearTimeout(timer);resolve()});browser.kill('SIGTERM')});
  for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Browser closed'))}pending.clear();
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}fs.rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
 }
}
module.exports={withBrowser};
