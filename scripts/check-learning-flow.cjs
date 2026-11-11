// Native pointer/keyboard regression checks. Navigation must never submit code or call a model.
const {withBrowser}=require('./browser-harness.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const origin=process.env.LEARNING_FLOW_ORIGIN||'http://127.0.0.1:4191',live=process.env.LEARNING_FLOW_LIVE==='1';
const fixture=`window.__errors=[];window.__posts=0;window.__workerPosts=0;window.__copied=[];addEventListener('error',e=>__errors.push(e.message));addEventListener('unhandledrejection',e=>__errors.push(String(e.reason)));Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>__copied.push(value)}});const send=Worker.prototype.postMessage;Worker.prototype.postMessage=function(...args){__workerPosts++;return send.apply(this,args)};const originalFetch=window.fetch;window.fetch=(url,options={})=>{if(options.method==='POST'&&['/api/executions','/api/explanations'].includes(String(url))){__posts++;return Promise.reject(new Error('Unexpected submission during navigation'))}return originalFetch(url,options)};`;
withBrowser({origin,fixture,output:'tmp/learning-flow-'+(live?'production':'browser'),ready:"document.readyState==='complete'&&!!window.MUSEUM_GALLERY?.ready"},async h=>{
 const {evaluate,click,wait,page,screenshot}=h,checks=[],record=name=>checks.push({name,passed:true});
 const go=async hash=>{await evaluate('location.hash='+JSON.stringify(hash));await h.delay(160)};
 const readState=()=>evaluate('MUSEUM_NAV.state()');
 const task=async(view,language,topic)=>{const state=await readState();assert.equal(state.view,view);assert.equal(view==='compare'?state.left:state.language,language);assert.equal(state.topic,topic)};
 await evaluate('MUSEUM_GALLERY.setScene(1)');const exhibit=await evaluate("document.querySelector('#specimen-code').textContent");await click('#try-exhibit');assert.equal(await evaluate('MUSEUM_LAB.code'),exhibit);assert.equal(await evaluate('__workerPosts'),0);record('Exhibition imports exactly the displayed program without executing it');
 const freeDraft='console.log("my free draft");';await evaluate(`MUSEUM_LAB.restore('javascript','default');document.querySelector('#lab-view').click();MUSEUM_LAB.importCode(${JSON.stringify(freeDraft)})`);assert.equal(await evaluate("document.querySelector('#gallery-lab-compare').textContent"),'浏览同题教材 ↗');await click('#gallery-lab-read');await wait("MUSEUM_NAV.state().view==='read'");await task('read','javascript','default');await click('[data-reading-lab="javascript"]:not([data-reading-import])');await task('lab','javascript','default');assert.equal(await evaluate('MUSEUM_LAB.code'),freeDraft);record('Free-draft reading round trip retains the default draft; preset comparison is explicitly labeled');
 const draft='let sum = 40;\nfor (const n of [1, 1]) sum += n;\nconsole.log(sum);';
 await evaluate(`MUSEUM_LAB.restore('javascript','loops');document.querySelector('#lab-view').click();MUSEUM_LAB.importCode(${JSON.stringify(draft)})`);
 await click('#gallery-lab-read');await wait("MUSEUM_NAV.state().view==='read'");await task('read','javascript','loops');assert.equal(await evaluate("document.querySelector('#reading-topic').value"),'loops');
 await click('[data-reading-compare="javascript"]');await task('compare','javascript','loops');assert.equal((await readState()).right,'python');
 await click('[data-compare-archive="python"]');await task('read','python','loops');
 await click('[data-reading-compare="python"]');await task('compare','python','loops');assert.equal((await readState()).right,'javascript');
 await click('[data-compare-lab="javascript"]');await task('lab','javascript','loops');assert.equal(await evaluate('MUSEUM_LAB.code'),draft);
 record('Lab → reading → same-task comparison → other reading → lab preserves topic, comparison partner and draft');
 await click('#gallery-lab-read');const sample=await evaluate("document.querySelector('.reading-code pre').textContent");await click('[data-reading-import="true"]');assert.equal(await evaluate('MUSEUM_LAB.code'),sample);assert.equal(await evaluate('MUSEUM_LAB.hasBackup'),true);
 await evaluate("document.querySelector('#lab-file-tools').open=true");await click('#lab-undo');assert.equal(await evaluate('MUSEUM_LAB.code'),draft);await evaluate("document.querySelector('#lab-file-tools').open=false");
 record('Explicit reading-example import creates a reversible backup; normal task navigation preserves drafts');
 await click('#gallery-lab-read');await evaluate("document.querySelector('#reading-topic').value='collections';document.querySelector('#reading-topic').dispatchEvent(new Event('change'))");await wait("MUSEUM_NAV.state().topic==='collections'");await task('read','javascript','collections');
 await evaluate("document.querySelector('.site-tools').open=true");await click('#share-page');const shared=new URL(await evaluate('__copied.at(-1)'));assert.equal(shared.hash,'#read?language=javascript&topic=collections');assert.ok(!/sum|stdin|intent|code=/.test(shared.href));await evaluate("document.querySelector('.site-tools').open=false");
 await page('Page.reload');await wait("document.readyState==='complete'&&!!window.MUSEUM_GALLERY?.ready");await task('read','javascript','collections');await screenshot('reading-task-1440.png');
 await evaluate('history.back()');await wait("MUSEUM_NAV.state().view==='read'&&MUSEUM_NAV.state().topic==='loops'");
 record('Reading topic changes, sharing, reload and Back preserve public task context without serializing drafts');
 for(const width of [1440,390,320]){
  await page('Emulation.setDeviceMetricsOverride',{width,height:width===1440?1000:844,mobile:width<651,deviceScaleFactor:1});
  for(const hash of ['gallery','catalogue','lab?language=javascript&topic=loops','read?language=javascript&topic=loops','compare','guides','about']){
   await go(hash);await evaluate('scrollTo(0,document.documentElement.scrollHeight)');await h.delay(120);
   for(const id of ['compare-view','guides-view','sources-view'])assert.equal(await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)}),r=e.getBoundingClientRect();return r.width>0&&r.top>=0&&r.bottom<innerHeight&&document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===e})()`),true,'Visible utility '+id+' '+hash+' '+width);
   assert.equal(await evaluate("[...document.querySelectorAll('.museum-tabs [role=tab]')].filter(t=>t.getClientRects().length&&t.tabIndex===0).length"),1);
   assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  }
  await go('lab?language=javascript&topic=loops');await evaluate('scrollTo(0,0)');const p=await h.point('.site-footer a[href="#compare"]');assert.equal(await evaluate(`document.elementFromPoint(${p.x},${p.y}).closest('a')?.getAttribute('href')`),'#compare');await click('.site-footer a[href="#compare"]');await task('compare','javascript','loops');
  await click('[data-compare-lab="javascript"]');assert.equal(await evaluate('MUSEUM_LAB.code'),draft);await click('#compare-view');await task('compare','javascript','loops');
  await click('.site-footer a[href="#guides"]');assert.equal((await readState()).view,'guides');assert.equal(await evaluate("document.querySelectorAll('.guide-card').length"),5);await screenshot('guides-'+width+'.png');
  record('Persistent utilities and native footer clicks avoid fixed-bottom interception at '+width+' px');
 }
 await go('lab?language=javascript&topic=loops');await evaluate("document.querySelector('#sources-view').focus()");await page('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await page('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});assert.equal(await evaluate('document.activeElement.id'),'compare-view');assert.equal((await readState()).view,'compare');
 record('Mobile keyboard tab navigation skips hidden exploration tabs and keeps a visible tab stop');
 await click('#guides-view');await click('[data-directory-guide="c-lineage"]');await wait("MUSEUM_NAV.state().view==='read'");await click('#guide-next');assert.equal(await evaluate('MUSEUM_GUIDE.state.index'),1);await click('#guides-view');assert.match(await evaluate("document.querySelector('[data-directory-guide=\"c-lineage\"]').textContent"),/继续/);await click('[data-directory-guide="c-lineage"]');assert.equal(await evaluate('MUSEUM_GUIDE.state.index'),1);await click('#guides-view');await click('[data-restart-guide="c-lineage"]');assert.equal(await evaluate('MUSEUM_GUIDE.state.index'),0);await click('#guide-end');
 record('Guide directory continues saved progress and restarts only through its explicit restart action');
 await go('read?language=bcpl&topic=loops');assert.equal((await readState()).topic,'default');assert.equal(await evaluate("document.querySelector('[data-reading-compare]')===null"),true);await click('[data-reading-lab="bcpl"]');assert.equal(await evaluate("document.querySelector('#gallery-lab-compare').textContent"),'浏览已有对比 ↗');await click('#gallery-lab-compare');assert.equal((await readState()).view,'compare');
 record('Unsupported same-task languages show the actual coverage instead of inventing a comparison');
 await h.delay(700);assert.equal(await evaluate('__posts'),0);assert.equal(await evaluate('__workerPosts'),0);assert.deepEqual(await evaluate('__errors'),[]);
 record('All navigation and sample import remain manual: zero execution/model POSTs or Worker runs');
 await go('lab?language=javascript&topic=loops');assert.equal(await evaluate('MUSEUM_LAB.code'),draft);await click('#lab-run');await wait("document.querySelector('#lab-result').dataset.state==='ok'");assert.equal((await evaluate("document.querySelector('#lab-result').textContent")).trim(),'42');await screenshot('result-320.png');
 record('Preserved draft actually executes and returns 42 only after the Run click');
 const inputs=['src/gallery.js','src/gallery.css','src/index.html','src/navigation.js','src/navigation-state.js','src/learning-context.js','src/compare.js','src/museum.js','scripts/check-learning-flow.cjs','scripts/browser-harness.cjs'];
 const report={schemaVersion:1,checkedAt:new Date().toISOString(),origin,browser:h.browserVersion,scope:'Installed headless Chrome; native mouse/keyboard input at 1440/390/320. Mobile layout emulation, not physical Safari. Real JavaScript Worker. Execution/model submissions prohibited during navigation; no provider calls.',checks,inputs:Object.fromEntries(inputs.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]))};
 const file='data/audit/learning-flow-'+(live?'production':'browser')+'.json';fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');console.log('PASS '+checks.length+' learning flow checks: '+file);
}).catch(error=>{console.error(error.stack);process.exitCode=1});
