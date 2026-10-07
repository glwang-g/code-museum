const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {LuaFactory}=require('../public/assets/lua/wasmoon.js');

test('Lua worker executes bundled Wasm, isolates runs and preserves errors within output limits',async()=>{
  const messages=[];
  const self={location:{href:'http://localhost/lua-worker.js'},postMessage:m=>messages.push(m)};
  class LocalFactory extends LuaFactory{
    constructor(){super(path.resolve(__dirname,'../public/assets/lua/glue.wasm'))}
  }
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../src/lua-worker.js'),'utf8'),{
    self,URL,importScripts(){},wasmoon:{LuaFactory:LocalFactory}
  });
  const execute=async(code)=>{await self.onmessage({data:{id:42,code}});return messages.pop()};
  const result=await execute('saved=7; local sum=0; for i=1,10 do sum=sum+i end; print(sum, _VERSION)');
  assert.equal(result.ok,true);assert.equal(result.output,'55\tLua 5.4');
  assert.equal((await execute('print(saved)')).output,'nil');
  assert.equal((await execute('print(io, os, package, require, debug)')).output,'nil\tnil\tnil\tnil\tnil');
  assert.equal((await execute('local = 1')).ok,false);
  const failed=await execute('print(string.rep("x",50000)); error("after full logs")');
  assert.equal(failed.ok,false);assert.equal(failed.output.length,20000);
  assert.match(failed.output,/after full logs/);
});
