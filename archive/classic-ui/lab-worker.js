// JavaScript runs in a fresh worker. The page terminates it after each run or timeout.
self.onmessage = async ({data}) => {
  const output=[];
  const MAX_OUTPUT=20000;
  let outputLength=0;
  const format=value=>typeof value==='string'?value:typeof value==='undefined'?'undefined':value===null?'null':typeof value==='object'?(()=>{try{return JSON.stringify(value)}catch{return String(value)}})():String(value);
  const consoleCapture={};
  for(const level of ['log','info','warn','error'])consoleCapture[level]=(...values)=>{
    if(output.length>=200||outputLength>=MAX_OUTPUT)return;
    const remaining=MAX_OUTPUT-outputLength;
    let line='';
    for(const [index,value] of values.entries()){
      if(line.length>=remaining)break;
      if(index)line+=' ';
      if(line.length<remaining)line+=String(format(value)??'').slice(0,remaining-line.length);
    }
    output.push(line);outputLength+=line.length+1;
  };
  try{
    const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
    await new AsyncFunction('console','"use strict";\n'+data.code)(consoleCapture);
    self.postMessage({id:data.id,ok:true,output:output.join('\n').slice(0,MAX_OUTPUT)||'执行完成（没有控制台输出）。'});
  }catch(error){
    const message=`${error.name}: ${error.message}`.slice(0,MAX_OUTPUT);
    const logs=output.join('\n').slice(0,Math.max(0,MAX_OUTPUT-message.length-1));
    self.postMessage({id:data.id,ok:false,output:logs?`${logs}\n${message}`:message});
  }
};
