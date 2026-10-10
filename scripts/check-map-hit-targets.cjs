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

  async function clickPoint(p){await page('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await page('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1})}
  async function focus(mode,language){await evaluate(`setView(${JSON.stringify(mode)});setRelationLayer('design');select(${JSON.stringify(language)});activeId=${JSON.stringify(language)};renderLineageFocus(activeId)`);await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')}
  for(const width of [1440,390])for(const theme of ['dark','light'])for(const mode of ['timeline','lineage'])for(const language of ['javascript','java']){
   await page('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1000,deviceScaleFactor:1,mobile:width===390});
   if(await evaluate('document.documentElement.dataset.theme')!==theme)await evaluate("document.querySelector('#theme-toggle').click()");
   for(const kind of ['selected-label','related-label','run','run-natural']){
    await focus(mode,language);
    const target=await evaluate(`(()=>{
     const number=v=>parseFloat(v)||0,scale=new DOMMatrix(getComputedStyle(document.querySelector('#world')).transform).a;
     let n,pseudo;
     if(${JSON.stringify(kind)}.startsWith('run'))n=document.querySelector('.map-run');
     else if(${JSON.stringify(kind)}==='selected-label'){n=document.querySelector('.dock.selected');pseudo='::after'}
     else {n=[...document.querySelectorAll('.dock.related:not(.selected)')].find(n=>n.dataset.labelPlacement==='placed');if(n.classList.contains('dot'))pseudo='::before'}
     const r=n.getBoundingClientRect();let x=(r.left+r.right)/2,y=(r.top+r.bottom)/2;
     if(pseudo){const p=getComputedStyle(n,pseudo),base=getComputedStyle(n),w=number(p.width),h=number(p.height);x=r.left+(number(base.borderLeftWidth)+number(p.left))*scale+number(base.getPropertyValue('--label-shift-x'))+w/2;y=r.top+(number(base.borderTopWidth)+number(p.top))*scale+number(base.getPropertyValue('--label-shift-y'))+h/2}
     if(${JSON.stringify(kind)}!=='run-natural'){
     document.querySelector('#relations').style.overflow='visible';
     const path=document.querySelector('.relation-hit'),inv=path.getScreenCTM().inverse(),a=new DOMPoint(x-35,y).matrixTransform(inv),b=new DOMPoint(x+35,y).matrixTransform(inv),d='M'+a.x+' '+a.y+' L'+b.x+' '+b.y;
     path.setAttribute('d',d);path.parentElement.querySelector('.related-edge').setAttribute('d',d);
     }
     const hit=document.elementFromPoint(x,y),stack=document.elementsFromPoint(x,y);
     return {x,y,id:n.dataset.id||n.dataset.runLanguage,hit:hit?.closest('.dock,.map-run')?.dataset.id||hit?.closest('.map-run')?.dataset.runLanguage,stack:stack.map(n=>n.tagName+'.'+(n.getAttribute('class')||'')),lineUnder:stack.some(n=>n.classList?.contains('relation-hit'))};
    })()`);
    assert.equal(target.hit,target.id,kind+' must win hit testing');if(kind!=='run-natural')assert.equal(target.lineUnder,true,'Test must place a real relation hit area underneath '+JSON.stringify({width,mode,kind,target}));
    await screenshot(`overlap-${language}-${kind}-${theme}-${mode}-${width}.png`);
    await clickPoint({x:target.x,y:target.y});
    if(kind.startsWith('run')){assert.equal(await evaluate("document.querySelector('#lab-view').getAttribute('aria-selected')"),'true');assert.equal(await evaluate("document.querySelector('#lab-language').value"),language)}
    else {assert.equal(await evaluate("document.querySelector('#detail-content .eyebrow').textContent"),'馆藏 / '+target.id);assert.equal(await evaluate("!!document.querySelector('.relationship-title')"),false)}
    results.push({width,theme,mode,kind,selectedLanguage:language,language:target.id,lineUnder:target.lineUnder,mouseClick:true});
   }
   await focus(mode,language);
   const exposed=await evaluate(`(()=>{for(const path of document.querySelectorAll('.relation-hit')){const l=path.getTotalLength(),m=path.getScreenCTM();for(const fraction of [.5,.35,.65,.2,.8]){const p=path.getPointAtLength(l*fraction).matrixTransform(m),hit=document.elementFromPoint(p.x,p.y);if(hit?.closest('.relation-control')===path.parentElement)return {x:p.x,y:p.y,key:path.parentElement.dataset.edgeKey}}}return null})()`);
   assert.ok(exposed,'An exposed relation must remain clickable');await clickPoint({x:exposed.x,y:exposed.y});assert.equal(await evaluate("!!document.querySelector('.relationship-title')"),true);
   results.push({width,theme,mode,selectedLanguage:language,kind:'exposed-line',key:exposed.key,mouseClick:true});console.log('PASS '+language+' '+theme+' '+mode+' '+width+' labels/run/line');
  }
  assert.deepEqual(unexpectedApiRequests,[],'Opening the map run entry must never submit execution or another API operation');
  const files=['data/audit/reviews.json','data/relationship-overrides.json','data/audit/map-eligible-ids.json','src/museum.js','src/museum.css','src/themes.css','scripts/check-map-hit-targets.cjs'];
  const served=['index.html','museum.js','museum.css','themes.css','data/catalogue.js','data/relationship-status.js','data/relationship-status.json','data/audit-reviews.json'];
  const hashes=(base,names)=>Object.fromEntries(names.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(base,f))).digest('hex')]));
  fs.writeFileSync(path.join(outputDirectory,'checks.json'),JSON.stringify({checkedAt:new Date().toISOString(),browser:version.product,scope:'Actual isolated headless Chrome over local HTTP; JavaScript and Java, two sizes, two themes, both map views; natural run button clicks and forced real SVG hit-area crossings underneath selected and related labels and run buttons, actual hit testing and mouse navigation; exposed lines remain clickable. Java capability advertised by a local navigation-only fixture; no execution endpoint or execution output provided. Only GET /api/runtimes and the page’s read-only GET /api/visits permitted; no code submitted. External DNS blocked; no runtime or production execution tested.',inputs:hashes(root,files),servedInputs:hashes(path.join(root,'dist'),served),checks:results},null,2)+'\n');
 }catch(e){await screenshot('failure.png').catch(()=>{});console.error(e.stack+'\n'+diagnostics);process.exitCode=1}
 finally{if(browser){try{await send('Browser.close')}catch{}if(browser.exitCode===null&&browser.signalCode===null)browser.kill('SIGKILL')}server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(profileDirectory,{recursive:true,force:true})}
})();
