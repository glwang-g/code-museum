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
   await page('Emulation.setDeviceMetricsOverride',{width,height:width===1440?1000:844,deviceScaleFactor:1,mobile:width!==1440});
   if(await evaluate('document.documentElement.dataset.theme')!==theme)await click('#theme-toggle');
   assert.equal(await evaluate(`(()=>{const a=document.querySelector('.brand').getBoundingClientRect(),b=document.querySelector('.header-tools').getBoundingClientRect();return a.bottom<=b.top||a.right<=b.left})()`),true,'Header brand and actions must not overlap');
   for(const mode of ['timeline','lineage']){
    await focus(mode);
    const direct=await evaluate(`(()=>{const paths=[...document.querySelectorAll('.related-edge')];return {count:paths.length,onlyDirect:paths.every(p=>p.dataset.from==='java'||p.dataset.to==='java')}})()`);
    assert.ok(direct.count>0&&direct.onlyDirect);
    await evaluate(`setRelationScope('all')`);assert.ok(await evaluate(`document.querySelectorAll('.related-edge').length`)>direct.count);
    assert.ok((await evaluate('location.hash')).includes('depth=all'));
    const before=await evaluate('location.hash');
    assert.ok((await evaluate("document.querySelector('.map-run').title")).includes('需私有令牌'));
    await click('.map-run');assert.equal(await evaluate("document.querySelector('#lab-language').value"),'java');assert.ok((await evaluate("document.querySelector('#lab-next-action').textContent")).includes('先输入令牌'));
    assert.ok((await evaluate('location.hash')).includes('language=java'));
    await screenshot(`java-entry-${theme}-${mode}-${width}.png`);
    await evaluate('history.back()');await wait(`location.hash===${JSON.stringify(before)} && document.querySelector('#${mode}-view').getAttribute('aria-selected')==='true'`);
    assert.equal(await evaluate('activeId'),'java');assert.equal(await evaluate('relationScope'),'all');
    await evaluate('history.forward()');await wait("document.querySelector('#lab-view').getAttribute('aria-selected')==='true' && window.MUSEUM_LAB.current==='java'");
    await focus(mode);
    const p=await evaluate(`(()=>{const r=document.querySelector('.map-run').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
    await page('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await page('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x+35,y:p.y+15,button:'left',buttons:1});await page('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x+35,y:p.y+15,button:'left',clickCount:1});
    assert.equal(await evaluate(`document.querySelector('#${mode}-view').getAttribute('aria-selected')`),'true');assert.equal(await evaluate("!!document.querySelector('.relationship-title')"),false);
    if(width!==1440){
     await page('Emulation.setTouchEmulationEnabled',{enabled:true});
     await page('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,radiusX:2,radiusY:2}]});await page('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x+25,y:p.y+15,radiusX:2,radiusY:2}]});await page('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
     assert.equal(await evaluate(`document.querySelector('#${mode}-view').getAttribute('aria-selected')`),'true');
     await evaluate(`new Promise(resolve=>{const v=document.querySelector('#viewport');let last='',stable=0;const check=()=>{const next=v.scrollLeft+':'+v.scrollTop;if(next===last)stable++;else stable=0;last=next;if(stable>=12)resolve();else requestAnimationFrame(check)};requestAnimationFrame(check)})`);await focus(mode);const tap=await evaluate(`(()=>{const r=document.querySelector('.map-run').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
     await page('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...tap,radiusX:2,radiusY:2}]});await page('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await wait("document.querySelector('#lab-view').getAttribute('aria-selected')==='true'");await page('Emulation.setTouchEmulationEnabled',{enabled:false});
    }
    await focus(mode);await evaluate("document.querySelector('.map-run').focus()");await page('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',windowsVirtualKeyCode:13});await page('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});assert.equal(await evaluate("document.querySelector('#lab-language').value"),'java');assert.equal(await evaluate("document.querySelector('#lab-view').getAttribute('aria-selected')"),'true');
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true);
    results.push({width,theme,mode,checks:'direct/all scope; Java run mouse and keyboard; Back/Forward; drag suppression; mobile touch drag/tap; no horizontal overflow'});
   }
   await evaluate("window.MUSEUM_LAB.openLesson('java','functions')");await page('Page.reload',{ignoreCache:true});await wait("!!window.MUSEUM_NAV && window.MUSEUM_LAB.current==='java' && window.MUSEUM_LAB.topic==='functions'");
   assert.ok((await evaluate("document.querySelector('#lab-code').value")).includes('square(7)'));
   await evaluate("document.querySelector('#lab-remote-token').value='x'.repeat(32);document.querySelector('#lab-remote-token').dispatchEvent(new Event('input'))");
   await click('#share-page');await wait("document.querySelector('#share-status').textContent.length>0");const shareLayout=await evaluate(`(()=>{const feedback=document.querySelector('#share-feedback'),button=document.querySelector('#share-page'),workspace=document.querySelector('.workspace'),f=feedback.getBoundingClientRect(),b=button.getBoundingClientRect();return{position:getComputedStyle(feedback).position,visible:!feedback.hidden,feedbackTop:Math.round(f.top),buttonBottom:Math.round(b.bottom),workspaceTop:Math.round(workspace.getBoundingClientRect().top)}})()`);assert.equal(shareLayout.position,'absolute');assert.equal(shareLayout.visible,true);assert.ok(Math.abs(shareLayout.feedbackTop-(shareLayout.buttonBottom+8))<=2);assert.ok(!(await evaluate('location.hash')).includes('xxxx'));
   await evaluate("document.querySelector('#lab-remote-token').value='';document.querySelector('#lab-remote-token').dispatchEvent(new Event('input'))");
   await screenshot(`lab-share-${theme}-${width}.png`);
   await evaluate(`window.originalClipboardWrite=navigator.clipboard.writeText;navigator.clipboard.writeText=()=>Promise.reject(new Error('test clipboard denied'))`);await click('#share-page');
   await wait("!document.querySelector('#share-url').hidden");assert.ok((await evaluate("document.querySelector('#share-url').value")).includes('language=java'));assert.ok(!(await evaluate("document.querySelector('#share-url').value")).includes('xxxx'));
   await evaluate('navigator.clipboard.writeText=window.originalClipboardWrite');
   for(const key of ['coffeescript|civet|influencedBy','livescript|civet|influencedBy']){
    await evaluate(`window.MUSEUM_RELATIONS_UI.open(${JSON.stringify(key)})`);assert.equal(await evaluate("!!document.querySelector('.relationship-summary')"),true);assert.equal(await evaluate("document.querySelector('.relation-explanation').open"),false);await click('.relation-explanation summary');assert.equal(await evaluate("document.querySelector('.relation-explanation').open"),true);
    await click('.relation-source summary');assert.ok((await evaluate("document.querySelector('.relation-source').textContent")).includes(key.startsWith('coffeescript')?'CoffeeScript':'LiveScript'));assert.ok((await evaluate('location.hash')).includes('relation='));await screenshot(`civet-${key.split('|')[0]}-${theme}-${width}.png`);
    await page('Page.reload',{ignoreCache:true});await wait(`window.MUSEUM_NAV && inspectedRelation===${JSON.stringify(key)} && !!document.querySelector('.relationship-summary')`);
   }
   const introChecks=[['timeline-view','千流有来处，沿岸皆可停。'],['lineage-view','语言不是孤岛，关系要能回到出处。'],['catalogue-view','从流行名单之外，继续往里找。'],['lab-view','写一行，跑一次，看到真实结果。'],['compare-view','同一个问题，看看不同语言怎么回答。'],['sources-view','看见的不只结果，还有来处。']];
   for(const [tab,title] of introChecks){await click('#'+tab);await wait(`document.querySelector('.intro h1').textContent===${JSON.stringify(title)}`);assert.equal(await evaluate("document.querySelector('.intro h1').textContent"),title)}
   for(const route of JSON.parse(fs.readFileSync(path.join(root,'data/learning-paths.json'))).routes){
    await evaluate(`window.MUSEUM_GUIDE.start(${JSON.stringify(route.id)})`);
    for(let i=0;i<route.steps.length;i++){
     assert.equal((await evaluate('window.MUSEUM_GUIDE.state')).index,i);
     assert.equal(await evaluate("document.querySelectorAll('#guide-task-content dd').length"),3);
     assert.equal(await evaluate("[...document.querySelectorAll('#guide-task-content dd')].every(n=>n.textContent.trim().length>0)"),true);
     assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true);
     if(i===0){await evaluate("document.querySelector('#guide-task').open=true");await screenshot(`guide-${route.id}-${theme}-${width}.png`)}
     if(i<route.steps.length-1)await click('#guide-next');
    }
    await click('#guide-end');
   }
   results.push({width,theme,checks:'Java/functions reload; share excludes credentials; two Civet proofs disclosure; all 4 routes and 21 structured learning steps; tab-specific intro; no overflow'});console.log('PASS exploration '+theme+' '+width);
  }
  await evaluate("window.MUSEUM_LAB.open('java')");
  await evaluate(`window.restoreWorkers=[];window.savedWorker=window.Worker;window.Worker=class extends window.savedWorker{constructor(...args){super(...args);window.restoreWorkers.push(String(args[0]))}};location.hash='#lab?language=javascript&topic=functions'`);
  await wait("window.MUSEUM_LAB.current==='javascript' && window.MUSEUM_LAB.topic==='functions'");
  await evaluate('new Promise(resolve=>setTimeout(resolve,600))');assert.deepEqual(await evaluate('window.restoreWorkers'),[],'Link restoration must not start a saved program');
  await evaluate('window.Worker=window.savedWorker');results.push({check:'Local lab restore while lab visible creates no Worker and runs no saved code'});
  await evaluate("window.MUSEUM_LAB.openLesson('javascript','functions')");
  await evaluate("(()=>{const e=document.querySelector('#lab-code');e.value=e.value.replace('square(7)','square(9)');e.dispatchEvent(new Event('input',{bubbles:true}))})()");await click('#lab-run');await wait("document.querySelector('#lab-result').textContent.trim()==='81' && document.querySelector('#lab-result').dataset.state==='ok'");
  results.push({exercise:'javascript-functions',actualOutput:'81',runtime:'actual bundled browser Worker'});
  await evaluate("window.MUSEUM_LAB.openLesson('scheme','functions')");await click('#lab-enable-local');await wait("document.querySelector('#lab-result').textContent.trim()==='49' && document.querySelector('#lab-result').dataset.state==='ok'",35000);
  await evaluate("(()=>{const e=document.querySelector('#lab-code');e.value=e.value.replace('(square 7)','(square 9)');e.dispatchEvent(new Event('input',{bubbles:true}))})()");await click('#lab-run');await wait("document.querySelector('#lab-result').textContent.trim()==='81' && document.querySelector('#lab-result').dataset.state==='ok'",35000);
  results.push({exercise:'scheme-functions',actualOutput:'81',runtime:'actual bundled BiwaScheme after explicit enable'});
  assert.deepEqual(unexpectedApiRequests,[],'Exploration and restore must not submit remote code or another API mutation');
  const files=['data/audit/reviews.json','data/relationship-overrides.json','data/audit/map-eligible-ids.json','src/museum.js','src/museum.css','src/themes.css','scripts/check-exploration-browser.cjs','src/navigation.js','src/navigation-state.js','src/map-interaction.js','src/lab-tools.js','src/learning-guide.js','data/learning-paths.json'];
  const served=['index.html','museum.js','museum.css','themes.css','data/catalogue.js','data/relationship-status.js','data/relationship-status.json','data/audit-reviews.json','navigation.js','navigation-state.js','map-interaction.js','lab-tools.js','learning-guide.js','data/build-info.js','data/build-info.json'];
  const hashes=(base,names)=>Object.fromEntries(names.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(base,f))).digest('hex')]));
  fs.writeFileSync(path.join(outputDirectory,'checks.json'),JSON.stringify({checkedAt:new Date().toISOString(),browser:version.product,scope:'Actual isolated Chrome over local HTTP; 1440/390/320 widths, light/dark, two map views; actual mouse/touch/keyboard, navigation history/reload, sharing, evidence disclosure, all 4 routes/21 steps and real JS/Scheme function output. Java advertised by navigation capability fixture; no remote execution endpoint or submitted code',inputs:hashes(root,files),servedInputs:hashes(path.join(root,'dist'),served),checks:results},null,2)+'\n');
 }catch(e){await screenshot('failure.png').catch(()=>{});console.error(e.stack+'\n'+diagnostics);process.exitCode=1}
 finally{if(browser){try{await send('Browser.close')}catch{}if(browser.exitCode===null&&browser.signalCode===null)browser.kill('SIGKILL')}server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(profileDirectory,{recursive:true,force:true})}
})();
