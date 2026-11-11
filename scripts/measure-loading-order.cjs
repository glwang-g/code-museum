const {withBrowser}=require('./browser-harness.cjs'),{createRequestHandler}=require('./serve.cjs');
const http=require('http'),fs=require('fs'),crypto=require('crypto');
const original=fs.readFileSync('dist/index.html','utf8'),handler=createRequestHandler(process.cwd()+'/dist');
const deferred=original.replace(/<script\b[^>]*>/g,tag=>tag.includes('theme.')||tag.includes(' defer')?tag:tag.replace('>',' defer>'));
const synchronous=original.replace(/<script\b[^>]*>/g,tag=>tag.includes('theme.')||/analytics\.|visit-counts\.|messages\./.test(tag)?tag:tag.replace(/ defer(?=>)/,''));
const server=http.createServer((req,res)=>{if(req.url==='/bootstrap'){res.end('<!doctype html><title>Timing bootstrap</title>');return}if(req.url.startsWith('/?mode=')){const body=Buffer.from(req.url.includes('sync')?synchronous:deferred);res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Length':body.length});res.end(body);return}handler(req,res)});
const rows=[];let browser;const fixture=`let gallery;Object.defineProperty(window,'MUSEUM_GALLERY',{configurable:true,get:()=>gallery,set:value=>{gallery=value;if(value?.ready)window.__readyAt=performance.now()}});`;
(async()=>{try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 for(let sample=1;sample<=3;sample++)for(const mode of ['defer','sync'])await withBrowser({origin:'http://127.0.0.1:'+server.address().port,hash:'/bootstrap',fixture,viewport:{width:390,height:844,mobile:true,deviceScaleFactor:1},ready:"document.readyState==='complete'",output:'tmp/loading-order'},async h=>{
  browser=h.browserVersion;await h.page('Network.enable');await h.page('Network.setCacheDisabled',{cacheDisabled:true});await h.page('Network.emulateNetworkConditions',{offline:false,latency:60,downloadThroughput:1024*1024,uploadThroughput:1024*1024,connectionType:'cellular4g'});
  await h.page('Page.navigate',{url:h.origin+'/?mode='+mode});await h.wait("!!window.__readyAt&&document.readyState==='complete'");
  const r=await h.evaluate(`(()=>{const n=performance.getEntriesByType('navigation')[0],f=performance.getEntriesByName('first-contentful-paint')[0];return {readyMs:__readyAt,fcpMs:f?.startTime||null,domContentLoadedMs:n.domContentLoadedEventEnd,contentSha256:MUSEUM_BUILD_INFO.contentSha256}})()`);rows.push({sample,mode,...r});console.log(mode+' '+sample+': '+Math.round(r.readyMs)+' ms');
 });
 const median=v=>v.sort((a,b)=>a-b)[Math.floor(v.length/2)],summary=Object.fromEntries(['defer','sync'].map(mode=>[mode,{samples:3,medianMs:median(rows.filter(r=>r.mode===mode).map(r=>r.readyMs))}]));
 const report={schemaVersion:1,checkedAt:new Date().toISOString(),browser,scope:'Same current dist code at 390px in installed isolated headless Chrome. Interleaved three samples per mode; cache disabled; simulated 60ms latency and 1 MiB/s download/upload, no CPU throttling. Only HTML script defer attributes differ. The three existing analytics/visits/messages defer flags and synchronous theme remain in both. No live API/model/execution. DOM ready timestamp, not GPU display.',scriptSha256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),htmlSha256:crypto.createHash('sha256').update(original).digest('hex'),rows,summary};
 fs.writeFileSync('data/audit/loading-order-controlled.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(summary));
}finally{server.closeAllConnections();await new Promise(r=>server.close(r))}})().catch(e=>{console.error(e.stack);process.exitCode=1});
