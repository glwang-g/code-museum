// Optional integration check: uses installed Chrome, no downloaded dependencies.
// Run after npm run build. CHROME_BIN selects Chromium; BROWSER_CHECK_OUTPUT saves report/screenshots.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const os=require('node:os'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const chromeCandidates=[process.env.CHROME_BIN,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/GoogleChrome.app/Contents/MacOS/Google Chrome','/Applications/Chromium.app/Contents/MacOS/Chromium'].filter(Boolean);
const chrome=chromeCandidates.find(candidate=>fs.existsSync(candidate));
if(!chrome)throw new Error(`Chrome/Chromium not found. Set CHROME_BIN to one of: ${chromeCandidates.join(', ')}`);
const outputDirectory=process.env.BROWSER_CHECK_OUTPUT?path.resolve(process.env.BROWSER_CHECK_OUTPUT):null;
const profileDirectory=fs.mkdtempSync(path.join(os.tmpdir(),'code-museum-chrome-'));
if(outputDirectory)fs.mkdirSync(outputDirectory,{recursive:true});
const {createRequestHandler}=require(path.join(root,'scripts/serve.cjs'));
const handler=createRequestHandler(path.join(root,'dist'));
// Only advertise a Java capability fixture to expose the remote run entry.
// No executor or fabricated execution output is provided by this check.
const unexpectedApiRequests=[];
const server=http.createServer((request,response)=>{
  if(request.method==='GET'&&request.url==='/api/runtimes'){
    response.writeHead(200,{'Content-Type':'application/json'});
    response.end(JSON.stringify({available:true,private:true,runtimes:[{id:'java',version:'Java 17 (navigation test fixture)',timeoutSeconds:3,compileTimeoutSeconds:15}]}));return;
  }
  if(request.method==='GET'&&request.url==='/api/visits'){
    response.writeHead(503,{'Content-Type':'application/json'});
    response.end(JSON.stringify({error:'Visit statistics unavailable in isolated navigation test'}));return;
  }
  if(request.url.startsWith('/api/')){
    unexpectedApiRequests.push({method:request.method,url:request.url});
    response.writeHead(503,{'Content-Type':'application/json'});response.end(JSON.stringify({error:'No execution endpoint in navigation test'}));return;
  }
  handler(request,response);
});
const pending=new Map();let sequence=0,buffer='',browser,session,diagnostics='';
const results=[];
function send(method,params={},sessionId){return new Promise((resolve,reject)=>{
  const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},15000);
  pending.set(id,{resolve,reject,timer});browser.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0');
});}
const page=(method,params)=>send(method,params,session);
async function evaluate(expression){const r=await page('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function wait(expression,timeout=15000){const end=Date.now()+timeout;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('Page condition timed out: '+expression+'; output='+await evaluate('document.querySelector("#lab-result")?.textContent'));}
async function screenshot(name){if(!outputDirectory)return;await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');const r=await page('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(outputDirectory,name),Buffer.from(r.data,'base64'));}
(async()=>{
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  browser=spawn(chrome,['--headless=new','--disable-gpu','--disable-background-networking','--no-first-run','--no-default-browser-check','--remote-debugging-pipe','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','--user-data-dir='+profileDirectory],{stdio:['ignore','ignore','pipe','pipe','pipe']});
  browser.stderr.on('data',c=>{diagnostics=(diagnostics+c).slice(-3000)});
  browser.stdio[4].on('data',chunk=>{buffer+=chunk.toString();let end;while((end=buffer.indexOf('\0'))!==-1){const m=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);const r=pending.get(m.id);if(r){pending.delete(m.id);clearTimeout(r.timer);m.error?r.reject(new Error(JSON.stringify(m.error))):r.resolve(m.result)}}});
  const version=await send('Browser.getVersion'),target=await send('Target.createTarget',{url:'about:blank'});
  session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
  await page('Page.enable');await page('Runtime.enable');
  await page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await page('Page.navigate',{url:'http://127.0.0.1:'+server.address().port});
  await wait("!!window.MUSEUM_RELATIONS_UI && window.MUSEUM_LAB?.canRun('java')");
  await page('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});


  async function click(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);const r=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);await mouse(r)}
  async function mouse(p){await page('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await page('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1})}
  async function focus(mode){await evaluate(`setView(${JSON.stringify(mode)});setRelationLayer('design');setRelationScope('direct');select('java');activeId='java';renderLineageFocus(activeId)`);await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')}
  for(const width of [1440,390,320])for(const theme of ['dark','light']){
   await page('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<500});
   if(await evaluate('document.documentElement.dataset.theme')!==theme)await click('#theme-toggle');
   for(const id of ['c','java','python']){
    await evaluate(`setView('lineage');select(${JSON.stringify(id)});activeId=${JSON.stringify(id)};renderLineageFocus(activeId);relationDirection='up';relationLevels=2;setRelationScope('levels')`);
    assert.equal(await evaluate("relationScope==='levels' && relationDirection==='up' && document.querySelector('#relation-count').textContent.includes('条关系')"),true);
    const route=await evaluate('location.hash');assert.ok(route.includes('direction=up')&&route.includes('levels=2'));
    await click('#detail-toggle');assert.equal(await evaluate("document.querySelector('#detail').classList.contains('compact') && document.querySelector('#detail-content').hidden"),true);await screenshot(`compact-detail-${theme}-${width}-${id}.png`);
    assert.ok(await evaluate("document.querySelector('#viewport').clientHeight")>70);await click('#detail-toggle');assert.equal(await evaluate("document.querySelector('#detail-content').hidden"),false);
    await click('#detail-map');assert.equal(await evaluate("document.querySelector('#detail').classList.contains('compact')"),true);await click('#detail-toggle');
    await page('Page.reload',{ignoreCache:true});await wait("!!window.MUSEUM_NAV && relationScope==='levels' && relationDirection==='up' && relationLevels===2");assert.equal(await evaluate('activeId'),id);
   }
   await evaluate("setView('lineage');select('c');activeId='c';renderLineageFocus(activeId);select('java');activeId='java';renderLineageFocus(activeId)");await click('#map-previous');assert.equal(await evaluate('activeId'),'c');
   await evaluate("window.MUSEUM_GUIDE.start('function-expressions')");await click('#guide-toggle');assert.equal(await evaluate("document.querySelector('#learning-guide').classList.contains('compact')"),true);await screenshot(`compact-guide-${theme}-${width}.png`);await click('#guide-toggle');
   await screenshot(`mobile-tools-${theme}-${width}.png`);
   await click('#guide-end');
   for(const key of ['typescript|civet|influencedBy','java|pizza|supersetOf']){await evaluate(`window.MUSEUM_RELATIONS_UI.open(${JSON.stringify(key)})`);assert.ok((await evaluate("document.querySelector('#detail-content').textContent")).includes(key.startsWith('typescript')?'有意差异':'1997'));}
   await evaluate("window.MUSEUM_RELATIONS_UI.open('abc|python|influencedBy')");assert.equal(await evaluate("!!document.querySelector('.evidence-version')"),true);await screenshot(`evidence-${theme}-${width}.png`);
   assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true);results.push({width,theme,checks:'C/Java/Python directional two-level traversal and URL reload; detail collapse/expand/map return; previous language; compact guide; two scoped relations and source version disclosure'});
  }
  for(const language of ['javascript','scheme']){
   await evaluate("window.MUSEUM_GUIDE.start('function-expressions')");
   await evaluate(`(()=>{for(let i=0;i<${language==='javascript'?5:4};i++)document.querySelector('#guide-next').click()})()`);
   if(language==='scheme')await click('#lab-enable-local');
   await evaluate(`(()=>{const e=document.querySelector('#lab-code');e.value=${JSON.stringify('')}+${language==='javascript'?JSON.stringify('console.log(49)'):JSON.stringify('(display 49)')};e.dispatchEvent(new Event('input',{bubbles:true}))})()`);await click('#lab-run');await wait("document.querySelector('#guide-feedback').dataset.state==='different'");
   await evaluate(`(()=>{const e=document.querySelector('#lab-code');e.value=${language==='javascript'?JSON.stringify('console.log(81)'):JSON.stringify('(display 81)')};e.dispatchEvent(new Event('input',{bubbles:true}))})()`);await click('#lab-run');await wait("document.querySelector('#guide-feedback').dataset.state==='matched'");
   await evaluate(`(()=>{const e=document.querySelector('#lab-code');e.value=${language==='javascript'?JSON.stringify('while(true){}'):JSON.stringify('(let loop () (loop))')};e.dispatchEvent(new Event('input',{bubbles:true}))})()`);await click('#lab-run');await wait("document.querySelector('#guide-feedback').dataset.state==='error'",10000);
   await evaluate(`(()=>{const e=document.querySelector('#lab-code');e.value=${language==='javascript'?JSON.stringify('console.log(81)'):JSON.stringify('(display 81)')};e.dispatchEvent(new Event('input',{bubbles:true}))})()`);await click('#lab-run');await wait("document.querySelector('#guide-feedback').dataset.state==='matched'");
   await screenshot(`exercise-${language}.png`);await page('Page.reload',{ignoreCache:true});await wait("!!window.MUSEUM_GUIDE && document.querySelector('#guide-completion').textContent.includes('曾得到')");results.push({language,checks:'actual wrong/matching output, timeout, rerun recovery, completion persistence'});await click('#guide-end');
  }
  assert.deepEqual(unexpectedApiRequests,[],'Exploration and restore must not submit remote code or another API mutation');
  const files=['data/audit/reviews.json','data/relationship-overrides.json','data/audit/map-eligible-ids.json','src/museum.js','src/museum.css','src/themes.css','scripts/check-exploration-round2.cjs','src/exploration-state.js','src/exploration-tools.js','src/navigation.js','src/navigation-state.js','src/map-interaction.js','src/lab-tools.js','src/learning-guide.js','data/learning-paths.json'];
  const served=['index.html','museum.js','museum.css','themes.css','data/catalogue.js','data/relationship-status.js','data/relationship-status.json','data/audit-reviews.json','exploration-state.js','exploration-tools.js','navigation.js','navigation-state.js','map-interaction.js','lab-tools.js','learning-guide.js','data/build-info.js','data/build-info.json'];
  const hashes=(base,names)=>Object.fromEntries(names.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(base,f))).digest('hex')]));
  fs.writeFileSync(path.join(outputDirectory,'checks.json'),JSON.stringify({checkedAt:new Date().toISOString(),browser:version.product,scope:'Actual isolated Chrome round 2 over local HTTP; 1440/390/320 widths, light/dark, two map views; actual mouse controls, URL reload, evidence disclosure, directional graph and compact details/guide; real JS/Scheme exercise wrong/matched/timeout/recovery/persistence. Java advertised by navigation capability fixture; no remote execution endpoint or submitted code',inputs:hashes(root,files),servedInputs:hashes(path.join(root,'dist'),served),checks:results},null,2)+'\n');
 }catch(e){await screenshot('failure.png').catch(()=>{});console.error(e.stack+'\n'+diagnostics);process.exitCode=1}
 finally{if(browser){try{await send('Browser.close')}catch{}if(browser.exitCode===null&&browser.signalCode===null)browser.kill('SIGKILL')}server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(profileDirectory,{recursive:true,force:true})}
})();
