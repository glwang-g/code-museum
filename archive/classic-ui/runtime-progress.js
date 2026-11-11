// Observe only pinned core resources while the interpreter initializes.
// Stream the original body onward so WebAssembly keeps its normal streaming loader.
(() => {
  let restore=null;
  function start(files,report){
    restore?.();
    if(typeof globalThis.fetch!=='function'||typeof ReadableStream==='undefined')return;
    const original=globalThis.fetch,loaded=new Map(),total=Object.values(files||{}).reduce((sum,size)=>sum+size,0);
    let last=0,finished=false;
    const publish=force=>{
      if(finished)return;
      const now=Date.now();if(!force&&now-last<150)return;last=now;
      const received=[...loaded.values()].reduce((sum,size)=>sum+size,0);
      report({kind:'progress',stage:received>=total&&total>0?'initializing':'downloading',loaded:received,total});
    };
    const wrapped=async (...args)=>{
      const response=await original.apply(globalThis,args);
      const url=String(args[0]?.url||args[0]);
      const name=new URL(url,globalThis.location?.href).pathname.split('/').pop();
      if(!response.ok||!response.body||!Object.hasOwn(files||{},name))return response;
      loaded.set(name,0);publish(true);
      const reader=response.body.getReader();
      const body=new ReadableStream({
        async pull(controller){
          try{
            const chunk=await reader.read();
            if(chunk.done){controller.close();publish(true);return}
            loaded.set(name,Math.min(files[name],(loaded.get(name)||0)+chunk.value.byteLength));
            publish(false);controller.enqueue(chunk.value);
          }catch(error){controller.error(error)}
        },cancel(reason){return reader.cancel(reason)}
      });
      return new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers});
    };
    globalThis.fetch=wrapped;
    restore=()=>{finished=true;if(globalThis.fetch===wrapped)globalThis.fetch=original;restore=null};
    publish(true);
  }
  globalThis.MUSEUM_RUNTIME_PROGRESS={start,stop:()=>restore?.()};
})();
