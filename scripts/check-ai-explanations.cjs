// Real Chrome + real DeepSeek acceptance. One new explanation per server cache lifetime.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),delay=ms=>new Promise(r=>setTimeout(r,ms));
const code='const prices = [30, 80, 120];\nfunction totalOver(limit) {\n  return prices.filter(price => price >= limit)\n    .reduce((sum, price) => sum + price, 0);\n}\nconsole.log(totalOver(50));';
async function check({production=false}={}){
 const directory=path.join(root,'tmp/ai-explanations',production?'production':'local');fs.mkdirSync(directory,{recursive:true});
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'museum-ai-browser-')),pending=new Map(),checks=[];let browser,preview,session,sequence=0,buffer='';
 const send=(method,params={},sid)=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(new Error('Chrome timeout: '+method))},45000);pending.set(id,{resolve,reject,timer});browser.stdio[3].write(JSON.stringify({id,method,params,...(sid?{sessionId:sid}:{})})+'\0')});
 const page=(method,params)=>send(method,params,session);
 async function evaluate(expression){const r=await page('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error('Page evaluation failed: '+r.exceptionDetails.text);return r.result.value}
 async function wait(expression){const end=Date.now()+45000;while(Date.now()<end){if(await evaluate(expression))return;await delay(100)}throw new Error('Browser condition timed out: '+expression)}
 async function screenshot(name){await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');const r=await page('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(directory,name),Buffer.from(r.data,'base64'))}
 const edit=text=>evaluate(`(()=>{const e=document.querySelector('#lab-code');e.value=${JSON.stringify(text)};e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
 try{
  if(!production)preview=await require('./explanation-preview.cjs').start({port:0});
  const origin=production?'https://codemuseum.freexlib.com':preview.origin;
  browser=spawn(process.env.CHROME_BIN||'/Applications/GoogleChrome.app/Contents/MacOS/Google Chrome',['--headless=new','--disable-gpu','--disable-background-networking','--no-first-run','--no-default-browser-check','--remote-debugging-pipe','--user-data-dir='+profile],{stdio:['ignore','ignore','pipe','pipe','pipe']});browser.stderr.resume();
  browser.stdio[4].on('data',chunk=>{buffer+=chunk.toString();let end;while((end=buffer.indexOf('\0'))!==-1){const m=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(new Error('Chrome protocol error')):p.resolve(m.result)}}});
  const version=await send('Browser.getVersion'),target=await send('Target.createTarget',{url:'about:blank'});session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
  await page('Page.enable');await page('Runtime.enable');await page('Page.addScriptToEvaluateOnNewDocument',{source:`window.__aiPosts=0;window.__executionPosts=0;window.__aiReplies=[];const original=window.fetch;window.fetch=async(url,options={})=>{const ai=String(url)==='/api/explanations'&&options.method==='POST';if(ai)window.__aiPosts++;if(String(url)==='/api/executions'&&options.method==='POST')window.__executionPosts++;const response=await original(url,options);if(ai){const d=await response.clone().json();window.__aiReplies.push({status:response.status,cached:d.cached,model:d.model,steps:d.explanation?.steps.length})}return response};`});
  await page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,mobile:false,deviceScaleFactor:1});await page('Page.navigate',{url:origin+'/#lab'});await wait(`!!window.MUSEUM_LAB&&!!document.querySelector('#lab-explain-current')`);
  for(const id of ['python','javascript','sed'])await evaluate(`MUSEUM_LAB.restore(${JSON.stringify(id)},'default')`);
  await evaluate(`MUSEUM_LAB.restore('javascript','default')`);await edit(code);
  await evaluate(`document.querySelector('#lab-explanation-toggle').click();document.querySelector('#lab-explanation-toggle').click()`);await delay(500);
  assert.equal(await evaluate('__aiPosts'),0);checks.push({name:'Opening, language changes, typing and hide/show make zero model API requests',passed:true});
  await evaluate(`document.querySelector('#lab-explain-current').click();document.querySelector('#lab-explain-current').click()`);
  assert.equal(await evaluate('__aiPosts'),1);await edit(code+'\n// changed while waiting');
  await wait(`document.querySelector('#lab-explanation').getAttribute('aria-busy')==='false'&&!document.querySelector('#lab-explain-current').disabled`);
  assert.equal(await evaluate(`document.querySelector('#lab-explanation').dataset.state`),'modified');assert.equal(await evaluate(`document.querySelectorAll('.lab-explanation-steps button').length`),0);assert.equal(await evaluate('__aiPosts'),1);
  const first=await evaluate('__aiReplies[0]');assert.equal(first?.status,200,'Real DeepSeek explanation must succeed');assert.equal(first.model,'deepseek-flash');checks.push({name:'Explicit click reaches real model; repeated click merges and late result cannot overwrite edited code',...first,passed:true});
  await edit(code);await wait(`document.querySelector('#lab-explanation').dataset.state==='ai'`);assert.equal(await evaluate(`document.querySelector('#lab-explain-current').disabled`),true);assert.equal(await evaluate('__aiPosts'),1);
  await evaluate(`document.querySelector('.lab-explanation-steps button').click()`);assert.ok(await evaluate(`document.querySelector('#lab-code').selectionEnd>document.querySelector('#lab-code').selectionStart`));
  await evaluate(`document.querySelector('#lab-run').click()`);await wait(`document.querySelector('#lab-result').dataset.state==='ok'`);assert.equal(await evaluate(`document.querySelector('#lab-result').textContent`),'200');assert.equal(await evaluate('__executionPosts'),0);checks.push({name:'Restoring identical code reuses browser cache; line navigation and real JavaScript result remain correct',passed:true});
  for(const width of [1440,900,680,390])for(const theme of ['dark','light']){
   await page('Emulation.setDeviceMetricsOverride',{width,height:width===1440?1000:844,mobile:width<701,deviceScaleFactor:1});await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)};document.querySelector('#lab-explanation').scrollIntoView({block:'nearest'})`);
   assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
   assert.equal(await evaluate(`(()=>{const p=document.querySelector('#lab-explanation').getBoundingClientRect(),b=document.querySelector('#lab-explain-current').getBoundingClientRect();return b.width>90&&b.left>=p.left&&b.right<=p.right})()`),true);
   if(width<701)assert.equal(await evaluate(`(()=>{const box=document.querySelector('#lab-explanation-content');box.scrollTop=box.scrollHeight;const last=box.querySelector('li:last-child button').getBoundingClientRect(),r=box.getBoundingClientRect();return last.top>=r.top&&last.bottom<=r.bottom})()`),true);
   await screenshot('current-code-'+width+'-'+theme+'.png');checks.push({name:'AI action, line steps and result fit without horizontal overflow',width,theme,passed:true});
  }
  await page('Page.reload');await wait(`!!window.MUSEUM_LAB&&!!document.querySelector('#lab-explain-current')`);await evaluate(`MUSEUM_LAB.restore('javascript','default')`);await edit(code);await delay(400);assert.equal(await evaluate('__aiPosts'),0);
  await evaluate(`document.querySelector('#lab-explain-current').click()`);await wait(`document.querySelector('#lab-explanation').dataset.state==='ai'`);const second=await evaluate('__aiReplies[0]');assert.equal(second.cached,true);assert.equal(second.status,200);checks.push({name:'New page requires a click and reuses server cache without another generation',passed:true});
  const files=['server/explanations.py','src/lab-explanations.js','src/lab-explanations.css','src/index.html','scripts/serve.cjs','scripts/check-ai-explanations.cjs'];
  const report={schemaVersion:1,checkedAt:new Date().toISOString(),origin:production?origin:'local same-origin preview',browser:version.product,scope:'Actual Chrome and configured deepseek-flash. A public fixed JavaScript fixture only; no user draft, standard input, API key or provider raw response recorded. No remote execution tasks submitted.',fixtureSha256:crypto.createHash('sha256').update(code).digest('hex'),checks,inputs:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]))};fs.writeFileSync(path.join(root,'data/audit/ai-explanations-'+(production?'production':'browser')+'.json'),JSON.stringify(report,null,2)+'\n');console.log('PASS '+checks.length+' real DeepSeek/Chrome checks');
 }catch(error){await screenshot('failure.png').catch(()=>{});console.error(await evaluate(`({state:document.querySelector('#lab-explanation')?.dataset.state,status:document.querySelector('#lab-explanation-status')?.textContent,replies:window.__aiReplies})`).catch(()=>null));throw error}
 finally{
  for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Browser closed'))}pending.clear();
  if(browser?.exitCode===null)await new Promise(r=>{const timer=setTimeout(()=>browser.kill('SIGKILL'),5000);browser.once('exit',()=>{clearTimeout(timer);r()});browser.kill('SIGTERM')});
  await preview?.close();fs.rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
 }
}
if(require.main===module){if(process.argv.slice(2).some(a=>a!=='--production'))throw new Error('Expected optional --production');check({production:process.argv.includes('--production')}).catch(error=>{console.error(error.message);process.exitCode=1})}
module.exports={check};
