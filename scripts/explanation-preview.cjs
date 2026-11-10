// Local same-origin preview. The Python backend alone reads the ignored API key file.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process');
const {createRequestHandler}=require('./serve.cjs');
async function start({port=4173}={}){
 const root=path.resolve(__dirname,'..'),state=path.join(root,'tmp/deepseek');fs.mkdirSync(state,{recursive:true});
 const web=http.createServer();await new Promise((resolve,reject)=>{web.once('error',reject);web.listen(port,'127.0.0.1',resolve)});
 const origin='http://127.0.0.1:'+web.address().port;
 const child=spawn('python3',[path.join(root,'server/explanations.py'),'--env-file',path.join(root,'.env.deepseek.local'),'--database',path.join(state,'usage.sqlite3'),'--port','0','--origin',origin],{cwd:root,stdio:['ignore','pipe','pipe']});
 child.stderr.on('data',chunk=>process.stderr.write(chunk));
 try{
  const ready=await new Promise((resolve,reject)=>{
   let buffer='';const timer=setTimeout(()=>reject(new Error('Explanation service startup timed out')),10000);
   child.once('error',error=>{clearTimeout(timer);reject(error)});
   child.once('exit',()=>{clearTimeout(timer);reject(new Error('Explanation service exited'))});
   child.stdout.on('data',chunk=>{
    buffer+=chunk.toString();if(!buffer.includes('\n'))return;clearTimeout(timer);
    try{resolve(JSON.parse(buffer.split('\n')[0]))}catch{reject(new Error('Invalid service startup response'))}
   });
  });
  web.on('request',createRequestHandler(path.join(root,'dist'),{explanations:'http://127.0.0.1:'+ready.port}));
  return {origin,process:child,async close(){web.closeAllConnections();await new Promise(r=>web.close(r));if(child.exitCode===null)await new Promise(r=>{child.once('exit',r);child.kill('SIGTERM')})}};
 }catch(error){web.close();child.kill();throw error}
}
if(require.main===module)start({port:Number(process.env.PORT||4173)}).then(preview=>{console.log('DeepSeek lab preview: '+preview.origin+'/#lab (model calls only on click)');for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>preview.close().then(()=>process.exit(0)));preview.process.once('exit',()=>process.exit(1))}).catch(error=>{console.error(error.message);process.exitCode=1});
module.exports={start};
