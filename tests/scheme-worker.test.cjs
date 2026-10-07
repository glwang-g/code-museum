const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {Worker}=require('node:worker_threads');
const source=fs.readFileSync(path.resolve(__dirname,'../src/scheme-worker.js'),'utf8').replace(/^import .*;\s*$/m,'');
const runtime=pathToFileURL(path.resolve(__dirname,'../public/assets/scheme/biwascheme-core.mjs')).href;
function execute(code){
  return new Promise((resolve,reject)=>{
    const worker=new Worker(`
      const {parentPort,workerData}=require('node:worker_threads');
      (async()=>{
        const {default:Scheme}=await import(workerData.runtime);
        const self={postMessage:m=>parentPort.postMessage(m)};
        require('node:vm').runInNewContext(workerData.source,{self,Scheme});
        self.onmessage({data:{id:42,code:workerData.code}});
      })().catch(e=>{throw e});
    `,{eval:true,workerData:{source,runtime,code}});
    const timeout=setTimeout(()=>{worker.terminate();reject(new Error('Scheme Worker timeout'))},3000);
    worker.on('message',m=>{if(m.kind!=='result')return;clearTimeout(timeout);worker.terminate();resolve(m)});
    worker.once('error',e=>{clearTimeout(timeout);worker.terminate();reject(e)});
  });
}
test('Scheme executes actual expressions, lists and continuations in isolated workers',async()=>{
  assert.equal((await execute('(+ 1 2)')).output,'3');
  assert.equal((await execute('(display (apply + (map (lambda (x) (* x x)) (list 1 2 3)))) (newline)')).output,'14\n');
  assert.equal((await execute('(call/cc (lambda (exit) (+ 1 (exit 42))))')).output,'42');
  assert.equal((await execute('(define saved 7) saved')).output,'7');
  assert.equal((await execute('saved')).ok,false);
  assert.equal((await execute('(js-eval "1+2")')).ok,false);
});
test('Scheme reports syntax/runtime errors and preserves errors after bounded output',async()=>{
  assert.equal((await execute('(+ 1')).ok,false);
  const result=await execute('(display (make-string 50000 #\\x)) (car 1)');
  assert.equal(result.ok,false);assert.equal(result.output.length,20000);
  assert.match(result.output,/car|pair/);
});
