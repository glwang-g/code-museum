// Temporary two-host workers behind one local gateway; no production token or installation.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),net=require('node:net'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {startPreview}=require('./executor-preview.cjs');
const {createRequestHandler}=require('./serve.cjs');
const root=path.resolve(__dirname,'..');
async function freePort(){const server=net.createServer();await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok)});const port=server.address().port;await new Promise(ok=>server.close(ok));return port}
const delay=ms=>new Promise(ok=>setTimeout(ok,ms));
async function terminate(process){
 if(!process||!process.pid||process.exitCode!==null||process.signalCode!==null)return;
 await new Promise(resolve=>{const timer=setTimeout(()=>process.kill('SIGKILL'),10000);process.once('exit',()=>{clearTimeout(timer);resolve()});process.kill('SIGTERM')});
}
function validatePreviewNodes(nodes){
 if(!Array.isArray(nodes)||nodes.length!==2)throw new Error('Expected exactly two explicit preview nodes');
 const ids=new Set(),languages=new Set();
 for(const node of nodes){
  if(!node||!/^[a-z][a-z0-9-]{0,23}$/.test(node.id)||ids.has(node.id)||!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(node.host)||!Array.isArray(node.languages)||!node.languages.length||node.languages.some(id=>typeof id!=='string'||!/^[a-z][a-z0-9.-]*$/.test(id)||languages.has(id)))throw new Error('Invalid or overlapping preview node inventory');
  if(node.remotePort!==undefined&&(!Number.isInteger(node.remotePort)||node.remotePort<1024||node.remotePort>65535))throw new Error('Invalid preview worker port');
  for(const id of node.languages){if(languages.has(id))throw new Error('Duplicate preview language');languages.add(id)}
  ids.add(node.id);
 }
 return nodes;
}
async function startDualPreview({port=0,token=crypto.randomBytes(32).toString('hex'),python='python3',guestSessions=0,runtime='runc',nodes=[{id:'xshow',host:'xshow',languages:['python'],remotePort:4197},{id:'xshow2',host:'xshow2',languages:['bcpl'],remotePort:4197}]}={}){
 if(![0,5].includes(guestSessions)||!['runc','runsc'].includes(runtime))throw new Error('Invalid preview admission or sandbox configuration');
 validatePreviewNodes(nodes);
 if(typeof token!=='string'||token.length<32||!/^[\x21-\x7e]+$/.test(token))throw new Error('Expected a private printable preview token');
 if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid local preview port');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'museum-dual-preview-'));
 fs.chmodSync(directory,0o700);
 const gatewayPort=await freePort(),gatewayOrigin='http://127.0.0.1:'+gatewayPort;
 const server=http.createServer(createRequestHandler(path.join(root,'dist'),{executor:gatewayOrigin}));
 let gateway=null,closed=false,errors='';const workers={};
 const stop=async()=>{
  if(closed)return;closed=true;
  server.closeAllConnections();if(server.listening)await new Promise(ok=>server.close(ok));
  await terminate(gateway);
  const results=await Promise.allSettled(Object.values(workers).map(worker=>worker.stop()));
  fs.rmSync(directory,{recursive:true,force:true});
  const failed=results.find(result=>result.status==='rejected');if(failed)throw failed.reason;
 };
 try{
  await new Promise((ok,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',ok)});
  const origin='http://127.0.0.1:'+server.address().port;
  const config={schemaVersion:1,nodes:[]},env={...process.env,EXECUTOR_TOKEN:token};
  // Start sequentially so every created resource is registered for failure cleanup.
  for(const node of nodes){
   const workerToken=crypto.randomBytes(32).toString('hex'),tokenEnv='EXECUTOR_NODE_'+node.id.replaceAll('-','_').toUpperCase()+'_TOKEN';
   workers[node.id]=await startPreview({host:node.host,port:0,token:workerToken,remotePort:node.remotePort||4197,languages:node.languages,workerOrigin:origin,runtime});
   config.nodes.push({id:node.id,url:workers[node.id].origin,tokenEnv,languages:node.languages});env[tokenEnv]=workerToken;
  }
  const configPath=path.join(directory,'nodes.json'),routesPath=path.join(directory,'routes.sqlite');
  fs.writeFileSync(configPath,JSON.stringify(config),{mode:0o600});
  async function launchGateway(){
   errors='';gateway=spawn(python,[path.join(root,'server/execution_gateway.py'),'--guest-sessions',String(guestSessions),'--nodes',configPath,'--images',path.join(root,'server/runtime-images.json'),'--routes-db',routesPath,'--port',String(gatewayPort),'--origin',origin,'--museum-data',path.join(root,'dist/data'),'--allow-partial'],{env,stdio:['ignore','ignore','pipe']});
   let spawnError;gateway.once('error',error=>{spawnError=error});gateway.stderr.on('data',chunk=>{errors=(errors+chunk).slice(-3000)});
   const deadline=Date.now()+20000;
   while(Date.now()<deadline){
    if(spawnError)throw spawnError;
    if(gateway.exitCode!==null||gateway.signalCode!==null)throw new Error('Temporary gateway startup failed: '+errors);
    try{const response=await fetch(gatewayOrigin+'/api/runtimes',{signal:AbortSignal.timeout(1500)});if(response.ok){const body=await response.json();if(body.available)return}}catch{}
    await delay(100);
   }
   throw new Error('Temporary gateway startup timeout: '+errors);
  }
  await launchGateway();
  const restartGateway=async()=>{if(closed)throw new Error('Preview is closed');await terminate(gateway);await launchGateway()};
  return {origin,token,stop,restartGateway,nodes:Object.fromEntries(nodes.map(node=>[node.id,{id:node.id,host:node.host,languages:[...node.languages],pause:workers[node.id].pause,resume:workers[node.id].resume,restart:workers[node.id].restart}]))};
 }catch(error){try{await stop()}catch(cleanupError){throw new AggregateError([error,cleanupError],'Dual preview startup and cleanup failed')}throw error}
}
module.exports={startDualPreview,validatePreviewNodes};
if(require.main===module)startDualPreview({port:Number(process.env.PORT||4174)}).then(preview=>{
 console.log('Temporary dual-node preview: '+preview.origin+'/#lab');
 console.log('Uses fresh private test credentials; no production token or permanent service changes.');
 let stopping=false;const stop=async()=>{if(stopping)return;stopping=true;try{await preview.stop()}catch(error){console.error(error.message);process.exitCode=1}};process.on('SIGINT',stop);process.on('SIGTERM',stop);
}).catch(error=>{console.error(error.message);process.exitCode=1});
