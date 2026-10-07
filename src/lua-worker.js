// A fresh Lua VM per run; the page terminates the worker on completion or timeout.
importScripts('./assets/lua/wasmoon.js');
const MAX_OUTPUT=20000;
self.onmessage=async ({data})=>{
  const lines=[];
  let size=0,lua;
  const capture=text=>{
    if(size>=MAX_OUTPUT)return;
    const line=String(text).slice(0,MAX_OUTPUT-size);
    lines.push(line);size+=line.length+1;
  };
  try{
    const factory=new wasmoon.LuaFactory(new URL('./assets/lua/glue.wasm',self.location.href).href);
    lua=await factory.createEngine({injectObjects:false,enableProxy:false});
    lua.global.set('__museum_output',capture);
    lua.doStringSync(`
      local output, convert, concat = __museum_output, tostring, table.concat
      __museum_output = nil
      print = function(...)
        local values = {}
        for i = 1, select('#', ...) do values[i] = convert(select(i, ...)) end
        output(concat(values, '\\t'))
      end
      io, os, package, require, dofile, loadfile, debug = nil, nil, nil, nil, nil, nil, nil
    `);
    self.postMessage({kind:'ready',id:data.id});
    lua.doStringSync(data.code);
    self.postMessage({kind:'result',id:data.id,ok:true,output:lines.join('\n').slice(0,MAX_OUTPUT)||'执行完成（没有标准输出）。'});
  }catch(error){
    const message=String(error.message||error).slice(0,MAX_OUTPUT);
    const logs=lines.join('\n').slice(0,Math.max(0,MAX_OUTPUT-message.length-1));
    self.postMessage({kind:'result',id:data.id,ok:false,output:logs?`${logs}\n${message}`:message});
  }finally{lua?.global.close()}
};
