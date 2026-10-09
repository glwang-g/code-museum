// Opt-in actual browser -> SSH -> Docker check; installed Chrome and provisioned SSH host required.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),os=require('node:os'),crypto=require('node:crypto');
const {spawn,execFileSync}=require('node:child_process');
const {startPreview}=require('./executor-preview.cjs');
const root=path.resolve(__dirname,'..'),chrome=process.env.CHROME_BIN||'/Applications/GoogleChrome.app/Contents/MacOS/Google Chrome';
const outputDirectory=process.env.BROWSER_CHECK_OUTPUT||'/tmp/code-museum-executor-browser';fs.mkdirSync(outputDirectory,{recursive:true});
const profileDirectory=fs.mkdtempSync(path.join(os.tmpdir(),'museum-executor-browser-'));
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
async function output(expected,timeout=15000){await wait(`document.querySelector('#lab-result').dataset.state==='ok' && document.querySelector('#lab-result').textContent===${JSON.stringify(expected)}`,timeout);}
async function screenshot(name){if(!outputDirectory)return;await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');const r=await page('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(outputDirectory,name),Buffer.from(r.data,'base64'));}

(async()=>{
 let preview;
 try{
  const production=process.env.EXECUTOR_BROWSER_ORIGIN;
  if(production&&production!=='https://codemuseum.freexlib.com')throw new Error('Unsupported production origin');
  const token=production?execFileSync('ssh',['-o','BatchMode=yes',process.env.EXECUTOR_SSH_HOST||'xshow','sudo -n python3 -c '+JSON.stringify("from pathlib import Path; print(Path('/etc/code-museum-executor/private.env').read_text().strip().removeprefix('EXECUTOR_TOKEN='))")],{encoding:'utf8',timeout:15000}).trim():crypto.randomBytes(32).toString('hex');
  preview=production?{origin:production,stop:async()=>{}}:await startPreview({host:process.env.EXECUTOR_SSH_HOST||'xshow',port:0,token});
  browser=spawn(chrome,['--headless=new','--disable-gpu','--disable-background-networking','--no-first-run','--no-default-browser-check','--remote-debugging-pipe',...(production?[]:['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1']),'--user-data-dir='+profileDirectory],{stdio:['ignore','ignore','pipe','pipe','pipe']});
  browser.stderr.on('data',chunk=>{diagnostics=(diagnostics+chunk).slice(-3000)});
  browser.stdio[4].on('data',chunk=>{buffer+=chunk.toString();let end;while((end=buffer.indexOf('\0'))!==-1){const message=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);const request=pending.get(message.id);if(request){pending.delete(message.id);clearTimeout(request.timer);message.error?request.reject(new Error(JSON.stringify(message.error))):request.resolve(message.result);}}});
  const version=await send('Browser.getVersion'),target=await send('Target.createTarget',{url:'about:blank'});
  session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
  await page('Page.enable');await page('Runtime.enable');
  await page('Page.addScriptToEvaluateOnNewDocument',{source:`window.__posts=0;window.__downloads=[];const f=window.fetch;window.fetch=(url,opts)=>{if(opts?.method==='POST')window.__posts++;return f(url,opts)};`});
  await page('Page.navigate',{url:preview.origin+'/#lab'});await wait('!!window.MUSEUM_LAB');
  await evaluate(`window.MUSEUM_LAB.open('python')`);
  await wait(`!document.querySelector('#lab-run').disabled`);
  await edit('print(42)');await new Promise(ok=>setTimeout(ok,800));
  assert.equal(await evaluate(`window.__posts`),0);
  assert.equal(await evaluate(`performance.getEntriesByType('resource').some(r=>r.name.includes('/assets/pyodide/'))`),false);
  await evaluate(`document.querySelector('#lab-remote-token').value=${JSON.stringify(token)}`);
  let lastRun=0;
  async function clickRun(){const delay=Math.max(0,6500-(Date.now()-lastRun));if(delay)await new Promise(ok=>setTimeout(ok,delay));lastRun=Date.now();await evaluate(`document.querySelector('#lab-run').click()`)}
  for(const size of [{width:1440,height:1000,mobile:false},{width:390,height:844,mobile:true}]){
   await page('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:1});
   await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(size.width===1440?'dark':'light')}`);
   for(const [language,code] of [['python','print(sum(range(1,11))); print(input())'],['ruby','puts (1..10).sum; puts STDIN.gets'],['c','#include <stdio.h>\nint main(void){char s[32];scanf("%31s",s);printf("55\\n%s\\n",s);}'],['cpp','#include <iostream>\n#include <string>\nint main(){std::string s;std::cin>>s;std::cout<<"55\\n"<<s<<"\\n";}'],['rust','use std::io;fn main(){let mut s=String::new();io::stdin().read_line(&mut s).unwrap();println!("55\\n{}",s.trim());}'],['go','package main\nimport("fmt";"bufio";"os")\nfunc main(){s:=bufio.NewScanner(os.Stdin);s.Scan();fmt.Println(55);fmt.Println(s.Text())}'],['java','import java.util.Scanner;class Museum{public static void main(String[]a){System.out.println(55);System.out.println(new Scanner(System.in).nextLine());}}']]){
    await evaluate(`window.MUSEUM_LAB.open(${JSON.stringify(language)});document.querySelector('#lab-stdin').value='hello\\n'`);
    await edit(code);await clickRun();await output('55\nhello\n',65000);
    if(['c','cpp','rust','go','java'].includes(language)){
      assert.match(await evaluate(`document.querySelector('#lab-runtime-note').textContent`),/编译 \d+ ms.*运行 \d+ ms/);
      assert.equal(await evaluate(`document.querySelector('#lab-execution-mode option[value="local"]').disabled`),true);
    }
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
    await screenshot('remote-'+language+'-'+size.width+'.png');
    results.push({name:'Actual '+language+' Docker execution and stdin',width:size.width,output:'55\nhello\n'});
   }
  }
  await evaluate(`window.MUSEUM_LAB.open('rust')`);await edit('not valid source !!!');await clickRun();
  await wait(`document.querySelector('#lab-result').textContent.includes('编译失败，未执行程序。')`);
  assert.equal(await evaluate(`document.querySelector('#lab-error-kind').textContent`),'编译错误');
  results.push({name:'Compiler diagnostics identified separately, no execution',passed:true});
  await screenshot('compile-error-rust-390.png');
  await evaluate(`window.MUSEUM_LAB.open('go')`);await edit('package main\nimport "fmt"\nfunc main(){fmt.Println(42)}');await clickRun();
  await wait(`document.querySelector('#lab-runtime-state').dataset.stage==='compiling'`,15000);
  assert.equal(await evaluate(`document.querySelector('#lab-stop').hidden`),false);
  await screenshot('compiling-go-390.png');
  await evaluate(`document.querySelector('#lab-stop').click()`);
  await edit('package main\nimport "fmt"\nfunc main(){fmt.Println(42)}');await clickRun();await output('42\n',65000);
  results.push({name:'Stop during actual compilation and recover',passed:true});
  await evaluate(`window.MUSEUM_LAB.open('python')`);await edit('def broken(:');await clickRun();
  await wait(`document.querySelector('#lab-result').dataset.state==='error'&&document.querySelector('#lab-result').textContent.includes('SyntaxError')`);
  results.push({name:'Actual remote syntax error',passed:true});
  await edit('while True: pass');await clickRun();await wait(`!document.querySelector('#lab-cancel-remote').hidden`);
  await evaluate(`document.querySelector('#lab-cancel-remote').click()`);
  await edit('print(42)');await clickRun();await output('42\n');
  results.push({name:'Cancellation followed by actual remote recovery',passed:true});
  const before=await evaluate('window.__posts');await edit('print(43)');await new Promise(ok=>setTimeout(ok,800));assert.equal(await evaluate('window.__posts'),before);
  await evaluate(`document.querySelector('#lab-execution-mode').value='local';document.querySelector('#lab-execution-mode').dispatchEvent(new Event('change'))`);
  assert.equal(await evaluate(`performance.getEntriesByType('resource').some(r=>r.name.includes('/assets/pyodide/'))`),false);
  await evaluate(`document.querySelector('#lab-enable-local').click()`);await output('43',95000);
  assert.equal(await evaluate('window.__posts'),before);
  await screenshot('explicit-local-python-390.png');
  results.push({name:'Local Pyodide requires explicit enable, executes without POST',output:'43'});
  for(const [language,code] of [['javascript','console.log(42)'],['lua','print(42)'],['scheme','(+ 40 2)']]){
   await evaluate(`window.MUSEUM_LAB.useLocal(${JSON.stringify(language)});window.MUSEUM_LAB.open(${JSON.stringify(language)})`);await edit(code);await output('42');
   results.push({name:'Actual browser '+language+' execution',output:'42'});
  }
  const servedInputs={};for(const f of ['index.html','museum.css','museum.js','lab.js','execution-config.js','execution-modes.js','data/relationship-status.json','lab-worker.js','lua-worker.js','scheme-worker.js','assets/lua/manifest.json','assets/scheme/manifest.json','assets/pyodide/manifest.json']){const bytes=Buffer.from(await evaluate(`fetch(${JSON.stringify(f)}).then(r=>{if(!r.ok)throw new Error('Failed served input');return r.arrayBuffer()}).then(b=>Array.from(new Uint8Array(b)))`));assert.deepEqual(bytes,fs.readFileSync(path.join(root,'dist',f)),'Served build must match local: '+f);servedInputs[f]=crypto.createHash('sha256').update(bytes).digest('hex')}
  const report={servedInputs,checkedAt:new Date().toISOString(),browser:version.product,scope:production?'Actual Chrome over production HTTPS with private token to persistent Docker runc service. Tokens, sessions and job IDs omitted; no anonymous execution or escape proof.':'Actual browser over private SSH tunnel to ephemeral Docker runc API on xshow. Tokens, sessions and job IDs omitted; not a public deployment or escape proof.',checks:results,inputs:Object.fromEntries(['server/executor.py','server/runtime-images.json','scripts/serve.cjs','scripts/executor-preview.cjs','scripts/check-executor-browser.cjs','src/index.html','src/lab.js','src/museum.css','src/execution-config.js','src/execution-modes.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]))};
  fs.writeFileSync(path.join(outputDirectory,'checks.json'),JSON.stringify(report,null,2)+'\n');console.log('PASS '+results.length+' actual Docker/browser checks; report '+path.join(outputDirectory,'checks.json'));
 }catch(e){await screenshot('failure.png').catch(()=>{});console.error(e.stack+'\n'+diagnostics);process.exitCode=1}
 finally{
  if(browser){const exited=new Promise(ok=>browser.once('exit',ok));try{await send('Browser.close')}catch{}if(browser.exitCode===null&&browser.signalCode===null){browser.kill('SIGKILL');await exited}}
  if(preview)await preview.stop();fs.rmSync(profileDirectory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
 }
})().catch(e=>{console.error(e.message);process.exitCode=1});
