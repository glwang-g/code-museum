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
let rejectPythonWorker=false;
const server=http.createServer((request,response)=>{
  if(rejectPythonWorker&&request.url==='/python-worker.js'){response.writeHead(503,{'Content-Type':'text/plain','Cache-Control':'no-store'});response.end('Runtime resource deliberately unavailable for retry check');return;}

  if(request.url.startsWith('/assets/pyodide/')){
    // Node writeHead-only headers are not exposed by getHeader after finish.
    const writeHead=response.writeHead;
    response.writeHead=function(status,headers){
      runtimeResponses.push({file:request.url,status,mimeType:headers?.['Content-Type'],encoding:headers?.['Content-Encoding']||'identity'});
      return writeHead.apply(this,arguments);
    };
  }
  handler(request,response);
});
const pending=new Map();let sequence=0,buffer='',browser,session,diagnostics='';
const results=[],runtimeResponses=[];
function send(method,params={},sessionId){return new Promise((resolve,reject)=>{
  const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},15000);
  pending.set(id,{resolve,reject,timer});browser.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0');
});}
const page=(method,params)=>send(method,params,session);
async function evaluate(expression){const r=await page('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function wait(expression,timeout=15000){const end=Date.now()+timeout;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('Page condition timed out: '+expression+'; output='+await evaluate('document.querySelector("#lab-result")?.textContent'));}
async function edit(code){await evaluate(`(()=>{const e=document.querySelector('#lab-code');e.value=${JSON.stringify(code)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
async function output(expected){await wait(`document.querySelector('#lab-result').dataset.state==='ok' && document.querySelector('#lab-result').textContent===${JSON.stringify(expected)}`);}
async function screenshot(name){if(!outputDirectory)return;await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');const r=await page('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(outputDirectory,name),Buffer.from(r.data,'base64'));}
async function checkEvidence(){
 const result=await evaluate(`(()=>{
   const edges=[...window.MUSEUM_DATA.edges,...window.MUSEUM_DATA.ecosystemEdges],issues=[],counts={cited:0,fieldOnly:0};
   for(const path of document.querySelectorAll('#relations .related-edge')){
     const edge=edges.find(edge=>edge.from===path.dataset.from&&edge.to===path.dataset.to&&edge.type===path.dataset.relationType);
     if(!edge){issues.push('Unknown rendered edge '+path.dataset.from+' → '+path.dataset.to);continue;}
     const cited=typeof edge.evidence==='string'&&!!edge.evidence.trim(),state=cited?'claim-with-citation':'record-field-only';
     if(path.dataset.evidenceState!==state||!path.classList.contains(cited?'cited-edge':'field-edge'))issues.push('Wrong evidence tier '+edge.from+' → '+edge.to);
     const emphasized=path.parentElement.matches(':hover,:focus-visible,.inspected');
     const expectedOpacity=emphasized?1:path.classList.contains('needs-evidence')?.4:cited?.96:.55;
     if(!document.body.classList.contains('relation-preview')&&Math.abs(parseFloat(getComputedStyle(path).opacity)-expectedOpacity)>.01)issues.push('Wrong evidence emphasis '+edge.from+' → '+edge.to);
     counts[cited?'cited':'fieldOnly']++;
   }
   for(const button of document.querySelectorAll('#detail-content .relation-link')){
     const state=button.dataset.evidenceState,text=button.querySelector('.relation-evidence-state')?.textContent;
     if(!['claim-with-citation','record-field-only'].includes(state)||text!==(state==='claim-with-citation'?'附有论证与出处':'来源字段，关系待核'))issues.push('Missing detail evidence tier '+button.dataset.related);
   }
   return {issues,counts};
 })()`);
 assert.deepEqual(result.issues,[],'Map/detail evidence tiers must match current source data');
 return result.counts;
}
async function checkLabels(ids){
 const evidenceCounts=await checkEvidence();
 const metrics=await evaluate(`(()=>{
   const number=value=>parseFloat(value)||0;
   const viewport=document.querySelector('#viewport').getBoundingClientRect();
   const scale=new DOMMatrix(getComputedStyle(document.querySelector('#world')).transform).a;
   return {viewport:{left:viewport.left,right:viewport.right,top:viewport.top,bottom:viewport.bottom},labels:[...new Set([...${JSON.stringify(ids)},...Array.from(document.querySelectorAll('.dock.related[data-label-placement="placed"]'),node=>node.dataset.id)])].map(id=>{
     const node=document.querySelector('.dock[data-id="'+id+'"]'),r=node.getBoundingClientRect();
     if(!node.classList.contains('selected')&&!node.classList.contains('dot'))return {id,placement:node.dataset.labelPlacement,left:r.left,right:r.right,top:r.top,bottom:r.bottom};
     const style=getComputedStyle(node,node.classList.contains('selected')?'::after':'::before'),base=getComputedStyle(node);
     const width=number(style.width)+(style.boxSizing==='border-box'?0:number(style.paddingLeft)+number(style.paddingRight)+number(style.borderLeftWidth)+number(style.borderRightWidth));
     const height=number(style.height)+(style.boxSizing==='border-box'?0:number(style.paddingTop)+number(style.paddingBottom)+number(style.borderTopWidth)+number(style.borderBottomWidth));
     const left=r.left+(number(base.borderLeftWidth)+number(style.left))*scale+number(base.getPropertyValue('--label-shift-x')),top=r.top+(number(base.borderTopWidth)+number(style.top))*scale+number(base.getPropertyValue('--label-shift-y'));
     return {id,placement:node.dataset.labelPlacement,left,right:left+width,top,bottom:top+height,width};
   }),guides:Array.from(document.querySelectorAll('#relations .label-guide'),path=>{const point=path.getPointAtLength(path.getTotalLength()).matrixTransform(path.getScreenCTM());return {id:path.dataset.labelGuide,x:point.x,y:point.y};})};
 })()`);
 for(const label of metrics.labels){
   assert.equal(label.placement,'placed','Direct label must be placed: '+label.id);
   if(label.width!==undefined)assert.ok(label.width>20,'Text label must have measured width: '+label.id);
   assert.ok(label.left>=metrics.viewport.left-1&&label.right<=metrics.viewport.right+1&&label.top>=metrics.viewport.top-1&&label.bottom<=metrics.viewport.bottom+1,'Clipped label: '+JSON.stringify({label,viewport:metrics.viewport}));
 }
 for(let i=0;i<metrics.labels.length;i++)for(let j=i+1;j<metrics.labels.length;j++){
   const a=metrics.labels[i],b=metrics.labels[j];
   assert.ok(a.right<=b.left+1||b.right<=a.left+1||a.bottom<=b.top+1||b.bottom<=a.top+1,'Overlapping labels: '+JSON.stringify({a,b}));
 }
 for(const guide of metrics.guides){
   const label=metrics.labels.find(label=>label.id===guide.id);
   assert.ok(label,'Guide must lead to a placed label: '+guide.id);
   assert.ok(guide.x>=label.left-2&&guide.x<=label.right+2&&guide.y>=label.top-2&&guide.y<=label.bottom+2,'Guide misses its label: '+JSON.stringify({guide,label}));
 }
 return {...metrics,evidenceCounts};
}
async function record(name,detail){results.push({name,detail});console.log('PASS '+name);}
(async()=>{
 try{
  for(const file of ['index.html','learning-examples.js','draft-store.js','lab-tools.js','compare.js','analytics.js','visit-counts.js','map-framing.js','museum.js','museum.css','lab.js','lab-examples.js','lab-worker.js','python-worker.js','lua-worker.js','scheme-worker.js','credits.js','relationship-coverage.js','execution-config.js','execution-modes.js','runtime-status.js','runtime-progress.js','theme.js','themes.css'])assert.deepEqual(fs.readFileSync(path.join(root,'dist',file)),fs.readFileSync(path.join(root,'src',file)),'Stale build: run npm run build before browser checks');
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  browser=spawn(chrome,['--headless=new','--disable-gpu','--disable-background-networking','--no-first-run','--no-default-browser-check','--remote-debugging-pipe','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','--user-data-dir='+profileDirectory],{stdio:['ignore','ignore','pipe','pipe','pipe']});
  browser.on('error',error=>{for(const request of pending.values()){clearTimeout(request.timer);request.reject(error);}pending.clear();});
  browser.stderr.on('data',chunk=>{diagnostics=(diagnostics+chunk).slice(-3000);});
  browser.stdio[4].on('data',chunk=>{buffer+=chunk.toString();let end;while((end=buffer.indexOf('\0'))!==-1){const message=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);const request=pending.get(message.id);if(request){pending.delete(message.id);clearTimeout(request.timer);message.error?request.reject(new Error(JSON.stringify(message.error))):request.resolve(message.result);}}});
  const version=await send('Browser.getVersion');
  const target=await send('Target.createTarget',{url:'about:blank'});
  session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
  await page('Page.enable');await page('Runtime.enable');
  await page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await page('Page.addScriptToEvaluateOnNewDocument',{source:`window.__museumWorkers=[];const NativeWorker=window.Worker;window.Worker=class extends NativeWorker{constructor(url,options){super(url,options);window.__museumWorkers.push(this);this.observedURL=String(url);this.observedTerminated=false;}terminate(){this.observedTerminated=true;return super.terminate();}};`});
  await page('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/#lab`});
  await wait('!!window.MUSEUM_LAB && !!document.querySelector("#lab-language")');
  assert.equal(await evaluate('document.hidden'),false);
  await evaluate(`window.MUSEUM_LAB.open('python')`);
  await edit('print(42)');await new Promise(resolve=>setTimeout(resolve,800));
  assert.equal(await evaluate(`window.__museumWorkers.some(w=>w.observedURL==='python-worker.js')`),false);
  assert.equal(await evaluate(`document.querySelector('#lab-execution-mode').value`),'remote');
  assert.equal(runtimeResponses.length,0,'Default remote mode must not download Pyodide');
  for(const width of [1440,390]){
    await page('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1000,deviceScaleFactor:1,mobile:width===390});
    await screenshot('execution-default-'+width+'.png');
  }
  await record('Remote default requires an explicit run and local interpreters require download consent',{pythonWorkers:0,runtimeDownloads:0});
  const themeChecks=[];
  for(const width of [1440,390]){
    await page('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1000,deviceScaleFactor:1,mobile:width===390});
    for(const theme of ['dark','light']){
      if(await evaluate('document.documentElement.dataset.theme')!==theme){
        const point=await evaluate(`(()=>{const r=document.querySelector('#theme-toggle').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
        await page('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
        await page('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
      }
      assert.equal(await evaluate('document.documentElement.dataset.theme'),theme);
      for(const [view,name] of [['timeline-view','river'],['lineage-view','lineage'],['catalogue-view','catalogue'],['lab-view','lab'],['compare-view','compare'],['sources-view','sources']]){
        await evaluate(`document.getElementById(${JSON.stringify(view)}).click()`);
        assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
        await screenshot('theme-'+theme+'-'+name+'-'+width+'.png');
      }
      await evaluate(`document.querySelector('#timeline-view').click();document.querySelector('.dock[data-id="python"]').click()`);
      await evaluate('new Promise(resolve=>setTimeout(resolve,900))');
      await screenshot('theme-'+theme+'-selected-'+width+'.png');
      assert.equal(await evaluate(`document.querySelector('.dock[data-id="python"]').classList.contains('selected')`),true);
      await evaluate(`document.querySelector('#close').click();window.MUSEUM_LAB.open('python')`);
      assert.equal(await evaluate(`document.querySelector('#lab-code').value`),'print(42)','Theme changes must preserve the code draft');
      themeChecks.push({width,theme});
    }
  }
  await page('Page.reload');await wait('!!window.MUSEUM_LAB');
  assert.equal(await evaluate('document.documentElement.dataset.theme'),'light','Theme choice survives reload');
  await page('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});
  assert.equal(await evaluate('document.documentElement.dataset.theme'),'light','Explicit choice overrides system preference');
  await evaluate(`document.querySelector('#theme-toggle').click();window.MUSEUM_LAB.open('python')`);
  await edit('print(42)');
  await record('Theme real mouse switching, all six tabs and selected maps in wide/narrow layouts, persisted choice and draft preservation',themeChecks);
  await evaluate(`window.__runtimeStages=[];new MutationObserver(()=>{const r=document.querySelector('#lab-runtime-state'),p=document.querySelector('#lab-state-progress');if(window.__runtimeStages.length<2000)window.__runtimeStages.push({language:document.querySelector('#lab-language').value,stage:r.dataset.stage,loaded:p.hasAttribute('value')?p.value:null,total:p.max});}).observe(document.querySelector('#lab-runtime-state'),{attributes:true,attributeFilter:['data-stage']});`);
  await evaluate(`(()=>{const select=document.querySelector('#lab-execution-mode');select.value='local';select.dispatchEvent(new Event('change'));})()`);
  assert.equal(await evaluate(`document.querySelector('#lab-execution-mode').value`),'local');
  assert.equal(await evaluate(`document.querySelector('#lab-state-label').textContent`),'未启用');
  assert.equal(runtimeResponses.length,0,'Switching modes alone must not download core resources');
  await page('Network.enable');await page('Network.setCacheDisabled',{cacheDisabled:true});rejectPythonWorker=true;
  await evaluate(`document.querySelector('#lab-enable-local').click()`);
  await wait(`document.querySelector('#lab-runtime-state').dataset.stage==='failed'`);
  assert.equal(await evaluate(`document.querySelector('#lab-runtime-retry').hidden`),false);
  for(const width of [1440,390]){
    await page('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1000,deviceScaleFactor:1,mobile:width===390});
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
    await screenshot('runtime-retry-'+width+'.png');
  }
  rejectPythonWorker=false;
  await page('Network.emulateNetworkConditions',{offline:false,latency:20,downloadThroughput:4*1024*1024,uploadThroughput:4*1024*1024});
  await evaluate(`document.querySelector('#lab-runtime-retry').click()`);
  await wait(`document.querySelector('#lab-runtime-state').dataset.stage==='downloading'&&document.querySelector('#lab-state-progress').value>0`);
  await screenshot('runtime-progress-390.png');
  await output('42');
  await page('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await page('Network.setCacheDisabled',{cacheDisabled:false});
  assert.equal(await evaluate(`document.querySelector('#lab-runtime-state').dataset.stage`),'completed');
  assert.match(await evaluate(`document.querySelector('#lab-state-version').textContent`),/Python \d+\.\d+\.\d+.*Pyodide 314\.0\.7/);
  const runtimeStages=await evaluate(`window.__runtimeStages.filter(entry=>entry.language==='python')`);
  for(const stage of ['failed','downloading','initializing','running','completed'])assert.ok(runtimeStages.some(entry=>entry.stage===stage),'Missing runtime phase: '+stage);
  assert.ok(runtimeStages.some(entry=>entry.stage==='downloading'&&entry.loaded>0&&entry.total>entry.loaded),'Core resource progress must observe real streamed bytes');
  await record('Runtime modes, consent, measured resource progress, initialization and real Python load-failure retry',runtimeStages);
  await evaluate(`document.querySelector('#lab-reset').click();for(const id of ['python','lua','scheme'])window.MUSEUM_LAB.useLocal(id);window.MUSEUM_LAB.open('javascript')`);
  const creditChecks=[];
  for(const width of [1440,390]){
    await page('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1000,deviceScaleFactor:1,mobile:width===390});
    await evaluate(`document.querySelector('#sources-view').click();document.querySelector('#about').scrollTop=0`);
    assert.equal(await evaluate(`document.querySelectorAll('.credit-card').length`),13);
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
    const links=await evaluate(`Array.from(document.querySelectorAll('#open-source-credits a'),a=>({href:a.getAttribute('href'),external:a.target==='_blank',rel:a.rel}))`);
    assert.ok(links.every(link=>!link.external||link.rel.includes('noreferrer')));
    for(const link of links.filter(link=>!link.href.startsWith('https://'))){
      assert.equal(await evaluate(`fetch(${JSON.stringify(link.href)}).then(r=>r.status)`),200,'Local credit evidence must resolve');
    }
    await screenshot('credits-overview-'+width+'.png');
    for(const [language,id] of [['javascript','browser-javascript'],['python','pyodide'],['lua','wasmoon'],['scheme','biwascheme']]){
      await evaluate(`window.MUSEUM_LAB.open(${JSON.stringify(language)})`);
      const point=await evaluate(`(()=>{const b=document.querySelector('#lab-runtime-credit'),r=b.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,hidden:b.hidden,text:b.textContent};})()`);
      assert.equal(point.hidden,false);assert.ok(point.text.includes('项目与许可'));
      await page('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
      await page('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});
      assert.equal(await evaluate(`!document.querySelector('#about').hidden&&document.activeElement.id===${JSON.stringify('credit-'+id)}`),true);
      const fits=await evaluate(`(()=>{const r=document.getElementById(${JSON.stringify('credit-'+id)}).getBoundingClientRect(),v=document.querySelector('#about').getBoundingClientRect();return r.left>=v.left&&r.right<=v.right&&r.top>=v.top&&r.top<v.bottom;})()`);
      assert.equal(fits,true,'Selected credit heading must be visible');
      creditChecks.push({width,language,id});
      if(language==='scheme')await screenshot('credits-scheme-'+width+'.png');
    }
    await evaluate(`window.MUSEUM_LAB.open('rust')`);
    assert.equal(await evaluate(`document.querySelector('#lab-runtime-credit').hidden`),true);
  }
  await page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await evaluate(`window.MUSEUM_LAB.open('javascript')`);
  await record('Open source credits, bundled license links and real mouse lab attribution navigation',creditChecks);
  const relationProofChecks=[];
  for(const size of [{width:1440,height:1000,mobile:false},{width:390,height:844,mobile:true}]){
    await page('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:1});
    await evaluate(`document.querySelector('#sources-view').click();document.querySelector('[data-credit-target="relationship-coverage"]').click();document.querySelector('#relationship-label-review').open=true;document.querySelector('#relationship-review-filter').value='all';document.querySelector('#relationship-review-filter').dispatchEvent(new Event('change'));`);
    assert.equal(await evaluate(`document.querySelectorAll('[data-review-language]').length`),50);
    await evaluate(`document.querySelector('#relationship-review-filter').value='gaps';document.querySelector('#relationship-review-filter').dispatchEvent(new Event('change'));`);
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('[data-review-language]'),b=>b.dataset.reviewLanguage)`),['assembly-language','xslt','zig']);
    await screenshot('relationship-coverage-'+size.width+'.png');
    await evaluate(`document.querySelector('[data-review-language="zig"]').click()`);
    assert.equal(await evaluate(`document.querySelector('#detail-content h2').textContent`),'Zig');
    assert.equal(await evaluate(`document.querySelector('#detail').classList.contains('open')`),true);
    for(const mode of ['timeline','lineage']){
      for(const entry of [{key:'csharp|scala|influencedBy',anchor:'scala',layer:'design',state:'excerpt-recorded'}, {key:'java|javascript|influencedBy',anchor:'javascript',layer:'design',state:'excerpt-recorded'},{key:'java|csharp|influencedBy',anchor:'csharp',layer:'design',state:'excerpt-recorded'},{key:'c|python|extensionInterface',anchor:'python',layer:'ecosystem',state:'excerpt-recorded'},{key:'objective-c|swift|influencedBy',anchor:'swift',layer:'design',state:'excerpt-recorded'}]){
        await evaluate(`setView(${JSON.stringify(mode)});setRelationLayer(${JSON.stringify(entry.layer)});select(${JSON.stringify(entry.anchor)});activeId=${JSON.stringify(entry.anchor)};renderLineageFocus(activeId);`);
        await new Promise(resolve=>setTimeout(resolve,600));
        const point=await evaluate(`(()=>{const g=document.querySelector('[data-edge-key="${entry.key}"]'),p=g.querySelector('.relation-hit'),v=document.querySelector('#viewport').getBoundingClientRect();for(let i=2;i<99;i++){const t=p.getPointAtLength(p.getTotalLength()*i/100).matrixTransform(p.getScreenCTM());if(t.x<v.left+3||t.x>v.right-3||t.y<v.top+3||t.y>v.bottom-3)continue;const hit=document.elementFromPoint(t.x,t.y);if(hit?.closest('[data-edge-key]')&&nearestRelations({clientX:t.x,clientY:t.y})[0]?.key==='${entry.key}')return {x:t.x,y:t.y};}return null})()`);
        if(point){
          await page('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
          await page('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
        }else{
          // Labels have priority over lines; fully covered edges remain keyboard-accessible.
          await evaluate(`document.querySelector('[data-edge-key="${entry.key}"]').focus()`);
          await page('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
          await page('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
        }
        if(await evaluate(`document.querySelector('#detail-content .eyebrow').textContent==='交叠连线'`))await evaluate(`document.querySelector('[data-proof-key="${entry.key}"]').click()`);
        assert.equal(await evaluate(`document.querySelector('#detail-content .eyebrow').textContent.startsWith('关系依据')`),true,JSON.stringify({mode,size,entry,point,actual:await evaluate(`document.querySelector('#detail-content .eyebrow').textContent`)}));
        assert.equal(await evaluate(`inspectedRelation`),entry.key);
        const detail=await evaluate(`document.querySelector('#detail-content').textContent`);
        assert.ok(detail.includes(entry.state==='field-only'?'来源字段，关系待核':entry.state==='needs-direct-evidence'?'直接设计依据待补':entry.state==='citation-only'?'原文摘录待补':'原文摘录已存'));
        if(entry.state==='excerpt-recorded'){
          await evaluate(`document.querySelector('.relation-source').open=true`);
          assert.ok((await evaluate(`document.querySelector('.relation-source').textContent`)).includes(({'csharp|scala|influencedBy':'not a superset','java|javascript|influencedBy':'look like Java','java|csharp|influencedBy':'checked exceptions','objective-c|swift|influencedBy':'named parameters','c|python|extensionInterface':'built-in modules'})[entry.key]));
          await screenshot('relationship-proof-'+mode+'-'+size.width+'.png');
        }
        await evaluate(`(()=>{document.querySelector('[data-relation-endpoint="${entry.anchor}"]').click();document.querySelector('[data-edge-key="${entry.key}"]').focus();})()`);
        await page('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
        await page('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
        assert.equal(await evaluate(`document.querySelector('#detail-content .eyebrow').textContent.startsWith('关系依据')`),true,'Keyboard proof navigation');
        await evaluate(`restoreMapOverview()`);
        assert.equal(await evaluate(`document.querySelector('#detail').classList.contains('open')`),false);
        relationProofChecks.push({width:size.width,mode,key:entry.key,state:entry.state,input:point?'mouse':'keyboard (line covered by label)'});
      }
    }
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
  }
  assert.equal(await evaluate(`fetch('data/relationship-status.json').then(r=>r.status)`),200);
  await record('Relationship evidence real mouse/keyboard navigation, both map layers/views and 50 label coverage',relationProofChecks);
  await page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});


  await evaluate(`setRelationLayer('design');window.MUSEUM_LAB.open('javascript')`);
  await edit('await Promise.resolve(); console.log("browser JavaScript");');await output('browser JavaScript');
  await record('JavaScript asynchronous execution',version.product);
  await evaluate(`window.MUSEUM_LAB.open('scheme')`);await output('55\n');
  await edit('(apply + (map (lambda (x) (* x x)) (list 1 2 3)))');await output('14');
  await edit('(call/cc (lambda (exit) (+ 1 (exit 42))))');await output('42');
  await edit('(define saved 7) saved');await output('7');
  await edit('saved');await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  await edit('(+ 1');await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  await edit('(display (make-string 50000 #\\x)) (car 1)');
  await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.equal(await evaluate(`document.querySelector('#lab-result').textContent.length`),20000);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/car|pair/);
  await edit('(let loop () (loop))');await wait(`document.querySelector('#lab-result').textContent.includes('超过 2 秒')`);
  await edit('; Comment\n(define value 55)\n(display value)\n(newline)');await output('55\n');
  assert.ok(await evaluate(`document.querySelectorAll('#lab-highlight .tok-comment').length>0`));
  for(const width of [1440,390]){
    await page('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1000,deviceScaleFactor:1,mobile:width===390});
    await screenshot('scheme-lab-'+width+'.png');
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
  }
  await page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await edit('(let loop () (loop))');
  await wait(`document.querySelector('#lab-result').textContent==='正在运行 Scheme…'`);
  await evaluate(`document.querySelector('#timeline-view').click();setRelationScope('all')`);
  assert.equal(await evaluate(`window.__museumWorkers.filter(w=>w.observedURL==='scheme-worker.js').every(w=>w.observedTerminated)`),true);
  await evaluate(`window.MUSEUM_LAB.open('scheme')`);
  await edit('(+ 40 2)');await output('42');
  await record('Scheme interpreter expressions, continuations, errors, output limits, isolated runs and cancellation','BiwaScheme 0.8.3; wide/narrow; non-Wasm');

  await evaluate(`window.MUSEUM_LAB.open('lua')`);
  await output('Hello, C!\nHello, Lisp!\nHello, Lua!');
  await edit('local total=0; for i=1,10 do total=total+i end; print(total)');await output('55');
  await edit('local = 1');await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  await edit('print(string.rep("x",50000)); error("after full logs")');
  await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.equal(await evaluate(`document.querySelector('#lab-result').textContent.length`),20000);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/after full logs/);
  await edit('while true do end');await wait(`document.querySelector('#lab-result').textContent.includes('超过 2 秒')`);
  await edit('print(42)');await output('42');
  await edit('saved=7; print(saved)');await output('7');
  await edit('print(saved)');await output('nil');
  await edit('-- Lua example\nlocal value = 55\nprint(value)');await output('55');
  assert.ok(await evaluate(`document.querySelectorAll('#lab-highlight .tok-comment').length>0`));
  for(const width of [1440,390]){
    await page('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1000,deviceScaleFactor:1,mobile:width===390});
    await screenshot('lua-lab-'+width+'.png');
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
  }
  await page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await edit('while true do end');
  await wait(`document.querySelector('#lab-result').textContent==='正在运行 Lua…'`);
  await evaluate(`document.querySelector('#timeline-view').click();setRelationScope('all')`);
  assert.equal(await evaluate(`window.__museumWorkers.filter(w=>w.observedURL==='lua-worker.js').every(w=>w.observedTerminated)`),true);
  await evaluate(`window.MUSEUM_LAB.open('lua')`);
  await edit('print(55)');await output('55');
  await record('Lua bundled Wasm output, syntax errors, isolation, timeout recovery and tab cancellation','55; Lua 5.4; wide/narrow');

  await evaluate(`(()=>{const select=document.querySelector('#lab-language');select.value='python';select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait(`document.querySelector('#lab-result').dataset.state==='ok'`,35000);
  await edit('print(sum(range(1, 11)))');await output('55');
  await record('Python HTTP-loaded Pyodide execution','55');
  const wasmResponse=runtimeResponses.find(response=>response.file.endsWith('.wasm'));
  assert.ok(wasmResponse,'Chrome must load actual Wasm');assert.equal(wasmResponse.status,200);assert.ok(wasmResponse.mimeType.startsWith('application/wasm'));assert.equal(wasmResponse.encoding,'br');
  await record('Chrome loads Brotli-compressed Wasm with correct MIME',wasmResponse);
  await edit('print(321)');await output('321');
  const count=await evaluate(`window.__museumWorkers.filter(w=>w.observedURL==='python-worker.js').length`);assert.ok(count>0);
  await evaluate(`document.querySelector('#timeline-view').click();document.querySelector('.dock[data-id="python"]').click();document.querySelector('#detail-open-lab').click();`);
  await wait(`document.querySelector('#lab').hidden===false`);
  assert.equal(await evaluate(`window.__museumWorkers.filter(w=>w.observedURL==='python-worker.js').length`),count);
  assert.equal(await evaluate(`document.querySelector('#lab-result').textContent`),'321');
  assert.equal(await evaluate(`document.querySelector('#lab-code').value`),'print(321)');
  await record('Python archive reopening reuses worker, draft and result',count);
  await edit('print("x" * 50000)\nraise ValueError("after full logs")');
  await wait(`document.querySelector('#lab-result').dataset.state==='error' && document.querySelector('#lab-result').textContent.includes('ValueError: after full logs')`);
  assert.equal(await evaluate(`document.querySelector('#lab-result').textContent.length`),20000);
  await record('Python bounded output preserves actual exception',20000);
  await edit('while True:\n    pass');
  await wait(`document.querySelector('#lab-result').textContent.includes('运行超过 3 秒')`,10000);
  await edit('print(9)');await output('9');
  await record('Python infinite loop termination and recovery','9');
  await evaluate(`document.querySelector('#timeline-view').click();setRelationScope('all')`);
  assert.equal(await evaluate(`document.querySelector('.dock[data-id="vbscript"]').classList.contains('dot')`),false,'Reviewed TIOBE VBScript must be a persistent label');
  for(const id of ['vba','vbscript']){
    assert.equal(await evaluate(`!!document.querySelector('.dock[data-id="${id}"]')`),true);
    await evaluate(`document.querySelector('.dock[data-id="${id}"]').click();var museumCheckChoice=document.querySelector('.nearby-list:not([hidden]) [data-nearby="${id}"]');if(museumCheckChoice)museumCheckChoice.click();`);
    for(const [from,to] of [['visual-basic','vba'],['vba','vbscript']])assert.equal(await evaluate(`!!document.querySelector('#relations path.related-edge[data-from="${from}"][data-to="${to}"]')`),true);
    assert.equal(await evaluate(`document.querySelector('#detail').textContent.includes('For...Next')`),true);
    if(id==='vbscript')assert.equal(await evaluate(`document.querySelector('#detail').textContent.includes('弃用')`),true);
    await new Promise(resolve=>setTimeout(resolve,1000));await screenshot(id+'-river.png');
  }
  await record('Reviewed VBA and VBScript map nodes, family links and detail evidence','Visual Basic → VBA → VBScript');
  await evaluate(`document.querySelector('#lineage-view').click();document.querySelector('.dock[data-id="vbscript"]').click();var museumCheckChoice=document.querySelector('.nearby-list:not([hidden]) [data-nearby="vbscript"]');if(museumCheckChoice)museumCheckChoice.click();`);
  assert.equal(await evaluate(`!!document.querySelector('#relations path.related-edge[data-from="vba"][data-to="vbscript"]')`),true);
  await new Promise(resolve=>setTimeout(resolve,1000));await screenshot('vbscript-lineage.png');
  for(const [id,upstream] of [['kotlin',['java','csharp','javascript','scala','groovy']],['lua',['scheme','cpp','snobol','awk']]]){
    await evaluate(`document.querySelector('#timeline-view').click();document.querySelector('.dock[data-id="${id}"]').click()`);
    for(const from of upstream)assert.equal(await evaluate(`!!document.querySelector('#relations path.related-edge[data-from="${from}"][data-to="${id}"]')`),true,from+' → '+id);
    const source=id==='kotlin'?'https://kotlinlang.org/docs/faq.html':'https://www.lua.org/doc/hopl.pdf';
    assert.equal(await evaluate(`!!document.querySelector('#detail-content a[href="${source}"]')`),true);
    await new Promise(resolve=>setTimeout(resolve,1000));await screenshot(id+'-river.png');await checkLabels([id,...upstream]);
    await evaluate(`document.querySelector('#lineage-view').click()`);
    for(const from of upstream)assert.equal(await evaluate(`!!document.querySelector('#relations path.related-edge[data-from="${from}"][data-to="${id}"]')`),true);
    await new Promise(resolve=>setTimeout(resolve,1000));await screenshot(id+'-lineage.png');await checkLabels([id,...upstream]);
    await record(id+' reviewed design links appear in river and lineage views',upstream);
  }
  await evaluate(`window.MUSEUM_LAB.open('python')`);
  await output('9');
  await screenshot('python-wide.png');
  const wide=await evaluate(`({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight})`);
  assert.ok(wide.scrollWidth<=wide.width);assert.ok(wide.scrollHeight<=wide.height);
  await record('Wide lab fits viewport',wide);
  await page('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await screenshot('python-narrow.png');
  const narrow=await evaluate(`({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight})`);
  assert.ok(narrow.scrollWidth<=narrow.width);assert.ok(narrow.scrollHeight<=narrow.height);
  await record('Narrow lab fits viewport',narrow);
  const shellExamples={
    bash:JSON.parse(fs.readFileSync(path.join(root,'data/audit/runtime-checks.json'),'utf8')).results.find(record=>record.id==='bash').sample,
    'korn-shell':JSON.parse(fs.readFileSync(path.join(root,'data/audit/ksh93-runtime-checks.json'),'utf8')).samples[0].sample,
    tcsh:JSON.parse(fs.readFileSync(path.join(root,'data/audit/tcsh-runtime-checks.json'),'utf8')).samples[0].sample
  },shellLabChecks=[];
  for(const size of [{width:1440,height:1000},{width:390,height:844}]){
    await page('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:1,mobile:size.width<500});
    for(const [id,code] of Object.entries(shellExamples)){
      await evaluate(`window.MUSEUM_LAB.open(${JSON.stringify(id)})`);
      const state=await evaluate(`({code:document.querySelector('#lab-code').value,disabled:document.querySelector('#lab-run').disabled,reset:document.querySelector('#lab-reset').disabled,result:document.querySelector('#lab-result').textContent,note:document.querySelector('#lab-status').textContent,keywords:document.querySelectorAll('#lab-highlight .tok-keyword').length,canRun:window.MUSEUM_LAB.canRun(${JSON.stringify(id)})})`);
      assert.equal(state.code,code,'Editor example must match the actual native execution sample');
      assert.ok(state.disabled&&!state.reset&&!state.canRun&&state.keywords>0);
      assert.ok(state.result.includes('尚未接入')&&state.note.includes('本机核验'));
      const draft=code+'# editable draft\n';await edit(draft);
      await evaluate(`window.MUSEUM_LAB.open('c');window.MUSEUM_LAB.open(${JSON.stringify(id)})`);
      assert.equal(await evaluate(`document.querySelector('#lab-code').value`),draft,'Shell draft must survive language navigation');
      assert.equal(await evaluate(`document.querySelector('#lab-result').textContent`),state.result,'Editing must not fabricate shell output');
      await evaluate(`document.querySelector('#lab-reset').click()`);
      assert.equal(await evaluate(`document.querySelector('#lab-code').value`),code);
      await screenshot(`shell-lab-${id}-${size.width}.png`);
      shellLabChecks.push({id,width:size.width,nativeSampleMatched:true,onlineRuntime:false});
    }
  }
  await record('Editable shell samples match native evidence and never fabricate browser results',shellLabChecks);
  for(const [id,upstream] of [['lua',['scheme','cpp','snobol','awk']],['kotlin',['java','csharp','javascript','scala','groovy']]]){
    await evaluate(`document.querySelector('#timeline-view').click();document.querySelector('.dock[data-id="${id}"]').click()`);
    await new Promise(resolve=>setTimeout(resolve,1000));await checkLabels([id,...upstream]);await screenshot(id+'-narrow-river.png');
    await evaluate(`document.querySelector('#lineage-view').click()`);
    await new Promise(resolve=>setTimeout(resolve,1000));const metrics=await checkLabels([id,...upstream]);await screenshot(id+'-narrow-lineage.png');
    await evaluate(`document.querySelector('#zoom-in').click()`);
    await new Promise(resolve=>setTimeout(resolve,200));await checkLabels([id,...upstream]);
    await evaluate(`document.querySelector('#zoom-fit').click()`);
    await new Promise(resolve=>setTimeout(resolve,200));await checkLabels([id,...upstream]);
    await record(id+' focus labels avoid overlaps and guides remain aligned after zoom and fit',metrics);
  }
  const algolChecks=[];
  for(const size of [{width:1440,height:1000},{width:390,height:844}]){
    await page('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:1,mobile:size.width<500});
    for(const mode of ['timeline','lineage']){
      await evaluate(`document.querySelector('#design-layer').click();document.querySelector('#${mode}-view').click();document.querySelector('.dock[data-id="algol-60"]').click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      assert.equal(await evaluate(`document.querySelector('.dock[data-id="algol-60"]').classList.contains('dot')`),false,'Concrete ALGOL 60 must be a historical label');
      for(const to of ['pascal','simula','oberon'])assert.equal(await evaluate(`!!document.querySelector('#relations .related-edge[data-from="algol-60"][data-to="${to}"]')`),true,'Existing ALGOL 60 relation endpoint must stay concrete');
      assert.equal(await evaluate(`!!document.querySelector('#detail-content a[href="https://ftp.gnu.org/gnu/marst/marst-2.8.tar.gz"]')`),true,'ALGOL 60 implementation source must be available');
      assert.equal(await evaluate(`document.querySelector('#detail-content').textContent.includes('实际输出55、720、6')`),true);
      await checkLabels(['algol-60','pascal','simula','oberon']);
      assert.equal(await evaluate(`Array.from(document.querySelectorAll('#detail-content .relation-link')).filter(button=>button.dataset.evidenceState==='record-field-only').length`),4,'Four remaining ALGOL 60 field-only relations must stay pending');
      for(const to of ['pascal','simula']){
        assert.equal(await evaluate(`document.querySelector('#detail-content .relation-link[data-related="${to}"]').dataset.evidenceState`),'claim-with-citation','ALGOL 60 relationship must expose its new primary-source argument');
        assert.equal(await evaluate(`document.querySelector('#relations .related-edge[data-from="algol-60"][data-to="${to}"]').dataset.evidenceState`),'claim-with-citation','ALGOL 60 edge must match the cited card');
      }
      assert.equal(await evaluate(`document.querySelector('#detail-content').innerText.includes('参数机制的设计回应')`),true,'Pascal parameter influence must be described specifically');
      await evaluate(`document.querySelector('#detail-content .relation-link[data-related="pascal"]').scrollIntoView({block:'center'})`);
      await screenshot(`algol60-${mode}-${size.width}.png`);algolChecks.push({mode,width:size.width});
    }
  }
  await record('Concrete ALGOL 60 label, preserved version endpoints and pending relation evidence',algolChecks);
  const basicChecks=[];
  for(const size of [{width:1440,height:1000},{width:390,height:844}]){
    await page('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:1,mobile:size.width<500});
    for(const mode of ['timeline','lineage']){
      await evaluate(`document.querySelector('#design-layer').click();document.querySelector('#${mode}-view').click();document.querySelector('.dock[data-id="basic"]').click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      await checkLabels(['basic','fortran','algol']);
      for(const from of ['fortran','algol']){
        assert.equal(await evaluate(`document.querySelector('#relations .related-edge[data-from="${from}"][data-to="basic"]')?.dataset.evidenceState`),'claim-with-citation');
        assert.equal(await evaluate(`document.querySelector('#detail-content .relation-link[data-related="${from}"]')?.textContent.includes('初学者语言设计的参照与回应')`),true);
      }
      assert.equal(await evaluate(`!!document.querySelector('#relations .related-edge[data-from="algol-60"][data-to="basic"]')`),false,'Unspecified ALGOL edition must not be converted to ALGOL 60');
      for(const url of ['https://time.com/69316/basic/','https://bitsavers.org/pdf/dartmouth/dtss/196410_BASIC.pdf'])assert.equal(await evaluate(`!!document.querySelector('#detail-content a[href="${url}"]')`),true);
      assert.equal(await evaluate(`document.querySelector('#detail-content').textContent.includes('发现不可行')`),true,'Failed subset attempt must retain scope');
      assert.equal(await evaluate(`document.querySelectorAll('.map-run').length`),0);
      await screenshot(`basic-design-${mode}-${size.width}.png`);basicChecks.push({mode,width:size.width});
    }
  }
  await record('BASIC designer interview links Fortran and ALGOL without inventing subset or edition',basicChecks);
  const forthChecks=[];
  for(const size of [{width:1440,height:1000},{width:390,height:844}]){
    await page('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:1,mobile:size.width<500});
    for(const mode of ['timeline','lineage']){
      await evaluate(`document.querySelector('#design-layer').click();document.querySelector('#${mode}-view').click();document.querySelector('.dock[data-id="forth"]').click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      await checkLabels(['forth','apl','algol','fortran','postscript']);
      for(const [from,to] of [['apl','forth'],['algol','forth'],['fortran','forth'],['forth','postscript']]){
        assert.equal(await evaluate(`document.querySelector('#relations [data-from="${from}"][data-to="${to}"]')?.dataset.evidenceState`),'claim-with-citation','Forth/PostScript design inputs must retain cited evidence');
        assert.equal(await evaluate(`document.querySelector('#relations [data-from="${from}"][data-to="${to}"]')?.dataset.relationType`),'influencedBy','Local design influence must not become strict succession');
      }
      assert.equal(await evaluate(`!!document.querySelector('#relations [data-from="algol-60"][data-to="forth"]')`),false,'Unspecified Algol edition must remain a family endpoint');
      assert.equal(await evaluate(`!!document.querySelector('#detail-content a[href="https://raw.githubusercontent.com/colorforth/colorforth.github.io/master/HOPL.html"]')`),true);
      await screenshot(`forth-design-${mode}-${size.width}.png`);
      await evaluate(`document.querySelector('#detail-content .relation-link[data-related="postscript"]').click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      await checkLabels(['postscript','forth','lisp']);
      assert.equal(await evaluate(`document.querySelector('#relations .related-edge[data-from="lisp"][data-to="postscript"]')?.dataset.evidenceState`),'claim-with-citation','Selecting PostScript must expose its independent Lisp input');
      assert.equal(await evaluate(`document.querySelector('#relations .related-edge[data-from="lisp"][data-to="postscript"]')?.dataset.relationType`),'influencedBy');
      assert.equal(await evaluate(`!!document.querySelector('#detail-content a[href="https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf"]')`),true);
      assert.equal(await evaluate(`document.querySelector('#detail-content').textContent.includes('本轮未执行解释器')`),true);
      assert.equal(await evaluate(`document.querySelectorAll('.map-run').length`),0,'Historical interpreter documentation must not advertise online execution');
      await screenshot(`postscript-design-${mode}-${size.width}.png`);
      forthChecks.push({mode,width:size.width});
    }
  }
  await record('Forth and PostScript retain specific author-documented design inputs',forthChecks);
  const cobolChecks=[];
  for(const size of [{width:1440,height:1000},{width:390,height:844}]){
    await page('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:1,mobile:size.width<500});
    for(const mode of ['timeline','lineage']){
      await evaluate(`document.querySelector('#design-layer').click();document.querySelector('#${mode}-view').click();document.querySelector('#detail').scrollTop=500;document.querySelector('.dock[data-id="cobol"]').click();document.querySelector('.nearby-list:not([hidden]) [data-nearby="cobol"]')?.click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      await checkLabels(['cobol','flow-matic']);
      assert.equal(await evaluate(`document.querySelector('#detail').scrollTop`),0,'Selecting a map language must show its archive title');
      assert.equal(await evaluate(`document.querySelector('#relations .related-edge[data-from="flow-matic"][data-to="cobol"]')?.dataset.evidenceState`),'claim-with-citation');
      assert.equal(await evaluate(`document.querySelector('#relations .related-edge[data-from="flow-matic"][data-to="cobol"]')?.dataset.relationType`),'influencedBy');
      assert.equal(await evaluate(`!!document.querySelector('#detail-content a[href="https://bitsavers.org/pdf/codasyl/COBOL_Report_Apr60.pdf"]')`),true);
      assert.equal(await evaluate(`document.querySelector('#detail-content').textContent.includes('1959年报告形成与1960年批准分开记录')`),true);
      assert.equal(await evaluate(`document.querySelectorAll('.map-run').length`),0);
      await screenshot(`cobol-flowmatic-${mode}-${size.width}.png`);
      await evaluate(`document.querySelector('#detail').scrollTop=500;document.querySelector('#detail-content .relation-link[data-related="flow-matic"]').click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      await checkLabels(['flow-matic','cobol']);
      assert.equal(await evaluate(`document.querySelector('#detail').scrollTop`),0,'Following a relation must reset the new archive scroll position');
      assert.equal(await evaluate(`!!document.querySelector('#detail-content a[href="https://bitsavers.org/pdf/univac/flow-matic/U1518_FLOW-MATIC_Programming_System_1958.pdf"]')`),true);
      assert.equal(await evaluate(`document.querySelector('#detail-content').textContent.includes('未复现原始编译器')`),true);
      assert.equal(await evaluate(`document.querySelectorAll('.map-run').length`),0,'Historical compiler documentation must not imply online execution');
      await evaluate(`document.querySelector('#detail-content .relation-link[data-related="cobol"]').click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      await checkLabels(['cobol','flow-matic']);
      cobolChecks.push({mode,width:size.width});
    }
  }
  await record('FLOW-MATIC historical syntax and COBOL original design input retain scope and provenance',cobolChecks);
  const erlangChecks=[];
  for(const size of [{width:1440,height:1000},{width:390,height:844}]){
    await page('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:1,mobile:size.width<500});
    for(const mode of ['timeline','lineage']){
      await evaluate(`document.querySelector('#design-layer').click();document.querySelector('#${mode}-view').click();document.querySelector('.dock[data-id="prolog"]').click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      await checkLabels(['prolog','erlang']);
      assert.equal(await evaluate(`document.querySelector('#relations .related-edge[data-from="prolog"][data-to="erlang"]')?.dataset.evidenceState`),'claim-with-citation');
      assert.equal(await evaluate(`document.querySelector('#relations .related-edge[data-from="prolog"][data-to="erlang"]')?.dataset.relationType`),'influencedBy','Early Prolog extension must not make current Erlang a superset');
      await screenshot(`prolog-erlang-${mode}-${size.width}.png`);
      await evaluate(`document.querySelector('#detail-content .relation-link[data-related="erlang"]').click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      await checkLabels(['erlang','prolog','rust']);
      assert.equal(await evaluate(`!!document.querySelector('#detail-content a[href="https://www.erlang.org/download/armstrong_thesis_2003.pdf"]')`),true);
      assert.equal(await evaluate(`document.querySelector('#detail-content').textContent.includes('移除回溯')`),true,'Historical design differences must remain explicit');
      assert.equal(await evaluate(`document.querySelector('#detail-content').textContent.includes('本轮未重现历史实现')`),true);
      assert.equal(await evaluate(`document.querySelectorAll('.map-run').length`),0,'Native or historical documentation must not imply webpage execution');
      await screenshot(`erlang-prolog-${mode}-${size.width}.png`);
      await evaluate(`document.querySelector('#detail-content .relation-link[data-related="prolog"]').click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      await checkLabels(['prolog','erlang']);
      erlangChecks.push({mode,width:size.width});
    }
  }
  await record('Prolog Erlang historical design link supports upstream and downstream navigation',erlangChecks);
  const vhdlChecks=[];
  for(const size of [{width:1440,height:1000},{width:390,height:844}]){
    await page('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:1,mobile:size.width<500});
    for(const mode of ['timeline','lineage']){
      await evaluate(`document.querySelector('#design-layer').click();document.querySelector('#${mode}-view').click();document.querySelector('.dock[data-id="vhdl"]').click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      await checkLabels(['vhdl','ada']);
      const edge=await evaluate(`(()=>{const e=document.querySelector('#relations .related-edge[data-from="ada"][data-to="vhdl"]');return {state:e?.dataset.evidenceState,type:e?.dataset.relationType}})()`);
      assert.deepEqual(edge,{state:'claim-with-citation',type:'influencedBy'});
      assert.equal(await evaluate(`!!document.querySelector('#detail-content a[href="https://ghdl.github.io/ghdl/about.html"]')`),true);
      const description=await evaluate(`document.querySelector('#detail-content').textContent`);
      assert.ok(description.includes('实现项目')&&description.includes('事件驱动')&&description.includes('非原始设计者论文'),'VHDL influence must retain source level and hardware semantics');
      assert.equal(await evaluate(`document.querySelectorAll('.map-run').length`),0,'GHDL documentation must not imply an online runtime');
      await evaluate(`document.querySelector('#detail-content .relation-link[data-related="ada"]').focus({preventScroll:true})`);
      assert.equal(await evaluate(`!!document.querySelector('.dock[data-id="ada"].preview-target')&&!!document.querySelector('#relations .preview-edge[data-from="ada"][data-to="vhdl"]')`),true);
      await evaluate(`document.querySelector('#detail-content .relation-link[data-related="ada"]').blur()`);
      await screenshot(`vhdl-ada-${mode}-${size.width}.png`);
      await evaluate(`document.querySelector('#detail-content .relation-link[data-related="ada"]').click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      assert.equal(await evaluate(`document.querySelector('#detail-content .relation-link[data-related="vhdl"]')?.dataset.evidenceState`),'claim-with-citation');
      await evaluate(`document.querySelector('#detail-content .relation-link[data-related="vhdl"]').click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      await checkLabels(['vhdl','ada']);
      vhdlChecks.push({mode,width:size.width});
    }
  }
  await record('Ada VHDL design influence preserves hardware semantics and source level',vhdlChecks);
  const wirthChecks=[];
  for(const size of [{width:1440,height:1000},{width:390,height:844}]){
    await page('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:1,mobile:size.width<500});
    for(const mode of ['timeline','lineage']){
      await evaluate(`document.querySelector('#design-layer').click();document.querySelector('#${mode}-view').click();document.querySelector('.dock[data-id="modula-2"]').click();var wirthChoice=document.querySelector('.nearby-list:not([hidden]) [data-nearby="modula-2"]');if(wirthChoice)wirthChoice.click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      await checkLabels(['modula-2','pascal','oberon']);
      for(const [from,to,type] of [['pascal','modula-2','successorOf'],['modula-2','oberon','influencedBy']]){
        const edge=await evaluate(`(()=>{const e=document.querySelector('#relations .related-edge[data-from="${from}"][data-to="${to}"]');return {state:e?.dataset.evidenceState,type:e?.dataset.relationType}})()`);
        assert.deepEqual(edge,{state:'claim-with-citation',type},'Wirth chain must retain exact relation meaning and citation tier');
      }
      for(const id of ['mesa','modula']){
        assert.equal(await evaluate(`!!document.querySelector('#detail-content .relation-link[data-related="${id}"]')`),true,'Nonmap predecessor must remain accessible from archive');
        assert.equal(await evaluate(`!!document.querySelector('#docks .dock[data-id="${id}"]')`),false,'Historical relation alone must not fabricate map eligibility');
      }
      assert.equal(await evaluate(`!!document.querySelector('#detail-content a[href="https://people.inf.ethz.ch/wirth/Articles/Modula-Oberon-June.pdf"]')`),true,'Designer source must be reachable');
      assert.equal(await evaluate(`document.querySelector('#detail-content').textContent.includes('本轮未重现执行')`),true,'Historical compiler must not imply current execution');
      assert.equal(await evaluate(`document.querySelectorAll('.map-run').length`),0,'Modula-2 must not advertise a webpage runtime');
      await screenshot(`wirth-chain-${mode}-${size.width}.png`);wirthChecks.push({mode,width:size.width});
    }
  }
  await record('Pascal Modula-2 Oberon design chain and nonmap predecessors retain cited scope',wirthChecks);
  const kornChecks=[];
  for(const size of [{width:1440,height:1000},{width:390,height:844}]){
    await page('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:1,mobile:size.width<500});
    for(const mode of ['timeline','lineage']){
      await evaluate(`document.querySelector('#${mode}-view').click();document.querySelector('#design-layer').click();document.querySelector('.dock[data-id="korn-shell"]').click();document.querySelector('.nearby-list:not([hidden]) [data-nearby="korn-shell"]')?.click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      await checkLabels(['korn-shell','sh','c','bash']);
      for(const from of ['sh','c'])assert.equal(await evaluate(`document.querySelector('#relations [data-from="${from}"][data-to="korn-shell"]')?.dataset.relationType`),'influencedBy');
      for(const from of ['sh','c','c-shell'])assert.equal(await evaluate(`!!document.querySelector('#detail-content .relation-link[data-related="${from}"]')`),true);
      assert.equal(await evaluate(`!!document.querySelector('#detail-content a[href="https://www.usenix.org/legacy/publications/library/proceedings/vhll/full_papers/korn.ksh.a"]')`),true);
      assert.equal(await evaluate(`document.querySelector('#detail-content').textContent.includes('Version AJM 93u+ 2012-08-01')`),true);
      assert.equal(await evaluate(`document.querySelector('#detail-content').textContent.includes('创造者：David G. Korn')&&document.querySelector('#detail-content').textContent.includes('创造者：未记载 → David G. Korn')`),true,'Reviewed author must be filled with visible original absence and correction provenance');
      assert.equal(await evaluate(`document.querySelectorAll('.map-run').length`),0,'Local ksh93 sample execution must not advertise webpage execution');
      await screenshot(`korn-inputs-${mode}-${size.width}.png`);
      await evaluate(`document.querySelector('#detail-content .relation-link[data-related="sh"]').click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      assert.equal(await evaluate(`!!document.querySelector('#detail-content a[href="https://www.tuhs.org/Archive/Documentation/Papers/BSTJ/bstj57-6-1971.pdf"]')`),true);
      assert.equal(await evaluate(`document.querySelector('#detail-content').textContent.includes('1971，明确发表于1978年7–8月')`),true);
      assert.equal(await evaluate(`!!document.querySelector('#detail-content .relation-link[data-related="korn-shell"]')`),true);
      await evaluate(`document.querySelector('#detail-content .relation-link[data-related="korn-shell"]').click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      await checkLabels(['korn-shell','sh','c','bash']);
      kornChecks.push({mode,width:size.width});
    }
  }
  await record('Korn designer-backed upstream links and Bourne publication event remain scoped',kornChecks);
  const cshChecks=[];
  for(const size of [{width:1440,height:1000},{width:390,height:844}]){
    await page('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:1,mobile:size.width<500});
    for(const mode of ['timeline','lineage']){
      await evaluate(`document.querySelector('#${mode}-view').click();document.querySelector('#design-layer').click();document.querySelector('.dock[data-id="c-shell"]').click();document.querySelector('.nearby-list:not([hidden]) [data-nearby="c-shell"]')?.click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      await checkLabels(['c-shell','c','tcsh','bash','korn-shell']);
      assert.equal(await evaluate(`document.querySelector('#relations [data-from="c"][data-to="c-shell"]')?.dataset.relationType`),'influencedBy');
      assert.equal(await evaluate(`document.querySelector('#relations [data-from="c"][data-to="c-shell"]')?.dataset.evidenceState`),'claim-with-citation');
      assert.equal(await evaluate(`document.querySelector('#relations [data-from="c-shell"][data-to="tcsh"]')?.dataset.relationType`),'supersetOf');
      for(const to of ['bash','korn-shell'])assert.equal(await evaluate(`document.querySelector('#relations [data-from="c-shell"][data-to="${to}"]')?.dataset.relationType`),'influencedBy');
      assert.equal(await evaluate(`document.querySelector('#detail-content').textContent.includes('创造者：未记载 → William Joy')`),true);
      assert.equal(await evaluate(`!!document.querySelector('#detail-content a[href="https://www.tuhs.org/cgi-bin/utree.pl?file=2BSD/src/csh/sh.c"]')`),true);
      assert.equal(await evaluate(`document.querySelectorAll('.map-run').length`),0);
      await screenshot(`cshell-chain-${mode}-${size.width}.png`);
      await evaluate(`document.querySelector('#detail-content .relation-link[data-related="c"]').click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      assert.equal(await evaluate(`!!document.querySelector('#detail-content .relation-link[data-related="c-shell"]')`),true,'C archive must retain the downstream C shell design reference');
      await evaluate(`document.querySelector('#detail-content .relation-link[data-related="c-shell"]').click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      await evaluate(`document.querySelector('#detail-content .relation-link[data-related="tcsh"]').click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      await checkLabels(['tcsh','c-shell']);
      assert.equal(await evaluate(`!!document.querySelector('#detail-content a[href="https://raw.githubusercontent.com/tcsh-org/tcsh/TCSH6_21_00/tcsh.man"]')`),true);
      assert.equal(await evaluate(`document.querySelectorAll('.map-run').length`),0,'Historical or native shell evidence must not imply online execution');
      await evaluate(`document.querySelector('#detail-content .relation-link[data-related="c-shell"]').click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      await checkLabels(['c-shell','c','tcsh','bash','korn-shell']);
      cshChecks.push({mode,width:size.width});
    }
  }
  await record('Historical C shell evidence and tcsh version-scoped extension remain distinct',cshChecks);
  const shellXsltChecks=[];
  for(const size of [{width:1440,height:1000},{width:390,height:844}]){
    await page('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:1,mobile:size.width<500});
    for(const mode of ['timeline','lineage']){
      await evaluate(`document.querySelector('#${mode}-view').click();document.querySelector('#design-layer').click();document.querySelector('.dock[data-id="bash"]').click();document.querySelector('.nearby-list:not([hidden]) [data-nearby="bash"]')?.click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      await checkLabels(['bash','sh','korn-shell']);
      for(const from of ['sh','korn-shell'])assert.equal(await evaluate(`document.querySelector('#relations [data-from="${from}"][data-to="bash"]')?.dataset.relationType`),'influencedBy');
      for(const from of ['sh','korn-shell','c-shell'])assert.equal(await evaluate(`!!document.querySelector('#detail-content .relation-link[data-related="${from}"]')`),true);
      assert.equal(await evaluate(`!!document.querySelector('#detail-content a[href="https://mirrors.kernel.org/gnu/bash/bash-5.3.tar.gz"]')`),true);
      assert.equal(await evaluate(`window.MUSEUM_DATA.edges.some(e=>['sh','bourne-shell'].includes(e.from)&&['sh','bourne-shell'].includes(e.to))`),false,'Potential duplicate records must not become inheritance');
      assert.equal(await evaluate(`document.querySelectorAll('.map-run').length`),0);
      await screenshot(`bash-inputs-${mode}-${size.width}.png`);
      await evaluate(`document.querySelector('#detail-content .relation-link[data-related="sh"]').click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      assert.equal(await evaluate(`document.querySelector('#detail-content').textContent.includes('馆藏另有 bourne-shell')`),true);
      await evaluate(`document.querySelector('#detail-content .relation-link[data-related="bash"]').click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      await checkLabels(['bash','sh','korn-shell']);
      shellXsltChecks.push({mode,width:size.width});
    }
    await evaluate(`document.querySelector('#timeline-view').click();document.querySelector('.dock[data-id="xslt"]').click();document.querySelector('.nearby-list:not([hidden]) [data-nearby="xslt"]')?.click()`);
    await new Promise(resolve=>setTimeout(resolve,1000));
    assert.equal(await evaluate(`window.MUSEUM_DATA.records.find(r=>r.id==='xslt').review.status`),'verified-language');
    for(const url of ['https://www.w3.org/TR/1999/REC-xslt-19991116','https://raw.githubusercontent.com/GNOME/libxslt/v1.1.35/doc/intro.html'])assert.equal(await evaluate(`Array.from(document.querySelectorAll('#detail-content a')).some(a=>a.getAttribute('href')===${JSON.stringify(url)})`),true);
    assert.equal(await evaluate(`document.querySelectorAll('.map-run').length`),0,'Native XSLT evidence must not imply a webpage runtime');
    await checkLabels(['xslt']);
    await screenshot(`xslt-evidence-${size.width}.png`);
  }
  await record('Bash documented design inputs and XSLT implementation retain source and runtime scope',shellXsltChecks);
  const ecologyChecks=[];
  for(const size of [{width:1440,height:1000},{width:390,height:844}]){
    await page('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:1,mobile:size.width<500});
    for(const mode of ['timeline','lineage']){
      await evaluate(`document.querySelector('#${mode}-view').click();document.querySelector('#ecosystem-layer').click()`);
      for(const id of ['python','rust','zig','powershell']){
        await evaluate(`document.querySelector('.dock[data-id="${id}"]').click()`);
        await new Promise(resolve=>setTimeout(resolve,1000));
        const direct=await evaluate(`(()=>{const id=${JSON.stringify(id)},data=window.MUSEUM_DATA;return [...new Set([id,...data.ecosystemEdges.filter(edge=>edge.from===id||edge.to===id).flatMap(edge=>[edge.from,edge.to])])];})()`);
        await checkLabels(direct);
        assert.equal(await evaluate(`Array.from(document.querySelectorAll('#relations .related-edge')).every(path=>{const matrix=path.getScreenCTM();return getComputedStyle(path).vectorEffect==='none'&&Math.abs(parseFloat(getComputedStyle(path).strokeWidth)*Math.hypot(matrix.a,matrix.b)-1.5)<.02;})`),true,'Focused relations must retain readable screen stroke width');
        assert.equal(await evaluate(`document.querySelectorAll('#relations .related-edge:not(.ecology-edge),#relations .related-edge[marker-end]').length`),0,'Ecosystem must not show design arrows');
        for(const other of direct.filter(other=>other!==id))assert.equal(await evaluate(`!!document.querySelector('#detail-content .relation-link[data-related="${other}"]')`),true);
        await screenshot(`ecology-${id}-${mode}-${size.width}.png`);
        if(id==='zig'){
          assert.equal(await evaluate(`!!document.querySelector('#relations .ecology-edge[data-from="c"][data-to="zig"]')`),true,'C/Zig ecology edge must be visible');
          assert.equal(await evaluate(`!!document.querySelector('#detail-content a[href="https://ziglang.org/learn/overview/"]')`),true,'C/Zig must retain official source');
        }
        if(id==='powershell'){
          assert.equal(await evaluate(`document.querySelector('#relations .ecology-edge[data-from="csharp"][data-to="powershell"]')?.dataset.relationType`),'extensionInterface','Add-Type must remain an extension interface');
          for(const url of ['https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/add-type','https://www.jsnover.com/Docs/MonadManifesto.pdf'])assert.equal(await evaluate(`!!document.querySelector('#detail-content a[href="${url}"]')`),true,'PowerShell research sources must remain reachable');
          assert.equal(await evaluate(`document.querySelector('#detail-content').textContent.includes('本轮未执行该接口')`),true);
          assert.equal(await evaluate(`document.querySelectorAll('.map-run').length`),0,'Documented Add-Type must not imply a browser compiler');
          assert.deepEqual(await evaluate(`window.MUSEUM_DATA.edges.filter(edge=>edge.from==='powershell'||edge.to==='powershell').map(edge=>[edge.from,edge.to,edge.type])`),[['sh','powershell','influencedBy']],'Specific Bourne influence must not imply Bash or C# inheritance');
          await evaluate(`document.querySelector('#design-layer').click()`);
          await new Promise(resolve=>setTimeout(resolve,1000));
          assert.equal(await evaluate(`!!document.querySelector('#relations [data-from="sh"][data-to="powershell"]')`),true);
          await checkLabels(['powershell','sh']);
          await screenshot(`bourne-powershell-${mode}-${size.width}.png`);
          await evaluate(`document.querySelector('#detail-content .relation-link[data-related="sh"]').click()`);
          await new Promise(resolve=>setTimeout(resolve,1000));
          assert.equal(await evaluate(`document.querySelector('#detail-content h2').textContent`),'Bourne shell (sh)');
          assert.equal(await evaluate(`(()=>{const r=window.MUSEUM_DATA.records.find(r=>r.id==='sh');return r.year===1979&&r.review.catalogueCorrection.changes[1].from===1971})()`),true);
          assert.equal(await evaluate(`document.querySelector('#detail-content').textContent.includes('年代：1971 → 1979 · Unix V7 发布')`),true);
          for(const url of ['https://www.tuhs.org/cgi-bin/utree.pl?file=V7/usr/src/cmd/sh/main.c','https://www.tuhs.org/cgi-bin/utree.pl?file=V7/usr/man/man1/sh.1'])assert.equal(await evaluate(`Array.from(document.querySelectorAll('#detail-content a')).some(a=>a.getAttribute('href')===${JSON.stringify(url)})`),true);
          assert.equal(await evaluate(`document.querySelectorAll('.map-run').length`),0);
          await checkLabels(['sh','powershell']);
          await screenshot(`bourne-correction-${mode}-${size.width}.png`);
          await evaluate(`document.querySelector('#detail-content .relation-link[data-related="powershell"]').click();document.querySelector('#ecosystem-layer').click()`);
          await new Promise(resolve=>setTimeout(resolve,1000));
        }
        ecologyChecks.push({id,mode,width:size.width,direct});
      }
      await evaluate(`document.querySelector('.dock[data-id="python"]').click();document.querySelector('#design-layer').click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      assert.equal(await evaluate(`document.querySelectorAll('#relations .ecology-edge').length`),0,'Switching back must clear ecosystem edges');
      await evaluate(`document.querySelector('#zoom-in').click();document.querySelector('#zoom-in').click();document.querySelector('#zoom-in').click();`);
      const before=await evaluate(`({left:document.querySelector('#viewport').scrollLeft,top:document.querySelector('#viewport').scrollTop})`);
      await evaluate(`document.querySelector('#detail-content .relation-link[data-related="abc"]').focus({preventScroll:true})`);
      assert.equal(await evaluate(`!!document.querySelector('.dock[data-id="abc"].preview-target')&&!!document.querySelector('#relations .preview-edge')`),true,'Keyboard preview must highlight ABC and its actual edge');
      const during=await evaluate(`({left:document.querySelector('#viewport').scrollLeft,top:document.querySelector('#viewport').scrollTop})`);
      if(size.width<500)assert.notDeepEqual(during,before,'Narrow zoomed preview must actually pan to ABC');
      await checkLabels(['python','abc']);
      await screenshot(`preview-python-abc-${mode}-${size.width}.png`);
      await evaluate(`document.querySelector('#detail-content .relation-link[data-related="abc"]').blur()`);
      const after=await evaluate(`({left:document.querySelector('#viewport').scrollLeft,top:document.querySelector('#viewport').scrollTop})`);
      assert.deepEqual(after,before,'Leaving preview must restore previous map scroll');
      assert.equal(await evaluate(`!!document.querySelector('.preview-target,.preview-edge,.relation-link.preview')`),false);
      await checkLabels(['python','abc']);
    }
  }
  await record('Python/Rust/Zig/PowerShell ecosystem layer and keyboard relation preview restore',ecologyChecks);
  async function checkRunBadge(id){
    const badge=await evaluate(`(()=>{const b=document.querySelector('.map-run'),r=b?.getBoundingClientRect(),v=document.querySelector('#viewport').getBoundingClientRect();return {id:b?.dataset.runLanguage,label:b?.getAttribute('aria-label'),width:r?.width,height:r?.height,inside:r&&r.left>=v.left&&r.right<=v.right&&r.top>=v.top&&r.bottom<=v.bottom,hit:r&&document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===b}})()`);
    assert.equal(badge.id,id);assert.match(badge.label,/浏览器(?:或远端)?运行/);
    assert.ok(Math.abs(badge.width-24)<.1&&Math.abs(badge.height-24)<.1,'Run badge must retain screen size');
    assert.equal(badge.inside,true,'Run badge must fit viewport');assert.equal(badge.hit,true,'Run badge must be clickable above the map');
    return badge;
  }
  const runBadgeChecks=[];
  for(const size of [{width:1440,height:1000},{width:390,height:844}]){
    await page('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:1,mobile:size.width<500});
    for(const mode of ['timeline','lineage']){
      for(const id of ['javascript','python','lua','scheme']){
        await evaluate(`document.querySelector('#${mode}-view').click();document.querySelector('.dock[data-id="${id}"]').click()`);
        await new Promise(resolve=>setTimeout(resolve,1000));
        await checkLabels([id]);
        const badge=await checkRunBadge(id);
        await evaluate(`document.querySelector('#zoom-in').click();document.querySelector('#zoom-in').click()`);
        await checkLabels([id]);await checkRunBadge(id);
        await evaluate(`document.querySelector('#zoom-fit').click()`);
        await checkLabels([id]);await checkRunBadge(id);
        await page('Emulation.setDeviceMetricsOverride',{width:size.width-30,height:size.height-20,deviceScaleFactor:1,mobile:size.width<500});
        await new Promise(resolve=>setTimeout(resolve,100));
        await checkLabels([id]);await checkRunBadge(id);
        await page('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:1,mobile:size.width<500});
        await new Promise(resolve=>setTimeout(resolve,100));
        await evaluate(`document.querySelector('.dock[data-id="${id}"]').click()`);
        await new Promise(resolve=>setTimeout(resolve,1000));
        await checkLabels([id]);await checkRunBadge(id);
        await screenshot(`run-badge-${id}-${mode}-${size.width}.png`);
        if(id==='javascript'){
          await evaluate(`document.querySelector('.map-run').focus()`);
          await page('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
          await page('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
        }else await evaluate(`document.querySelector('.map-run').click()`);
        await new Promise(resolve=>setTimeout(resolve,100));
        const opened=await evaluate(`({visible:!document.querySelector('#lab').hidden,id:document.querySelector('#lab-language').value,disabled:document.querySelector('#lab-run').disabled,active:document.activeElement?.outerHTML.slice(0,250)})`);
        assert.ok(opened.visible&&opened.id===id&&!opened.disabled,'Run badge must open the selected runnable language: '+JSON.stringify(opened));
        assert.equal(await evaluate(`document.activeElement===document.querySelector('#lab-code')`),true,'Direct entry must move keyboard focus to the editor');
        runBadgeChecks.push({id,mode,width:size.width,...badge});
      }
      await evaluate(`document.querySelector('#${mode}-view').click();document.querySelector('.dock[data-id="rust"]').click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      assert.equal(await evaluate(`document.querySelectorAll('.map-run').length`),0,'Editable-only Rust must not advertise online execution');
      await evaluate(`document.querySelector('.dock[data-id="python"]').click()`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      await evaluate(`document.querySelector('#viewport').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
      assert.equal(await evaluate(`document.querySelectorAll('.map-run').length`),0,'Restoring overview must clear run badge');
    }
  }
  await record('Selected runnable labels expose clickable and keyboard-accessible lab icons',runBadgeChecks);
  const mapSearchChecks=[];
  for(const size of [{width:1440,height:1000},{width:390,height:844}]){
    await page('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:1,mobile:size.width<500});
    for(const mode of ['timeline','lineage']){
      await evaluate(`document.querySelector('#design-layer').click();document.querySelector('#${mode}-view').click();document.querySelector('#close').click();`);
      const query=async value=>evaluate(`(()=>{const input=document.querySelector('#map-search');input.focus();input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
      await query('pyton');
      assert.equal(await evaluate(`document.querySelector('[data-map-result]')?.dataset.mapResult`),'python');
      await screenshot(`map-search-results-${mode}-${size.width}.png`);
      await page('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
      assert.equal(await evaluate(`document.querySelector('#map-search').getAttribute('aria-activedescendant')`),'map-search-option-0');
      await page('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
      await new Promise(resolve=>setTimeout(resolve,1000));
      assert.equal(await evaluate(`document.querySelector('.dock.selected')?.dataset.id`),'python');
      assert.equal(await evaluate(`document.querySelector('#detail h2').textContent`),'Python');
      assert.equal(await evaluate(`document.querySelector('#map-search-popup').hidden`),true);
      await checkLabels(['python']);
      await screenshot(`map-search-selected-${mode}-${size.width}.png`);
      await query('js');assert.equal(await evaluate(`document.querySelector('[data-map-result]')?.dataset.mapResult`),'javascript');
      await query('rusthon');assert.equal(await evaluate(`document.querySelector('[data-map-result]')?.dataset.mapResult`),'python');
      await query('c');
      assert.equal(await evaluate(`document.querySelector('#map-search-popup').getBoundingClientRect().bottom<=document.querySelector('#river').getBoundingClientRect().bottom+1`),true,'Search popup must fit compressed map');
      await screenshot(`map-search-many-${mode}-${size.width}.png`);
      await query('C++');assert.equal(await evaluate(`document.querySelector('[data-map-result]')?.dataset.mapResult`),'cpp');
      await query('C#');assert.equal(await evaluate(`document.querySelector('[data-map-result]')?.dataset.mapResult`),'csharp');
      await query('tcsh');
      const searchPoint=await evaluate(`(()=>{const r=document.querySelector('[data-map-result="tcsh"] strong').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
      await page('Input.dispatchMouseEvent',{type:'mousePressed',...searchPoint,button:'left',clickCount:1});
      assert.equal(await evaluate(`document.activeElement===document.querySelector('#map-search')`),true,'Mouse press must keep input focus until click, including platforms that do not focus buttons');
      assert.equal(await evaluate(`document.querySelector('#map-search-popup').hidden`),false,'Result must remain visible through mouse press');
      await page('Input.dispatchMouseEvent',{type:'mouseReleased',...searchPoint,button:'left',clickCount:1});
      await new Promise(resolve=>setTimeout(resolve,1000));
      assert.equal(await evaluate(`document.querySelector('.dock.selected')?.dataset.id`),'tcsh');
      await query('python');
      await page('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      assert.equal(await evaluate(`document.querySelector('#map-search-popup').hidden && document.querySelector('#detail').classList.contains('open')`),true);
      await query('python');await evaluate(`document.querySelector('#atlas-title').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))`);
      assert.equal(await evaluate(`document.querySelector('#map-search-popup').hidden`),true);
      await evaluate(`document.querySelector('#map-search-clear').click()`);
      assert.equal(await evaluate(`document.querySelector('#map-search').value`),'');
      const overflow=await evaluate(`document.documentElement.scrollWidth>innerWidth+1`);assert.equal(overflow,false);
      mapSearchChecks.push({mode,width:size.width,typo:'pyton → Python',dot:'tcsh',keyboard:true,escape:true,outside:true,clear:true});
    }
    await evaluate(`document.querySelector('#lineage-view').click()`);
    await evaluate(`(()=>{const input=document.querySelector('#map-search');input.focus();input.value='XSLT';input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    assert.equal(await evaluate(`document.querySelector('[data-map-result="xslt"]').textContent.includes('仅时间长河')`),true);
    await evaluate(`document.querySelector('[data-map-result="xslt"]').click()`);
    assert.equal(await evaluate(`document.querySelector('#timeline-view').getAttribute('aria-selected')`),'true');
    assert.equal(await evaluate(`document.querySelector('.dock.selected')?.dataset.id`),'xslt');
    await evaluate(`(()=>{const input=document.querySelector('#map-search');input.focus();input.value='zzzz-no-language';input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    assert.equal(await evaluate(`document.querySelectorAll('[data-map-result]').length`),0);
    await evaluate(`document.querySelector('#map-search-catalogue').click()`);
    assert.equal(await evaluate(`!document.querySelector('#catalogue').hidden && document.querySelector('#search').value==='zzzz-no-language'`),true);
  }
  // Related dot names are painted with ::before; the whole visible name must accept
  // pointer events, otherwise a click falls through to the map background and the
  // blank-click handler restores the overview instead of selecting the node.
  await page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await evaluate(`document.querySelector('#design-layer').click();document.querySelector('#timeline-view').click();`);
  await evaluate(`document.querySelector('.dock[data-id="python"]').click();var museumDotPick=document.querySelector('.nearby-list:not([hidden]) [data-nearby="python"]');if(museumDotPick)museumDotPick.click();`);
  await new Promise(resolve=>setTimeout(resolve,1200));
  const relatedDotLabel=await evaluate(`(()=>{const node=document.querySelector('#docks .dock.dot.related[data-id="abc"]');if(!node)return null;const r=node.getBoundingClientRect(),scale=new DOMMatrix(getComputedStyle(document.querySelector('#world')).transform).a,style=getComputedStyle(node,'::before'),base=getComputedStyle(node),n=v=>parseFloat(v)||0;const width=n(style.width)+n(style.paddingLeft)+n(style.paddingRight)+n(style.borderLeftWidth)+n(style.borderRightWidth),height=n(style.height)+n(style.paddingTop)+n(style.paddingBottom)+n(style.borderTopWidth)+n(style.borderBottomWidth);const left=r.left+(n(base.borderLeftWidth)+n(style.left))*scale+n(base.getPropertyValue('--label-shift-x')),top=r.top+(n(base.borderTopWidth)+n(style.top))*scale+n(base.getPropertyValue('--label-shift-y'));const hit=document.elementFromPoint(left+width/2,top+height/2);return {pointerEvents:style.pointerEvents,width,height,hit:hit&&hit.closest('.dock')?hit.closest('.dock').dataset.id:null};})()`);
  assert.ok(relatedDotLabel,'Selecting Python must expose the ABC dot name');
  assert.ok(relatedDotLabel.width>20,'Related dot name must be measured');
  assert.equal(relatedDotLabel.pointerEvents,'auto','Related dot name must accept pointer events');
  assert.equal(relatedDotLabel.hit,'abc','Clicking the visible related dot name must hit its own node');
  mapSearchChecks.push({relatedDotLabel:relatedDotLabel,checks:'dot name label is hit-testable'});
  await record('Map fuzzy search selects nodes in both views, preserves punctuation and supports full collection fallback',mapSearchChecks);
  if(['1','all'].includes(process.env.MAP_SWEEP)){
    await page('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    const sweepAll=process.env.MAP_SWEEP==='all';
    const labels=await evaluate(sweepAll?'window.MUSEUM_DATA.records.filter(record=>record.mapEligible&&record.year).map(record=>record.id)':'window.MUSEUM_DATA.meta.mapLabelIds');
    const cases=[],omitted=[];
    for(const size of [{width:1440,height:1000},{width:390,height:844}]){
      await page('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:1,mobile:size.width<500});
      for(const layer of ['design','ecosystem'])for(const mode of ['timeline','lineage']){
        await evaluate(`document.querySelector('#${layer}-layer').click()`);
        await evaluate(`document.querySelector('#${mode}-view').click()`);
        for(const id of labels){
          const exists=await evaluate(`!!document.querySelector('.dock[data-id="${id}"]')`);
          if(!exists){omitted.push({id,mode,layer,width:size.width,reason:'No recorded map relationship; absent from lineage view'});continue;}
          try{
            await evaluate(`document.querySelector('.dock[data-id="${id}"]').click();var choice=document.querySelector('.nearby-list:not([hidden]) [data-nearby="${id}"]');if(choice)choice.click();`);
            await new Promise(resolve=>setTimeout(resolve,60));
            await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
            const direct=await evaluate(`(()=>{const id=${JSON.stringify(id)},data=window.MUSEUM_DATA,shown=new Set(Array.from(document.querySelectorAll('.dock[data-id]'),node=>node.dataset.id));const relations=${JSON.stringify(layer)}==='design'?data.edges.filter(edge=>!['implementationOf','compatibleWith'].includes(edge.type)):[...data.edges.filter(edge=>['implementationOf','compatibleWith'].includes(edge.type)),...data.ecosystemEdges];return [...new Set([id,...relations.filter(edge=>edge.from===id||edge.to===id).flatMap(edge=>[edge.from,edge.to]).filter(other=>shown.has(other))])];})()`);
            const metrics=await checkLabels(direct);
            cases.push({id,mode,layer,width:size.width,directCount:direct.length,placedCount:metrics.labels.length,guideCount:metrics.guides.length});
            if(['c','python','rust','lisp'].includes(id))await screenshot(`sweep-${id}-${layer}-${mode}-${size.width}.png`);
            await evaluate(`document.querySelector('#viewport').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
            assert.equal(await evaluate(`document.body.classList.contains('lineage-focus')||!!document.querySelector('.dock.selected,.dock.related,[data-label-placement],#relations .label-guide,#relations .label-anchor')`),false,'Blank click must restore overview: '+id);
          }catch(error){await screenshot(`sweep-failure-${id}-${layer}-${mode}-${size.width}.png`);throw new Error('Map sweep '+JSON.stringify({id,mode,layer,size})+': '+error.message);}
        }
        console.log('SWEEP '+size.width+' '+layer+' '+mode+' '+cases.length+' cumulative cases');
      }
    }
    await record((sweepAll?'All dated map nodes':'Persistent map labels')+' focus and restore across wide/narrow river and lineage',{cases,omitted,scope:(sweepAll?'Fixed current dated mapEligible records':'Fixed current mapLabelIds')+'; design and ecosystem layers; two sizes; reduced motion; no simulated history links. Omitted nodes are not present in lineage.'});
  }
  const servedInputs=Object.fromEntries(['index.html','learning-examples.js','draft-store.js','lab-tools.js','compare.js','analytics.js','visit-counts.js','map-framing.js','museum.css','museum.js','data/catalogue.js','lab.js','lab-examples.js','lab-worker.js','python-worker.js','lua-worker.js','scheme-worker.js','assets/pyodide/manifest.json','credits.js','relationship-coverage.js','execution-config.js','execution-modes.js','runtime-status.js','runtime-progress.js','theme.js','themes.css','data/runtime-assets.js','data/relationship-status.js','data/relationship-status.json','data/credits.js','data/credits.json','licenses/linguist-LICENSE'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'dist',file))).digest('hex')]));
  const report={servedInputs,checkedAt:new Date().toISOString(),browser:version.product,scope:'Actual headless Chrome over local HTTP; isolated temporary browser profile; external DNS blocked. Worker constructor/termination observed without replacing execution. Does not verify real tab visibility, idle release, production hosting or all languages.',inputs:Object.fromEntries(['src/index.html','src/learning-examples.js','src/draft-store.js','src/lab-tools.js','src/compare.js','src/analytics.js','src/visit-counts.js','src/map-framing.js','src/museum.js','src/museum.css','data/audit/reviews.json','data/audit/map-eligible-ids.json','data/audit/label-selection.json','data/relationship-overrides.json','data/ecosystem-relations.json','src/lab.js','src/lab-examples.js','data/audit/tcsh-runtime-checks.json','data/audit/ksh93-runtime-checks.json','data/audit/runtime-checks.json','src/lab-worker.js','src/python-worker.js','src/lua-worker.js','src/scheme-worker.js','public/assets/scheme/manifest.json','public/assets/scheme/biwascheme-core.mjs','scripts/serve.cjs','scripts/check-browser-runtime.cjs','scripts/credits.cjs','scripts/relationship-audit.cjs','data/audit/relationship-decisions.json','src/relationship-coverage.js','src/execution-config.js','src/execution-modes.js','src/runtime-status.js','src/runtime-progress.js','src/theme.js','src/themes.css','scripts/build.cjs','data/credits.json','src/credits.js','public/assets/pyodide/manifest.json'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')])),checks:results};
  if(outputDirectory){fs.writeFileSync(path.join(outputDirectory,'checks.json'),JSON.stringify(report,null,2)+'\n');console.log('Report '+path.join(outputDirectory,'checks.json'));}else console.log(JSON.stringify(report,null,2));
 }catch(error){await screenshot('failure.png').catch(()=>{});console.error(error.stack+'\n'+diagnostics);process.exitCode=1;}
 finally{
  if(browser){try{await send('Browser.close');}catch{}if(browser.exitCode===null&&browser.signalCode===null){const closed=new Promise(resolve=>browser.once('exit',resolve));browser.kill('SIGKILL');await closed;}}
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  fs.rmSync(profileDirectory,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
