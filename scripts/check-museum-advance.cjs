// Optional integration check: uses installed Chrome, no downloaded dependencies.
// Run after npm run build. CHROME_BIN selects Chromium; BROWSER_CHECK_OUTPUT saves report/screenshots.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const os=require('node:os'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const chromeCandidates=[process.env.CHROME_BIN,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/GoogleChrome.app/Contents/MacOS/Google Chrome','/Applications/Chromium.app/Contents/MacOS/Chromium'].filter(Boolean);
const chrome=chromeCandidates.find(candidate=>fs.existsSync(candidate));
if(!chrome)throw new Error(`Chrome/Chromium not found. Set CHROME_BIN to one of: ${chromeCandidates.join(', ')}`);
const outputDirectory=path.resolve(process.env.BROWSER_CHECK_OUTPUT||path.join(root,'output/iteration-2026-10-15'));
const profileDirectory=fs.mkdtempSync(path.join(os.tmpdir(),'code-museum-chrome-'));
if(outputDirectory)fs.mkdirSync(outputDirectory,{recursive:true});
const {createRequestHandler}=require(path.join(root,'scripts/serve.cjs'));
const handler=createRequestHandler(path.join(root,'dist'));
// No remote execution endpoint: all runtime results below come from local workers.
const unexpectedApiRequests=[];
const server=http.createServer((request,response)=>{
  if(request.method==='GET'&&request.url==='/api/runtimes'){
    response.writeHead(200,{'Content-Type':'application/json'});
    response.end(JSON.stringify({available:false,private:true,runtimes:[]}));return;
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
  await wait("!!window.MUSEUM_RELATIONS_UI && !!window.MUSEUM_LAB");



  async function click(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);const r=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);await mouse(r)}
  async function mouse(p){p={x:Math.round(p.x),y:Math.round(p.y)};await page('Input.dispatchMouseEvent',{type:'mouseMoved',...p,button:'none'});await page('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await page('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1})}
  const pause=ms=>new Promise(r=>setTimeout(r,ms));
  await evaluate(`(()=>{
   window.focusSamples=[];window.mapLongTasks=[];window.clickPaints=[];
   const original=renderLineageFocus;
   renderLineageFocus=function(...args){const start=performance.now();const result=original(...args);focusSamples.push({id:args[0],duration:performance.now()-start});return result};
   new PerformanceObserver(list=>mapLongTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask'});
   document.querySelector('#docks').addEventListener('click',()=>{const start=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>clickPaints.push(performance.now()-start)))},true);
  })()`);
  // No synthetic app invocation in the timed selection: dispatch actual mouse input.
  for(const width of [1440,390])for(const mode of ['timeline','lineage']){
   await page('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
   await evaluate(`restoreMapOverview();setView(${JSON.stringify(mode)})`);await pause(450);
   for(let pass=0;pass<3;pass++){
    if(pass)await evaluate('restoreMapOverview()');await pause(350);
    await evaluate('focusSamples=[];mapLongTasks=[];clickPaints=[]');
    await click('#docks .dock[data-id="javascript"]');
    await wait("activeId==='javascript' && clickPaints.length===1");await pause(450);
    const sample=await evaluate('({renders:focusSamples,longTasks:mapLongTasks,clickToTwoAnimationFrames:clickPaints[0]})');
    assert.equal(sample.renders.length,1,'One content render per selection, including panel transition');
    assert.ok(sample.clickToTwoAnimationFrames<750,'Gross click latency regression (>750 ms)');
    results.push({kind:'performance',width,mode,pass,...sample});
   }
   await evaluate('focusSamples=[]');
   await page('Emulation.setDeviceMetricsOverride',{width:width-10,height:880,deviceScaleFactor:1,mobile:width<500});await pause(350);
   await click('#detail-resizer');await page('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});await pause(300);
   assert.equal(await evaluate('focusSamples.length'),0,'Viewport and keyboard panel resize must not rebuild relationship content');
   await evaluate("scheduleFocusGeometry(activeId);zoomBy(1.1)");const manual=await evaluate('zoomScale');await pause(150);
   assert.equal(await evaluate('zoomMode'),'custom');assert.equal(await evaluate('zoomScale'),manual,'Deferred fit must not undo manual zoom');
   await screenshot(`map-${mode}-${width}.png`);
   results.push({kind:'resize',width,mode,renders:0,manualZoomPreserved:true});
  }
  await page('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  for(const width of [1440,390])for(const theme of ['dark','light']){
   await page('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
   if(await evaluate('document.documentElement.dataset.theme')!==theme)await click('#theme-toggle');
   for(const id of ['javascript','python','lua','scheme','c','cpp','java','rust']){
    await evaluate(`window.MUSEUM_RELATIONS_UI.openLanguage(${JSON.stringify(id)})`);
    assert.equal(await evaluate('!!document.querySelector(".language-exhibit")'),true);
    await click('.language-exhibit details:nth-of-type(1)>summary');
    assert.equal(await evaluate('document.querySelectorAll(".language-exhibit li").length'),3);
    await click('.language-exhibit details:nth-of-type(2)>summary');
    assert.equal(await evaluate('document.querySelector(".language-exhibit pre").textContent.includes("square")'),true);
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true);
    if(['javascript','rust'].includes(id))await screenshot(`exhibit-${id}-${theme}-${width}.png`);
    await click('[data-exhibit-proof]');assert.ok(await evaluate('!!document.querySelector(".relationship-title")'));
    await evaluate(`window.MUSEUM_RELATIONS_UI.openLanguage(${JSON.stringify(id)})`);
    await click('.language-exhibit details:nth-of-type(2)>summary');await click('[data-exhibit-lesson]');
    assert.equal(await evaluate('window.MUSEUM_LAB.current'),id);assert.equal(await evaluate('window.MUSEUM_LAB.topic'),'functions');
    assert.equal(await evaluate('document.activeElement.id'),'lab-code');
    results.push({kind:'exhibit',id,width,theme,checks:'rules, annotated code, proof navigation, lesson and editor focus, page overflow'});
   }
  }
  console.log('PASS: map performance and 32 exhibit viewport/theme scenarios');
  for(const key of ['gofer|haskell|influencedBy','swift|rust|influencedBy','ex-editor|vi|influencedBy','interpress|interscript|supersetOf','treesheets|particles|influencedBy','turtle|notation3|supersetOf']){
   await evaluate(`window.MUSEUM_RELATIONS_UI.open(${JSON.stringify(key)})`);
   assert.equal(await evaluate('document.querySelector(".research-note").dataset.researchKey'),key);
  }
  for(const id of ['xslt','assembly-language']){
   await evaluate(`window.MUSEUM_RELATIONS_UI.openLanguage(${JSON.stringify(id)})`);
   assert.equal(await evaluate('document.querySelector(".research-note").dataset.researchKey'),'language:'+id);
  }
  await screenshot('research-gap.png');
  // Exercise all four genuine browser runtimes on the new shared branch example.
  for(const language of ['javascript','python','lua','scheme']){
   await evaluate(`window.MUSEUM_LAB.openLesson(${JSON.stringify(language)},'branches')`);
   if(language!=='javascript'){
    await evaluate("(()=>{const s=document.querySelector('#lab-execution-mode');s.value='local';s.dispatchEvent(new Event('change',{bubbles:true}))})()");
    await click('#lab-enable-local');
   }
   await click('#lab-reset');await click('#lab-run');await wait("document.querySelector('#lab-result').dataset.state==='ok'",90000);
   assert.equal((await evaluate('document.querySelector("#lab-result").textContent')).trim(),'large');
   await evaluate("(()=>{const e=document.querySelector('#lab-code');e.value=e.value.replace('12','9');e.dispatchEvent(new Event('input',{bubbles:true}))})()");await click('#lab-run');
   await wait("document.querySelector('#lab-result').dataset.state==='ok' && document.querySelector('#lab-result').textContent.trim()==='small'",90000);
   results.push({kind:'branch-runtime',language,original:'large',changed:'small'});console.log('PASS: real '+language+' branch execution');
  }
  await page('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:true});
  await evaluate("window.MUSEUM_RELATIONS_UI.openLanguage('javascript')");await click('[data-exhibit-guide]');
  assert.equal(await evaluate('window.MUSEUM_GUIDE.state.index'),0);
  const replacements=[['2026','2030'],['12','9'],['<= 10','<= 5'],['square(7)','square(9)'],['n * 2','n * 3']];
  for(let index=1;index<=5;index++){
   await click('#guide-next');await click('#lab-reset');await click('#lab-run');await wait("document.querySelector('#guide-feedback').dataset.state==='different'");
   const [from,to]=replacements[index-1];
   await evaluate(`(()=>{const e=document.querySelector('#lab-code');e.value=e.value.replace(${JSON.stringify(from)},${JSON.stringify(to)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
   await click('#lab-run');await wait("document.querySelector('#guide-feedback').dataset.state==='matched'");
   assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true);
   if(index===3){
    await evaluate("(()=>{const e=document.querySelector('#lab-code');e.value='while (true) {}';e.dispatchEvent(new Event('input',{bubbles:true}))})()");await click('#lab-run');await wait("document.querySelector('#guide-feedback').dataset.state==='error'",10000);
    await click('#lab-reset');await evaluate("(()=>{const e=document.querySelector('#lab-code');e.value=e.value.replace('<= 10','<= 5');e.dispatchEvent(new Event('input',{bubbles:true}))})()");await click('#lab-run');await wait("document.querySelector('#guide-feedback').dataset.state==='matched'");
   }
   results.push({kind:'guide',step:index,checks:'original output differs, changed output matches, completion saved'});
  }
  await screenshot('guide-complete-mobile.png');
  await page('Page.reload',{ignoreCache:true});await wait("window.MUSEUM_GUIDE?.state?.route==='javascript-first-program'");
  assert.equal(await evaluate('window.MUSEUM_GUIDE.state.index'),5);
  assert.ok((await evaluate('document.querySelector("#guide-completion").textContent')).includes('曾得到'));
  assert.equal(await evaluate("Object.keys(JSON.parse(localStorage.getItem('code-museum-guide-completed'))).filter(k=>k.startsWith('javascript-first-program:')).length"),5);
  for(const width of [1440,390,320])for(const theme of ['dark','light']){
   await page('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
   if(await evaluate('document.documentElement.dataset.theme')!==theme)await click('#theme-toggle');
   const contrast=await evaluate(`(()=>{
    const rgb=value=>value.match(/[\\d.]+/g).slice(0,3).map(Number);
    const lum=value=>rgb(value).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4}).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
    const bg=lum(getComputedStyle(document.querySelector('#learning-guide')).backgroundColor),fg=lum(getComputedStyle(document.querySelector('#guide-note')).color);
    return (Math.max(bg,fg)+.05)/(Math.min(bg,fg)+.05);
   })()`);
   assert.ok(contrast>=4.5,'Guide note contrast in '+theme+': '+contrast);
   assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true);
   await screenshot(`guide-${theme}-${width}.png`);results.push({kind:'guide-theme',width,theme,contrast});
  }
  assert.deepEqual(unexpectedApiRequests,[],'No code submitted to a remote endpoint');
  const names=['src/museum.js','src/map-focus.js','src/language-exhibits.js','src/museum.css','src/themes.css','src/learning-examples.js','data/language-exhibits.json','data/research-triage.json','data/learning-paths.json','scripts/curated-content.cjs','scripts/check-museum-advance.cjs'];
  const hashes=(base,names)=>Object.fromEntries(names.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(base,f))).digest('hex')]));
  fs.writeFileSync(path.join(outputDirectory,'checks.json'),JSON.stringify({checkedAt:new Date().toISOString(),browser:version.product,scope:'Local isolated headless Chrome; real mouse selection with normal animation, 1440/390 widths, two maps; exhibit navigation in both themes; real JS/Python/Lua/Scheme branch execution; full JavaScript route wrong/matched/timeout/recovery/persistence; guide contrast at 1440/390/320 in both themes. No remote execution. Latency is click capture to two requestAnimationFrame callbacks, not a paint/compositing measurement or a production/Safari guarantee.',inputs:hashes(root,names),servedInputs:hashes(path.join(root,'dist'),['museum.js','map-focus.js','language-exhibits.js','museum.css','themes.css','learning-examples.js','data/language-exhibits.js','data/research-triage.js','data/learning-paths.js']),checks:results},null,2)+'\n');
  console.log(`PASS: ${results.length} checks. Report and screenshots: ${outputDirectory}`);
 }catch(e){await screenshot('failure.png').catch(()=>{});console.error(e.stack+'\n'+diagnostics);process.exitCode=1}
 finally{if(browser){try{await send('Browser.close')}catch{}if(browser.exitCode===null&&browser.signalCode===null)browser.kill('SIGKILL')}server.closeAllConnections();await new Promise(r=>server.close(r));try{fs.rmSync(profileDirectory,{recursive:true,force:true,maxRetries:5,retryDelay:100})}catch(error){if(error.code!=='ENOTEMPTY')throw error}}
})();
