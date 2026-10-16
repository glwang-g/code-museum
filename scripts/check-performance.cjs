// Optional integration check: uses installed Chrome, no downloaded dependencies.
// Run after npm run build. CHROME_BIN selects Chromium; BROWSER_CHECK_OUTPUT saves report/screenshots.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const os=require('node:os'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const chromeCandidates=[process.env.CHROME_BIN,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/GoogleChrome.app/Contents/MacOS/Google Chrome','/Applications/Chromium.app/Contents/MacOS/Chromium'].filter(Boolean);
const chrome=chromeCandidates.find(candidate=>fs.existsSync(candidate));
if(!chrome)throw new Error(`Chrome/Chromium not found. Set CHROME_BIN to one of: ${chromeCandidates.join(', ')}`);
const outputDirectory=path.resolve(process.env.BROWSER_CHECK_OUTPUT||path.join(root,'tmp/performance-2026-10-16',process.env.PERF_LABEL||'after'));
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
 const samples=[],pageErrors=[];
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  browser=spawn(chrome,['--headless=new','--disable-background-networking','--no-first-run','--no-default-browser-check','--remote-debugging-pipe','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','--user-data-dir='+profileDirectory],{stdio:['ignore','ignore','pipe','pipe','pipe']});
  browser.stderr.on('data',c=>{diagnostics=(diagnostics+c).slice(-2000)});
  browser.stdio[4].on('data',chunk=>{buffer+=chunk.toString();let end;while((end=buffer.indexOf('\0'))!==-1){const m=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);if(m.method==='Runtime.exceptionThrown')pageErrors.push(m.params.exceptionDetails.text);const r=pending.get(m.id);if(r){pending.delete(m.id);clearTimeout(r.timer);m.error?r.reject(new Error(JSON.stringify(m.error))):r.resolve(m.result)}}});
  const version=await send('Browser.getVersion'),target=await send('Target.createTarget',{url:'about:blank'});session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
  await page('Page.enable');await page('Runtime.enable');await page('Performance.enable');await page('Network.enable');
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function click(selector){const p=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);for(const [type,button] of [['mouseMoved','none'],['mousePressed','left'],['mouseReleased','left']])await page('Input.dispatchMouseEvent',{type,...p,button,clickCount:1})}
  for(const width of [1440,390])for(const cpu of [1,4]){
   await page('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});await page('Emulation.setCPUThrottlingRate',{rate:cpu});
   await page('Page.navigate',{url:'http://127.0.0.1:'+server.address().port});await wait('!!window.MUSEUM_NAV && document.readyState==="complete"');await pause(200);
   await evaluate(`(()=>{
    window.perfTimelineNode=document.querySelector('#docks [data-id=javascript]');
    window.perfResult=null;window.perfRenders=0;window.perfEvents=[];window.perfDockAdds=0;
    const fn=renderLineageFocus;renderLineageFocus=function(...a){perfRenders++;return fn(...a)};
    new MutationObserver(changes=>{for(const c of changes)perfDockAdds+=[...c.addedNodes].filter(n=>n.matches?.('.dock')).length}).observe(document.querySelector('#docks'),{childList:true});
    new PerformanceObserver(list=>perfEvents.push(...list.getEntries().filter(e=>e.name==='click').map(e=>({start:e.startTime,duration:e.duration,processing:e.processingEnd-e.processingStart})))).observe({type:'event',durationThreshold:16});
    document.addEventListener('click',event=>{
     if(!event.target.closest('[data-map-result],.museum-tabs button,#close'))return;
     const start=performance.now();let previous='',lastChange=start,frameCount=0,maxFrameGap=0,lastFrame=start;
     perfRenders=0;perfDockAdds=0;perfResult=null;
     function frame(now){
      const v=document.querySelector('#viewport'),w=document.querySelector('#world');
      const key=[v.clientWidth,v.clientHeight,Math.round(v.scrollLeft),Math.round(v.scrollTop),w.style.transform,w.style.left,w.style.top].join('|');
      if(key!==previous){previous=key;lastChange=now}
      maxFrameGap=Math.max(maxFrameGap,now-lastFrame);lastFrame=now;frameCount++;
      if(now-start<1000)requestAnimationFrame(frame);
      else perfResult={settledMs:Math.max(0,lastChange-start),maxFrameGap,frameCount,renders:perfRenders,dockAdds:perfDockAdds,reusedTimeline:document.querySelector('#docks [data-id=javascript]')===window.perfTimelineNode,events:perfEvents.filter(e=>e.start>=start-5)};
     }requestAnimationFrame(frame);
    },true);
   })()`);
   async function sample(name,selector){await click(selector);await wait('!!perfResult');const data=await evaluate('perfResult');samples.push({name,width,cpu,...data});if(process.env.PERF_LABEL!=='before'){assert.ok(data.settledMs<150,'Viewport settles within 150ms: '+name);assert.ok(data.renders<=1,'No duplicate full render: '+name);if(name==='timeline-view')assert.equal(data.reusedTimeline,true,'Timeline nodes survive view switches')}console.log(JSON.stringify({name,width,cpu,settledMs:Math.round(data.settledMs),maxFrameGap:Math.round(data.maxFrameGap),renders:data.renders,dockAdds:data.dockAdds}));}
   async function search(id){await click('#map-search');await evaluate("document.querySelector('#map-search').value='';document.querySelector('#map-search').dispatchEvent(new Event('input',{bubbles:true}))");await page('Input.insertText',{text:id});await wait(`!!document.querySelector('[data-map-result="${id}"]')`)}
   await search('javascript');await sample('first-selection','[data-map-result="javascript"]');
   await search('python');await sample('next-selection','[data-map-result="python"]');
   for(const id of ['lineage-view','timeline-view','catalogue-view','compare-view','sources-view','timeline-view'])await sample(id,'#'+id);
   if(cpu===1){await search('javascript');await sample('reopen-selection','[data-map-result="javascript"]');await screenshot('timeline-'+width+'.png')}
  }
    await page('Page.reload');await wait('!!window.MUSEUM_NAV && document.readyState==="complete"');
    const cached=await evaluate("performance.getEntriesByType('resource').filter(e=>/\\.[a-f0-9]{12}\\.(js|css|webp)$/.test(e.name)).map(e=>({name:e.name,transfer:e.transferSize,decoded:e.decodedBodySize}))");
    assert.ok(cached.length>=30);assert.ok(cached.every(e=>e.transfer===0),'Versioned shell resources are reused without HTTP revalidation');
    fs.writeFileSync(path.join(outputDirectory,'cache.json'),JSON.stringify(cached,null,2)+'\n');
    await screenshot('cache-reload.png');

  const searchStyles=[];
  const inputStyle=selector=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),s=getComputedStyle(e);return Object.fromEntries(['height','fontSize','fontFamily','fontWeight','lineHeight','borderRadius','borderTopWidth','borderTopStyle','borderTopColor','backgroundColor','color','paddingTop','paddingRight','paddingBottom','paddingLeft','appearance'].map(k=>[k,s[k]]))})()`);
  for(const width of [1440,1052,800,390])for(const theme of ['dark','light']){
   await page('Emulation.setCPUThrottlingRate',{rate:1});await page('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
   if(await evaluate('document.documentElement.dataset.theme')!==theme)await click('#theme-toggle');
   await click('#timeline-view');const map=await inputStyle('#map-search');await screenshot(`search-map-${theme}-${width}.png`);
   await click('#catalogue-view');const catalogue=await inputStyle('#search');
   assert.deepEqual(catalogue,map,'Search inputs share their visual treatment');
   assert.equal(await evaluate("(()=>{const box=document.querySelector('#catalogue').getBoundingClientRect();return ['#search','#scope','#sort'].every(s=>{const r=document.querySelector(s).getBoundingClientRect();return r.left>=box.left&&r.right<=box.right})})()"),true,'Catalogue toolbar controls must not be clipped');
   await click('#search');await page('Input.insertText',{text:'Python'});
   assert.equal(await evaluate("!document.querySelector('#search-clear').hidden"),true);
   assert.ok((await evaluate("document.querySelector('#result-count').textContent")).includes('5,155'));
   await screenshot(`search-catalogue-${theme}-${width}.png`);await click('#search-clear');
   assert.equal(await evaluate("document.querySelector('#search').value"),'');assert.equal(await evaluate('document.activeElement.id'),'search');
   assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true);
   searchStyles.push({width,theme,map,catalogue});
  }
  fs.writeFileSync(path.join(outputDirectory,'search-styles.json'),JSON.stringify(searchStyles,null,2)+'\n');
  assert.deepEqual(pageErrors,[]);
  const files=['src/museum.js','src/museum.css','src/search.css','src/themes.css','src/index.html','src/map-focus.js','src/exploration-tools.js','scripts/build.cjs','scripts/serve.cjs','scripts/check-performance.cjs'];
  const hash=names=>Object.fromEntries(names.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
  fs.writeFileSync(path.join(outputDirectory,'checks.json'),JSON.stringify({browser:version.product,scope:'Isolated local Chrome, actual mouse input, normal motion, 1440/390, CPU 1x/4x. settledMs is the last viewport/scroll/transform change in a one-second rAF observation; excludes decorative animations and is not an actual GPU presentation timestamp.',inputs:hash(files),samples},null,2)+'\n');
 }catch(e){await screenshot('failure.png').catch(()=>{});console.error(e.stack+'\n'+diagnostics);process.exitCode=1}
 finally{if(browser){try{await send('Browser.close')}catch{}if(browser.exitCode===null)browser.kill('SIGKILL')}server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(profileDirectory,{recursive:true,force:true,maxRetries:5,retryDelay:100})}
})();
