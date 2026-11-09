// Local integration check. SMTP is intercepted; no real mail or remote executor is used.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {createRequestHandler}=require('./serve.cjs');
const root=path.resolve(__dirname,'..'),output=path.join(root,'tmp/access-requests-browser');
fs.mkdirSync(output,{recursive:true});
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'museum-access-'));
const mailFile=path.join(directory,'mail.jsonl'),errors=[],checks=[];
let backend,browser,preview,offline,session,buffer='',seq=0;
const requests=new Map();
function send(method,params={},sessionId){return new Promise((resolve,reject)=>{
 const id=++seq,timer=setTimeout(()=>{requests.delete(id);reject(Error('CDP timeout: '+method));},15000);
 requests.set(id,{resolve,reject,timer});browser.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0');
});}
const page=(method,params)=>send(method,params,session);
async function evaluate(expression){const r=await page('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function wait(expression){const end=Date.now()+10000;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw Error('Timeout: '+expression);}
async function screenshot(name){await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');const r=await page('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(r.data,'base64'));}
async function serve(options){const server=http.createServer(createRequestHandler(path.join(root,'dist'),options));await new Promise(r=>server.listen(0,'127.0.0.1',r));return server;}
(async()=>{
 try{
  // Real HTTP/SQLite/mail worker, with just the SMTP boundary intercepted.
  const python=`import sys,json,threading\nfrom pathlib import Path\nsys.path.insert(0,sys.argv[1])\nimport analytics,messages\nfrom http.server import ThreadingHTTPServer\ndirectory=Path(sys.argv[2])\nconfig=messages.load_mail_config('/nonexistent',{'MESSAGES_SMTP_USER':'test@example.com','MESSAGES_SMTP_PASSWORD':'local-only'})\ndef capture(message,config):\n    if (directory/'fail-mail').exists(): raise OSError('local test failure')\n    with (directory/'mail.jsonl').open('a') as out: out.write(json.dumps({'to':str(message['To']),'replyTo':str(message['Reply-To']),'subject':str(message['Subject']),'body':message.get_content()})+'\\n')\nmessages.send_mail=capture\nbook=messages.Messages(str(directory/'messages.sqlite3'),'http://127.0.0.1',config)\nclass Handler(analytics.handler(str(directory/'visits.sqlite3'),book.origin,book)):\n    def do_GET(self):\n        if self.path=='/api/runtimes': return self.json_response(200,{'available':False,'runtimes':[]})\n        return super().do_GET()\nserver=ThreadingHTTPServer(('127.0.0.1',0),Handler)\nprint(server.server_port,flush=True)\nworker=messages.MailWorker(book.database,config,interval=0.1)\nworker.start()\nserver.serve_forever()\n`;
  backend=spawn('python3',['-u','-c',python,path.join(root,'server'),directory],{stdio:['ignore','pipe','pipe']});
  const port=await new Promise((resolve,reject)=>{let out='';backend.stdout.on('data',chunk=>{out+=chunk;const line=out.split('\n')[0];if(/^\d+$/.test(line))resolve(Number(line));});backend.once('error',reject);backend.once('exit',code=>reject(Error('Backend exit '+code)));backend.stderr.on('data',chunk=>errors.push(chunk.toString()));});
  preview=await serve({api:'http://127.0.0.1:'+port});offline=await serve({});
  const origin='http://127.0.0.1:'+preview.address().port;
  // The backend expects the exact preview Origin, adjusted only in this test proxy.
  preview.removeAllListeners('request');
  const handler=createRequestHandler(path.join(root,'dist'),{api:'http://127.0.0.1:'+port});
  preview.on('request',(req,res)=>{if(req.headers.origin===origin)req.headers.origin='http://127.0.0.1';handler(req,res);});
  const chrome=process.env.CHROME_BIN||'/Applications/GoogleChrome.app/Contents/MacOS/Google Chrome';
  browser=spawn(chrome,['--headless=new','--disable-gpu','--disable-background-networking','--no-first-run','--no-default-browser-check','--remote-debugging-pipe','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','--user-data-dir='+path.join(directory,'chrome')],{stdio:['ignore','ignore','ignore','pipe','pipe']});
  browser.stdio[4].on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\0'))!==-1){const m=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);if(m.method==='Runtime.exceptionThrown')errors.push(JSON.stringify(m.params));const request=requests.get(m.id);if(request){requests.delete(m.id);clearTimeout(request.timer);m.error?request.reject(Error(JSON.stringify(m.error))):request.resolve(m.result);}}});
  const target=await send('Target.createTarget',{url:'about:blank'});session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
  await page('Runtime.enable');await page('Page.enable');
  await page('Page.navigate',{url:origin+'/#lab'});await wait('!!window.MUSEUM_LAB');
  await evaluate("window.MUSEUM_LAB.open('c')");
  for(const width of [1440,390])for(const theme of ['dark','light']){
   await page('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
   await evaluate(`document.documentElement.dataset.theme='${theme}'`);
   assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth&&document.querySelector('#access-request-open').getBoundingClientRect().width>0"),true);
   if(theme==='light')await screenshot(`entry-${width}`);
   await evaluate("document.querySelector('#access-request-open').click()");
   await wait("!document.querySelector('#access-submit').disabled");
   await evaluate("document.querySelector('#access-author').value='学习者';document.querySelector('#access-email').value='learner@example.com';document.querySelector('#access-body').value='希望学习 C 与 Pascal，用于课程实验。';document.querySelector('#access-body').dispatchEvent(new Event('input'))");
   const geometry=await evaluate("(()=>{const d=document.querySelector('#access-request-dialog'),r=d.getBoundingClientRect(),b=d.querySelector('.guest-body');return {fits:r.left>=0&&r.right<=innerWidth,overflow:b.scrollWidth<=b.clientWidth,modal:d.matches(':modal')};})()");
   assert.deepEqual(geometry,{fits:true,overflow:true,modal:true});
   await screenshot(`form-${width}-${theme}`);
   await page('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   await page('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   assert.equal(await evaluate("!document.querySelector('#access-request-dialog').open&&document.activeElement.id==='access-request-open'"),true);
   checks.push(`Form layout, modal, Escape and focus ${width}/${theme}`);
  }
  fs.writeFileSync(path.join(directory,'fail-mail'),'test');
  await evaluate("document.querySelector('#access-request-open').click()");await wait("!document.querySelector('#access-submit').disabled");
  await evaluate("window.__originalFetch=window.fetch;window.fetch=async(url,options)=>{const response=await window.__originalFetch(url,options);if(url==='/api/access-requests'&&options?.method==='POST'){window.fetch=window.__originalFetch;throw new TypeError('Simulated lost response')}return response}");
  await evaluate("document.querySelector('#access-request-dialog form').requestSubmit()");
  await wait("document.querySelector('#access-status').textContent.includes('尚未确认')");
  assert.equal(await evaluate("document.querySelector('#access-body').value.includes('希望学习')&&document.querySelector('#access-email').readOnly"),true);
  await evaluate("document.querySelector('#access-request-dialog form').requestSubmit()");
  await wait("document.querySelector('#access-status').dataset.state==='ok'");
  await screenshot('saved-390-light');
  assert.equal(await evaluate("document.querySelector('#access-status').textContent.includes('等待后台邮件通知')"),true);
  await new Promise(r=>setTimeout(r,350));assert.equal(fs.existsSync(mailFile),false);
  fs.unlinkSync(path.join(directory,'fail-mail'));
  for(let i=0;i<60&&!fs.existsSync(mailFile);i++)await new Promise(r=>setTimeout(r,50));
  const mails=fs.readFileSync(mailFile,'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(mails.length,1);assert.equal(mails[0].to,'1956341482@qq.com');assert.equal(mails[0].replyTo,'learner@example.com');assert.match(mails[0].body,/希望学习 C/);
  checks.push('Lost response retries the original request once; real SQLite outbox, intercepted SMTP failure and retry');
  const publicData=await (await fetch(origin+'/api/messages')).json();assert.equal(publicData.total,0);assert.equal(publicData.messages.length,0);
  assert.deepEqual(await (await fetch(origin+'/api/access-requests?limit=50')).json(),{available:true});
  checks.push('Applications absent from guest book and availability API');
  assert.equal(await evaluate("localStorage.getItem('learner@example.com')===null&&!location.href.includes('learner')&&!Object.values(localStorage).some(v=>v.includes('learner@example.com'))"),true);
  const payload={author:'测试',email:'another@example.com',body:'测试申请用途',visitorId:crypto.randomUUID(),eventId:crypto.randomUUID()};
  const post=(data,headers={})=>fetch(origin+'/api/access-requests',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
  assert.equal((await post(payload,{Origin:'https://other.test'})).status,403);
  assert.equal((await post({...payload,email:'invalid'})).status,400);
  assert.equal((await post(payload)).status,201);
  assert.equal((await (await post(payload)).json()).created,false);
  assert.equal((await post({...payload,eventId:crypto.randomUUID()})).status,429);
  checks.push('Origin, validation, idempotency, cooldown, no browser persistence of email');
  await page('Page.navigate',{url:'http://127.0.0.1:'+offline.address().port+'/#lab'});await wait('!!window.MUSEUM_LAB');
  await evaluate("window.MUSEUM_LAB.open('c');document.querySelector('#access-request-open').click()");
  await wait("document.querySelector('#access-status').dataset.state==='error'");
  assert.equal(await evaluate("document.querySelector('#access-submit').disabled"),true);
  await screenshot('offline-390');checks.push('Unavailable backend disables form and offers contact address');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({checks,mailTransport:'intercepted locally; no real email sent',errors},null,2));
  console.log(JSON.stringify({passed:checks.length,output}));
 } finally {
  for(const r of requests.values())clearTimeout(r.timer);
  if(browser)browser.kill();if(backend)backend.kill();
  for(const server of [preview,offline])if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
  // Chrome may still be closing its profile; leave only this temporary profile to OS cleanup.
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
