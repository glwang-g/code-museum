// BiwaScheme is a JavaScript interpreter, not WebAssembly. One fresh Worker per program.
import Scheme from './assets/scheme/biwascheme-core.mjs';
const MAX_OUTPUT=20000;
// This playground exposes language operations, not BiwaScheme's JS or timer extensions.
for(const name of Object.keys(Scheme.CoreEnv)){
  if(name.startsWith('js-')||['..','timer','set-timer!','clear-timer!','sleep','load','read-line'].includes(name))delete Scheme.CoreEnv[name];
}
self.onmessage=({data})=>{
  let output='',finished=false;
  const capture=text=>{if(output.length<MAX_OUTPUT)output+=String(text).slice(0,MAX_OUTPUT-output.length)};
  Scheme.Port.current_output=new Scheme.Port.CustomOutput(capture);
  Scheme.Port.current_error=Scheme.Port.current_output;
  const fail=error=>{
    if(finished)return;
    finished=true;
    const message=String(error.message||error).slice(0,MAX_OUTPUT);
    const logs=output.slice(0,Math.max(0,MAX_OUTPUT-message.length-1));
    self.postMessage({kind:'result',id:data.id,ok:false,output:logs?`${logs}\n${message}`:message});
  };
  self.postMessage({kind:'ready',id:data.id});
  try{
    const interpreter=new Scheme.Interpreter(fail);
    interpreter.evaluate(data.code,value=>{
      if(finished)return;
      finished=true;
      if(value!==Scheme.undef){
        if(output&&!output.endsWith('\n'))capture('\n');
        capture(Scheme.to_write(value));
      }
      self.postMessage({kind:'result',id:data.id,ok:true,output:output||'执行完成（没有输出或表达式值）。'});
    });
  }catch(error){fail(error)}
};
