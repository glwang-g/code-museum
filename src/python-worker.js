// Pyodide is bundled locally. Each module worker can be terminated to stop long-running code.
import {loadPyodide} from './assets/pyodide/pyodide.mjs';
let pyodide;
const MAX_OUTPUT = 20000;
self.onmessage = async ({data}) => {
  if (data.kind === 'init') {
    try {
      pyodide = await loadPyodide({indexURL: new URL('assets/pyodide/', self.location.href).href});
      self.postMessage({kind:'ready'});
    } catch (error) {
      self.postMessage({kind:'fatal', output:`Python 运行时加载失败：${error.message}`});
    }
    return;
  }
  if (data.kind !== 'run' || !pyodide) return;
  const lines=[];
  let outputLength=0;
  const capture=text=>{
    if(outputLength>=MAX_OUTPUT)return;
    const line=String(text).slice(0,MAX_OUTPUT-outputLength);
    lines.push(line);outputLength+=line.length+1;
  };
  try {
    pyodide.setStdout({batched:capture});
    pyodide.setStderr({batched:capture});
    // Each edit is a complete program, so keep its variables separate from earlier runs.
    const globals=pyodide.runPython('dict()');
    try { await pyodide.runPythonAsync(data.code,{globals}); }
    finally { globals.destroy(); }
    self.postMessage({kind:'result',id:data.id,ok:true,output:lines.join('\n').slice(0,MAX_OUTPUT)||'执行完成（没有标准输出）。'});
  } catch (error) {
    const message=`${error.name}: ${error.message}`.slice(0,MAX_OUTPUT);
    const logs=lines.join('\n').slice(0,Math.max(0,MAX_OUTPUT-message.length-1));
    self.postMessage({kind:'result',id:data.id,ok:false,output:logs?`${logs}\n${message}`:message});
  }
};
