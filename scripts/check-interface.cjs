// Opt-in interface inspection in isolated installed Chrome; all effects stay local.
const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const {withBrowser} = require('./browser-harness.cjs');
const live = process.env.INTERFACE_LIVE === '1';
const origin = process.env.INTERFACE_ORIGIN || (live ? 'https://codemuseum.freexlib.com' : 'http://127.0.0.1:4191');
const fixture = `window.__modelCalls=0;window.__remoteCalls=0;const f=window.fetch;window.fetch=(url,o={})=>{if(String(url)==='/api/explanations'){__modelCalls++;return Promise.reject(new Error('No model requests in interface inspection'))}if(String(url)==='/api/executions'&&o.method==='POST'){__remoteCalls++;return Promise.reject(new Error('No remote submissions in interface inspection'))}return f(url,o)}`;
withBrowser({origin,output:'tmp/interface-refresh-'+(live?'production':'browser'),ready:"document.readyState==='complete'&&!!window.MUSEUM_GALLERY?.ready",fixture}, async h => {
  const checks=[], samples=[];
  const record=(name,extra)=>checks.push({name,...extra,passed:true});
  const go=async hash=>{await h.evaluate('location.hash='+JSON.stringify(hash));await h.delay(120)};
  function measure(selectors) {
    const parse=c=>{
      const v=c.match(/[\d.]+/g)?.map(Number);
      if(!v||v.length<3)throw new Error('Unrecognized color '+c);
      return c.startsWith('color(srgb')?[v[0]*255,v[1]*255,v[2]*255,v[3]??1]:[v[0],v[1],v[2],v[3]??1];
    };
    const blend=(a,b)=>[...a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3])),1];
    const bg=e=>{const chain=[];for(let n=e;n;n=n.parentElement)chain.unshift(n);return chain.reduce((b,n)=>blend(parse(getComputedStyle(n).backgroundColor),b),[255,255,255,1])};
    const lum=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
    return selectors.flatMap(selector=>[...document.querySelectorAll(selector)].filter(e=>e.getClientRects().length).slice(0,6).map(e=>{
      const c=getComputedStyle(e), b=bg(e), f=blend(parse(c.color),b), l=[lum(f),lum(b)].sort((a,b)=>a-b),r=e.getBoundingClientRect();
      return {selector,text:e.textContent.trim().slice(0,45),font:parseFloat(c.fontSize),contrast:+((l[1]+.05)/(l[0]+.05)).toFixed(3),backgroundLuminance:+lum(b).toFixed(4),x:r.x,y:r.y,width:r.width,height:r.height};
    }));
  }
  const inspect=selectors=>h.evaluate('('+measure.toString()+')('+JSON.stringify(selectors)+')');
  for(const width of [1440,900,390,320])for(const theme of ['light','dark']){
    await h.page('Emulation.setDeviceMetricsOverride',{width,height:width===1440?1000:844,mobile:width<651,deviceScaleFactor:1});
    await h.evaluate('document.documentElement.dataset.theme='+JSON.stringify(theme));
    await go('gallery');
    const gallery=await inspect(['.intro-note p','.route-card p','.route-meta','.language-card small','.section-nav a.active','.exhibit-footer']);
    for(const m of gallery){assert.ok(m.font>=12,JSON.stringify(m));assert.ok(m.contrast>=4.5,JSON.stringify({width,theme,...m}))}
    assert.equal(await h.evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
    record('Gallery copy, cards and selected navigation have readable type and contrast',{width,theme});samples.push({width,theme,view:'gallery',measurements:gallery});
    const exhibition=await inspect(['.exhibition','.specimen','.exhibit-kicker','.exhibit-copy h2','#exhibit-description','#read-exhibit','#try-exhibit','.specimen-code > div','.specimen-code pre','.specimen-code p','.exhibit-index button','.exhibit-index button strong','.exhibit-footer']);
    for(const m of exhibition.filter(m=>!['.exhibition','.specimen'].includes(m.selector)))assert.ok(m.contrast>=4.5,JSON.stringify({width,theme,...m}));
    for(const m of exhibition.filter(m=>['.exhibition','.specimen'].includes(m.selector)))assert.ok(theme==='light'?m.backgroundLuminance>.65:m.backgroundLuminance<.15,JSON.stringify({width,theme,...m}));
    record('Exhibition and code sample follow the theme; text, selected years and actions retain readable contrast',{width,theme});samples.push({width,theme,view:'exhibition',measurements:exhibition});
    const order=await h.evaluate("[...document.querySelectorAll('.section-nav a')].filter(e=>e.getClientRects().length).map(e=>e.id)");
    assert.deepEqual(order,['gallery-view','catalogue-view','timeline-view','lineage-view']);
    const main=await h.evaluate("[...document.querySelectorAll('[data-main-nav]')].map(e=>{const r=e.getBoundingClientRect();return {section:e.dataset.mainNav,x:r.x,y:r.y,width:r.width,height:r.height,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}})");
    assert.deepEqual(main.map(e=>e.section),['explore','learn','lab']);for(const m of main)assert.ok(m.x>=0&&m.x+m.width<=width&&m.hit,JSON.stringify(m));
    record('Three primary sections remain visible; exploration exposes only its four children',{width,theme});
    if((width===1440&&theme==='light')||(width===390&&theme==='dark'))await h.screenshot('gallery-'+width+'-'+theme+'.png');
    await go('catalogue');
    const catalogue=await inspect(['.catalogue-title','#search','#result-count','.record strong','.record>span']);
    assert.ok(catalogue.find(m=>m.selector==='#search').y>=catalogue.find(m=>m.selector==='.catalogue-title').y+catalogue.find(m=>m.selector==='.catalogue-title').height);
    assert.ok(catalogue.find(m=>m.selector==='#search').font>=14);
    assert.equal(await h.evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
    assert.equal(await h.evaluate("document.querySelector('#result-count').textContent.includes('5,155')"),true);
    record('Full catalogue separates its title from complete search and filtering controls',{width,theme});samples.push({width,theme,view:'catalogue',measurements:catalogue});
    if((width===1440&&theme==='light')||(width===390&&theme==='dark'))await h.screenshot('catalogue-'+width+'-'+theme+'.png');
    await go('read?language=python');
    const reading=await inspect(['.reading-article section>p','.reading-source-note','.reading-specimen-card .primary','.reading-evidence p']);
    for(const m of reading)assert.ok(m.contrast>=4.5,JSON.stringify({width,theme,...m}));
    assert.ok(reading.find(m=>m.selector==='.reading-article section>p').font>=16);
    assert.equal(await h.evaluate("document.querySelector('.reading-specimen-card').textContent.includes('浏览器 / 远端')"),true);
    record('Reading uses 16px body, distinct actions and accurate dual Python modes',{width,theme});samples.push({width,theme,view:'reading',measurements:reading});
    if((width===1440&&theme==='light')||(width===390&&theme==='dark'))await h.screenshot('reading-'+width+'-'+theme+'.png');
    await go('lab?language=javascript');
    await h.evaluate('MUSEUM_LAB.importCode('+JSON.stringify('// interface sample\nconst value = 7;\nconsole.log("value", value);')+')');
    const editor=await inspect(['#lab-run','#lab-explain-current','#lab-highlight','#lab-highlight .tok-keyword','#lab-highlight .tok-string','#lab-highlight .tok-number','#lab-highlight .tok-comment']);
    for(const kind of ['keyword','string','number','comment'])assert.ok(editor.some(m=>m.selector==='#lab-highlight .tok-'+kind),'Missing actual syntax sample '+kind);
    for(const m of editor)assert.ok(m.contrast>=4.5,JSON.stringify({width,theme,...m}));
    for(const m of editor.filter(m=>['#lab-run','#lab-explain-current'].includes(m.selector))){assert.ok(m.x>=0&&m.x+m.width<=width);assert.ok(m.height>=40);assert.ok(m.font>=12)}
    record('Run/check actions fit; editor and four syntax colors meet 4.5:1 contrast',{width,theme});samples.push({width,theme,view:'lab',measurements:editor});
    if((width===1440&&theme==='light')||(width===320&&theme==='dark'))await h.screenshot('lab-'+width+'-'+theme+'.png');
    await go('about');
    const credits=await inspect(['#credit-search','#credit-category','.credit-option-name','.credit-option-meta']);
    for(const m of credits)assert.ok(m.font>=12);
    for(const m of credits.filter(m=>['#credit-search','#credit-category'].includes(m.selector)))assert.ok(m.font>=14&&m.height>=44);
    assert.equal(await h.evaluate("['.credit-list','.credits-detail'].every(s=>{const e=document.querySelector(s);return e.clientHeight>70&&getComputedStyle(e).overflowY==='auto'})"),true);
    assert.equal(await h.evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
    record('Credits keep readable fields and independently scrolling panes',{width,theme});samples.push({width,theme,view:'credits',measurements:credits});
    if((width===1440&&theme==='light')||(width===390&&theme==='dark'))await h.screenshot('credits-'+width+'-'+theme+'.png');
  }
  assert.equal(await h.evaluate('__modelCalls'),0);assert.equal(await h.evaluate('__remoteCalls'),0);
  const inputs=['src/index.html','src/gallery.js','src/interface.css','src/gallery.css','scripts/check-interface.cjs','scripts/browser-harness.cjs'];
  const report={schemaVersion:1,checkedAt:new Date().toISOString(),browser:h.browserVersion,origin,scope:(live?'Production HTTPS inspected in isolated Chrome.':'Local isolated Chrome.')+' Four widths and both themes. Computed typography, composited sRGB text contrast, navigation order, control geometry and independent scrolling. No live model or remote execution. Responsive emulation, not physical Safari.',checks,samples,inputs:Object.fromEntries(inputs.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]))};
  fs.writeFileSync('data/audit/interface-refresh-'+(live?'production':'browser')+'.json',JSON.stringify(report,null,2)+'\n');console.log('PASS '+checks.length+' interface readability checks');
}).catch(e=>{console.error(e.stack);process.exitCode=1});
