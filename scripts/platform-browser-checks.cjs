// Opt-in checks used by check-executor-browser.cjs with PLATFORM_ONLY=1.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
module.exports=async({evaluate,wait,page,screenshot,results,token,root,restart})=>{
 const readonly=crypto.createHmac('sha256',token).update('code-museum-readonly-mcp-v1').digest('hex');
 async function request(url,body,key=readonly,extra={}){
  return evaluate(`fetch(${JSON.stringify(url)},{method:${JSON.stringify(body===undefined?'GET':'POST')},headers:${JSON.stringify({'Authorization':'Bearer '+key,'Content-Type':'application/json','Accept':'application/json, text/event-stream','MCP-Protocol-Version':'2025-06-18',...extra})},${body===undefined?'':`body:${JSON.stringify(JSON.stringify(body))},`}}).then(async r=>({status:r.status,body:await r.text()}))`);
 }
 const rpc=(method,params={})=>({jsonrpc:'2.0',id:1,method,params});
 assert.equal((await request('/mcp',rpc('tools/list'),token)).status,401);
 assert.equal((await request('/mcp',rpc('tools/list'),'bad-token')).status,401);
 assert.equal((await request('/mcp')).status,405);
 assert.equal((await request('/mcp',rpc('tools/list'),readonly,{'MCP-Protocol-Version':'bad'})).status,400);
 assert.equal((await request('/mcp',rpc('tools/list'),readonly,{Accept:'text/event-stream'})).status,406);
 assert.equal((await request('/mcp',{jsonrpc:'2.0',method:'notifications/initialized'})).status,202);
 let response=await request('/mcp',rpc('initialize',{protocolVersion:'2025-06-18'}));
 assert.equal(JSON.parse(response.body).result.protocolVersion,'2025-06-18');
 const tools=JSON.parse((await request('/mcp',rpc('tools/list'))).body).result.tools;
 assert.equal(tools.length,5);assert.ok(tools.every(t=>t.annotations.readOnlyHint));
 for(const [name,args] of [['search_languages',{query:'python'}],['get_language',{id:'python'}],['get_lineage',{id:'c',direction:'both'}],['get_relationship',{key:'b|c|influencedBy'}],['get_execution_capabilities',{id:'python'}]]){
  const r=await request('/mcp',rpc('tools/call',{name,arguments:args}));assert.equal(r.status,200);assert.equal(JSON.parse(r.body).result.isError,false,name);
 }
 assert.equal(JSON.parse((await request('/mcp',rpc('tools/call',{name:'execute_code',arguments:{}}))).body).result.isError,true);
 const session='1'.repeat(32);
 assert.equal((await request('/api/executions',{language:'python',code:'print(1)'},readonly,{'X-Execution-Session':session})).status,401);
 assert.equal((await request('/api/executor-status',undefined,readonly,{'X-Execution-Session':session})).status,401);
 results.push({name:'Actual HTTP MCP initialize, five read-only tools, notifications, protocol/Accept/method rejection and separated credentials',passed:true});
 await evaluate(`document.querySelector('#lab-service-health').open=true;document.querySelector('#lab-service-refresh').click()`);
 await wait(`document.querySelector('#lab-service-summary').textContent.includes('服务可用')`);
 const before=await evaluate(`window.MUSEUM_EXECUTION.serviceStatus()`);
 await evaluate(`window.MUSEUM_LAB.open('python');document.querySelector('#lab-code').value='print(42)';document.querySelector('#lab-code').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#lab-run').click()`);
 await wait(`document.querySelector('#lab-result').textContent==='42\\n'&&document.querySelector('#lab-result').dataset.state==='ok'`,20000);
 const after=await evaluate(`window.MUSEUM_EXECUTION.serviceStatus()`);
 assert.equal(after.metrics.total,before.metrics.total+1);assert.equal(after.metrics.states.completed,before.metrics.states.completed+1);
 assert.equal(after.metrics.persistent,true);assert.ok(after.metrics.timings.run.samples>before.metrics.timings.run.samples);
 await evaluate(`document.querySelector('#lab-service-refresh').click()`);await wait(`document.querySelector('#lab-service-metrics').textContent.includes('不保存代码')`);
 if(restart){await restart();const restored=await evaluate('window.MUSEUM_EXECUTION.serviceStatus()');assert.equal(restored.metrics.total,after.metrics.total);assert.equal(restored.metrics.startedAt,after.metrics.startedAt);assert.notEqual(restored.processStartedAt,after.processStartedAt);results.push({name:'Actual API process restart retains SQLite aggregates and start date',passed:true});}
 await page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,mobile:false,deviceScaleFactor:1});
 await evaluate(`document.querySelector('#lab-service-refresh').click()`);await wait(`document.querySelector('#lab-service-metrics').textContent.includes('不保存代码')`);
 await screenshot('service-metrics-1440.png');
 results.push({name:'Actual Docker terminal task updates authenticated persistent aggregates and explicit status UI',passed:true});
 const routes=JSON.parse(fs.readFileSync(path.join(root,'data/learning-paths.json'))).routes;
 for(const size of [{width:1440,height:1000,mobile:false},{width:390,height:844,mobile:true}]){
  await page('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:1});
  for(const theme of ['light','dark']){
   await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)};document.querySelector('#compare-view').click()`);
   await screenshot('guide-cards-'+size.width+'-'+theme+'.png');
   for(const route of routes){
    const posts=await evaluate('window.__posts');
    await evaluate(`document.querySelector('[data-guide-start="${route.id}"]').click()`);
    for(let i=0;i<route.steps.length;i++){
     assert.deepEqual(await evaluate('window.MUSEUM_GUIDE.state'),{route:route.id,index:i});
     assert.equal(await evaluate(`document.querySelector('#learning-guide').hidden`),false);
     assert.ok(await evaluate(`document.querySelector('#guide-title').textContent.includes(${JSON.stringify(route.steps[i].title)})`));
     const step=route.steps[i];
     if(step.action==='archive')assert.equal(await evaluate(`document.querySelector('#detail').getAttribute('aria-hidden')`),'false');
     else if(step.action==='proof'){assert.equal(await evaluate(`document.querySelector('#lineage-view').getAttribute('aria-selected')`),'true');assert.equal(await evaluate(`document.querySelector('#detail').getAttribute('aria-hidden')`),'false');}
     else if(step.action==='lesson'){assert.equal(await evaluate(`document.querySelector('#lab-language').value`),step.language);assert.equal(await evaluate(`document.querySelector('#lab-topic').value`),step.topic);}
     else {assert.equal(await evaluate(`document.querySelector('#compare-left').value`),step.left);assert.equal(await evaluate(`document.querySelector('#compare-right').value`),step.right);assert.equal(await evaluate(`document.querySelector('#compare-topic').value`),step.topic);assert.ok(await evaluate(`document.querySelector('#compare-preset').selectedOptions[0].textContent.length>0`));}
     assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
     if(i<route.steps.length-1)await evaluate(`document.querySelector('#guide-next').click()`);
    }
    assert.equal(await evaluate('window.__posts'),posts,'Guide navigation must not submit code');
    assert.equal(await evaluate(`performance.getEntriesByType('resource').some(r=>['/assets/pyodide/','/assets/lua/','/assets/scheme/'].some(p=>r.name.includes(p)))`),false,'No implicit runtime downloads');
    await screenshot('guide-'+route.id+'-'+size.width+'-'+theme+'.png');
    await evaluate(`document.querySelector('#guide-prev').click()`);
    assert.equal((await evaluate('window.MUSEUM_GUIDE.state')).index,route.steps.length-2);
    await evaluate(`document.querySelector('#guide-end').click()`);assert.equal(await evaluate(`document.querySelector('#learning-guide').hidden`),true);
    results.push({name:'All guide steps, previous/end, bounded layout and no implicit execution/download',route:route.id,width:size.width,theme,passed:true});
   }
  }
 }
 await evaluate(`window.MUSEUM_GUIDE.start('c-lineage');document.querySelector('#guide-next').click()`);
 await page('Page.reload');await wait('!!window.MUSEUM_GUIDE');
 assert.deepEqual(await evaluate('window.MUSEUM_GUIDE.state'),{route:'c-lineage',index:1});
 assert.equal(await evaluate('window.__posts'),0);
 await evaluate(`document.querySelector('#guide-open').click();document.querySelector('#guide-end').click();window.MUSEUM_LAB.open('python');document.querySelector('#lab-service-health').open=true;document.querySelector('#lab-service-refresh').click()`);
 await wait(`document.querySelector('#lab-service-summary').textContent.includes('令牌')`);
 await screenshot('service-no-token-390.png');
 results.push({name:'Guide resume saves navigation only, no execution on refresh; missing-token status fails honestly',passed:true});
};
