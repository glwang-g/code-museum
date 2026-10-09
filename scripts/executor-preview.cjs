// Private Linux Docker prototype over SSH; no public port or persistent deployment.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),net=require('node:net');
const {spawn}=require('node:child_process');
const {createRequestHandler}=require('./serve.cjs');
const root=path.resolve(__dirname,'..');
async function freePort(){const s=net.createServer();await new Promise((ok,no)=>{s.once('error',no);s.listen(0,'127.0.0.1',ok)});const port=s.address().port;await new Promise(ok=>s.close(ok));return port}
const bootstrap=String.raw`
import sys,json,os,tempfile,subprocess,selectors,time,urllib.request,shutil,secrets
from pathlib import Path
payload=json.loads(sys.stdin.buffer.readline())
directory=Path(tempfile.mkdtemp(prefix='code-museum-private-preview-'))
process=None
try:
 for name,source in payload['files'].items():
  target=directory/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(source)
 namespace='preview-'+secrets.token_hex(6)
 env=dict(os.environ,EXECUTOR_TOKEN=payload['token'],EXECUTOR_LOCK=str(directory/'executor.lock'))
 def launch():
  global process
  process=subprocess.Popen(['python3',str(directory/'executor.py'),'--namespace',namespace,'--port',str(payload['port']),'--origin',payload['origin'],'--metrics-db',str(directory/'metrics.sqlite'),'--museum-data',str(directory/'data')],env=env,stdout=subprocess.DEVNULL)
  for i in range(100):
   if process.poll() is not None: raise RuntimeError('Executor startup failed')
   try:
    with urllib.request.urlopen('http://127.0.0.1:'+str(payload['port'])+'/api/runtimes',timeout=1) as r:
     if r.status==200: break
   except OSError: time.sleep(.1)
  else: raise RuntimeError('Executor startup timeout')
  return process
 process=launch()
 print('READY',flush=True)
 with selectors.DefaultSelector() as selector:
  selector.register(sys.stdin,selectors.EVENT_READ)
  deadline=time.monotonic()+1800
  while time.monotonic()<deadline and selector.select(max(0,deadline-time.monotonic())):
   action=sys.stdin.readline().strip()
   if not action: break
   if action=='RESTART':
    process.terminate();process.wait(timeout=60);process=launch();print('RESTARTED',flush=True)
finally:
 if process and process.poll() is None:
  process.terminate()
  try: process.wait(timeout=60)
  except subprocess.TimeoutExpired: process.kill();process.wait()
 shutil.rmtree(directory)
`;
async function startPreview({host='xshow',port=4174,token=process.env.EXECUTOR_TOKEN,remotePort=4187}={}){
 if(typeof token!=='string'||token.length<32||!/^[\x21-\x7e]+$/.test(token))throw new Error('Set EXECUTOR_TOKEN to at least 32 printable ASCII characters');
 const tunnelPort=await freePort();
 const server=http.createServer(createRequestHandler(path.join(root,'dist'),{executor:'http://127.0.0.1:'+tunnelPort}));
 await new Promise((ok,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',ok)});
 const origin='http://127.0.0.1:'+server.address().port;
 const ssh=spawn('ssh',['-T','-o','BatchMode=yes','-o','ConnectTimeout=10','-o','ExitOnForwardFailure=yes','-L',`127.0.0.1:${tunnelPort}:127.0.0.1:${remotePort}`,host,'python3 -u -c '+"'"+bootstrap.replaceAll("'","'\\''")+"'"],{stdio:['pipe','pipe','pipe']});
 let errors='',ready=false,closed=false;
 ssh.stdin.on('error',()=>{}); // Startup/exit promise reports SSH errors; avoid unhandled EPIPE.
 ssh.stderr.on('data',c=>{errors=(errors+c).slice(-3000)});
 const stop=async()=>{if(closed)return;closed=true;server.closeAllConnections();await new Promise(ok=>server.close(ok));if(ssh.exitCode===null&&ssh.signalCode===null){const exit=new Promise(ok=>ssh.once('exit',ok));ssh.stdin.end();const timer=setTimeout(()=>ssh.kill('SIGTERM'),65000);await exit;clearTimeout(timer)}};
 try{
  await new Promise((ok,no)=>{
   const timer=setTimeout(()=>no(new Error('SSH executor startup timeout: '+errors)),20000);
   ssh.once('error',e=>{clearTimeout(timer);no(e)});
   ssh.once('exit',()=>{clearTimeout(timer);if(!ready)no(new Error('SSH executor failed: '+errors))});
   let output='';ssh.stdout.on('data',c=>{output+=c;if(output.includes('READY')){ready=true;clearTimeout(timer);ok()}});
   ssh.stdin.write(JSON.stringify({token,port:remotePort,origin,files:Object.fromEntries([...['executor.py','runtime-images.json','observability.py','mcp.py','mcp_http.py'].map(f=>[f,fs.readFileSync(path.join(root,'server',f),'utf8')]),...['catalogue.json','audit-reviews.json','relationship-status.json','execution-capabilities.json','mcp-manifest.json'].map(f=>['data/'+f,fs.readFileSync(path.join(root,'dist/data',f),'utf8')])])})+'\n');
  });
  ssh.once('exit',()=>{server.closeAllConnections();server.close()});
  const restart=()=>new Promise((ok,no)=>{
   let received='';const timer=setTimeout(()=>{ssh.stdout.off('data',listen);no(new Error('Preview restart timeout'))},75000);
   function listen(chunk){received+=chunk;if(received.includes('RESTARTED')){clearTimeout(timer);ssh.stdout.off('data',listen);ok()}}
   ssh.stdout.on('data',listen);ssh.stdin.write('RESTART\n');
  });
  return {origin,stop,restart};
 }catch(e){await stop();throw e}
}
module.exports={startPreview};
if(require.main===module)startPreview({host:process.env.EXECUTOR_SSH_HOST||'xshow',port:Number(process.env.PORT||4174),remotePort:Number(process.env.EXECUTOR_REMOTE_PORT||4187)}).then(preview=>{
 console.log('Private Docker preview: '+preview.origin+'/#lab\nPaste your EXECUTOR_TOKEN in the lab. Ctrl+C stops the temporary service. Maximum session: 30 minutes.');
 let stopping=false;const stop=async()=>{if(stopping)return;stopping=true;await preview.stop()};process.on('SIGINT',stop);process.on('SIGTERM',stop);
}).catch(e=>{console.error(e.message);process.exitCode=1});
