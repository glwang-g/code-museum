(() => {
  const examples=new Map(window.MUSEUM_LAB_EXAMPLES.map(example=>[example.id,example]));
  const byId=new Map(window.MUSEUM_DATA.records.map(record=>[record.id,record]));
  const pick=document.querySelector('#lab-language'),editor=document.querySelector('#lab-code');
  const highlight=document.querySelector('#lab-highlight'),result=document.querySelector('#lab-result');
  const runButton=document.querySelector('#lab-run'),resetButton=document.querySelector('#lab-reset');
  const escape=text=>text.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const keywords=new Set('async await break case catch class const continue default do else export extends false finally for from function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield def print range pass lambda None True False import as is not and or with int char return public private package namespace using fn mut impl use mod struct enum match pub crate let typeset done then fi foreach end endif echo set'.split(' '));
  let current=null,timer=null,worker=null,workerTimeout=null,runId=0;
  let pythonWorker=null,pythonReady=false,pythonBusy=false,pythonPending=null,pythonTimeout=null,pythonGeneration=0;
  let idleTimer=null,needsRun=false;
  const drafts=new Map();
  function paint(){
    const source=editor.value,pattern=/(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b)/g;
    let out='',at=0,match;
    while((match=pattern.exec(source))){
      out+=escape(source.slice(at,match.index));
      const token=match[0];
      const kind=/^(\/\/|\/\*|#)/.test(token)?'comment':/^["'`]/.test(token)?'string':/^\d/.test(token)?'number':keywords.has(token)?'keyword':'';
      out+=kind?`<span class="tok-${kind}">${escape(token)}</span>`:escape(token);
      at=pattern.lastIndex;
    }
    highlight.innerHTML=out+escape(source.slice(at))+'\n';
    highlight.scrollTop=editor.scrollTop;highlight.scrollLeft=editor.scrollLeft;
  }
  function stopJavaScript(){
    clearTimeout(timer);timer=null;
    clearTimeout(workerTimeout);workerTimeout=null;
    if(worker){worker.terminate();worker=null}
    runId++;
  }
  function stopPython(){
    clearTimeout(pythonTimeout);pythonTimeout=null;
    if(pythonWorker)pythonWorker.terminate();
    pythonWorker=null;pythonReady=false;pythonBusy=false;pythonPending=null;pythonGeneration++;
  }
  function stop(){stopJavaScript();stopPython()}
  function leave(){
    const hadPending=timer!==null;
    clearTimeout(timer);timer=null;
    if(hadPending)needsRun=true;
    if(current==='javascript'){
      if(worker||hadPending){stopJavaScript();needsRun=true;result.textContent='已离开实验台，运行暂停。';result.dataset.state=''}
    }else if(current==='python'){
      if((pythonWorker&&!pythonReady)||pythonBusy){
        stopPython();needsRun=true;result.textContent='已离开实验台，运行暂停。';result.dataset.state='';
      }else if(pythonReady){
        clearTimeout(idleTimer);
        idleTimer=setTimeout(()=>{
          idleTimer=null;
          if(document.hidden||document.querySelector('#lab').hidden){stopPython();needsRun=true}
        },180000);
      }
    }
  }
  function onTabChange(active){
    if(!active||document.hidden){leave();return}
    clearTimeout(idleTimer);idleTimer=null;
    if(needsRun){needsRun=false;run()}
  }
  function runJavaScript(){
    stopJavaScript();
    const id=runId;
    result.textContent='正在运行…';
    try{worker=new Worker('lab-worker.js')}
    catch(error){result.textContent=`无法启动浏览器运行环境：${error.message}`;return}
    const active=worker;
    workerTimeout=setTimeout(()=>{
      if(id!==runId)return;
      active.terminate();worker=null;workerTimeout=null;
      result.textContent='运行超过 2 秒，已停止。';result.dataset.state='error';
    },2000);
    active.onmessage=event=>{
      if(id!==runId)return;
      clearTimeout(workerTimeout);workerTimeout=null;active.terminate();worker=null;
      result.textContent=event.data.output;
      result.dataset.state=event.data.ok?'ok':'error';
    };
    active.onerror=event=>{
      if(id!==runId)return;
      clearTimeout(workerTimeout);workerTimeout=null;active.terminate();worker=null;
      result.textContent=`运行环境错误：${event.message}`;result.dataset.state='error';
    };
    active.postMessage({id,code:editor.value});
  }
  function startPythonWorker(){
    const generation=++pythonGeneration;
    try{pythonWorker=new Worker('python-worker.js',{type:'module'})}
    catch(error){result.textContent=`无法启动 Python Worker：${error.message}`;result.dataset.state='error';document.querySelector('#lab-runtime-note').textContent='本地 Python 运行时未能启动。';return}
    const active=pythonWorker;
    pythonReady=false;
    result.textContent='正在加载本地 Python 运行时…';result.dataset.state='';
    document.querySelector('#lab-runtime-note').textContent='正在准备本地 WebAssembly 运行时；只显示真实输出或错误。';
    pythonTimeout=setTimeout(()=>{
      if(generation!==pythonGeneration||pythonReady)return;
      stopPython();result.textContent='Python 运行时加载超过 90 秒，已停止。';result.dataset.state='error';document.querySelector('#lab-runtime-note').textContent='点击「运行代码」可重新加载。';
    },90000);
    active.onmessage=event=>{
      if(generation!==pythonGeneration)return;
      const data=event.data;
      if(data.kind==='ready'){
        clearTimeout(pythonTimeout);pythonTimeout=null;pythonReady=true;
        document.querySelector('#lab-runtime-note').textContent='本地 Pyodide 已就绪；代码在独立 Worker 中真实执行，超过 3 秒会停止。';
        if(pythonPending!==null&&timer===null)dispatchPython();
      }else if(data.kind==='fatal'){
        stopPython();result.textContent=data.output;result.dataset.state='error';document.querySelector('#lab-runtime-note').textContent='点击「运行代码」可重试加载。';
      }else if(data.kind==='result'){
        clearTimeout(pythonTimeout);pythonTimeout=null;pythonBusy=false;
        if(data.id===runId){result.textContent=data.output;result.dataset.state=data.ok?'ok':'error'}
        if(pythonPending!==null&&timer===null)dispatchPython();
      }
    };
    active.onerror=event=>{
      if(generation!==pythonGeneration)return;
      stopPython();result.textContent=`Python 运行环境错误：${event.message||'模块文件或资源未能加载'}`;result.dataset.state='error';document.querySelector('#lab-runtime-note').textContent='请通过本地预览服务打开页面，再点击「运行代码」重试。';
    };
    active.postMessage({kind:'init'});
  }
  function dispatchPython(){
    if(!pythonReady||!pythonWorker||pythonBusy||pythonPending===null)return;
    const code=pythonPending;pythonPending=null;pythonBusy=true;
    const id=++runId;
    result.textContent='正在运行 Python…';result.dataset.state='';
    pythonWorker.postMessage({kind:'run',id,code});
    const generation=pythonGeneration;
    pythonTimeout=setTimeout(()=>{
      if(generation!==pythonGeneration||!pythonBusy)return;
      const pending=pythonPending;
      stopPython();
      if(pending!==null){
        pythonPending=pending;
        startPythonWorker();
      }else{
        result.textContent='Python 运行超过 3 秒，已停止。';result.dataset.state='error';
        document.querySelector('#lab-runtime-note').textContent='运行已终止；点击「运行代码」会重新加载 Python。';
      }
    },3000);
  }
  function runPython(){
    clearTimeout(timer);timer=null;
    pythonPending=editor.value;
    if(pythonBusy)return;
    if(!pythonWorker)startPythonWorker();
    else if(pythonReady)dispatchPython();
  }
  function run(){
    clearTimeout(timer);timer=null;
    if(document.hidden||document.querySelector('#lab').hidden){needsRun=current==='javascript'||current==='python';return}
    needsRun=false;
    if(current==='javascript')runJavaScript();else if(current==='python')runPython();
  }
  function options(id){
    const entries=[...examples.values()];
    if(!examples.has(id)&&byId.has(id))entries.unshift({id});
    pick.innerHTML=entries.map(entry=>`<option value="${escape(entry.id)}">${escape(byId.get(entry.id)?.name||entry.id)}</option>`).join('');
    pick.value=id;
  }
  function show(id){
    if(!byId.has(id))id='javascript';
    // Reopening an archive entry should preserve its draft, result and loaded runtime.
    if(id===current)return;
    clearTimeout(idleTimer);idleTimer=null;
    stop();
    current=id;options(id);
    const record=byId.get(id),example=examples.get(id),runnable=id==='javascript'||id==='python';
    document.querySelector('#lab-title').textContent=`${record.name} · 实验台`;
    document.querySelector('#lab-file').textContent=example?.file||`${record.name} · 草稿`;
    document.querySelector('#lab-status').textContent=id==='javascript'?'JavaScript 在浏览器 Worker 中执行；改动后自动更新结果。':id==='python'?'Python 在本地 Pyodide Worker 中执行；首次加载需要一些时间。':example?.note||(example?'这是可编辑的语法示例；本页尚未接入该语言的运行环境。':'尚无经审核的示例；可记下草稿，本页尚未接入该语言的运行环境。');
    document.querySelector('#lab-runtime-note').textContent=id==='javascript'?'只显示本次代码实际产生的控制台输出或错误；超过 2 秒会停止。':id==='python'?'正在准备本地 WebAssembly 运行时；只显示真实输出或错误。':'运行环境未接入，不显示模拟结果。';
    editor.value=drafts.get(id)??example?.code??'';
    editor.placeholder=example?'':'暂无经审核的代码示例，可在此记录草稿。';
    resetButton.disabled=!example;
    runButton.disabled=!runnable;
    result.textContent=runnable?'进入实验台后运行…':'本语言尚未接入浏览器运行环境。';
    result.dataset.state='';
    paint();
    needsRun=runnable;
    if(runnable&&!document.querySelector('#lab').hidden){needsRun=false;run()}
  }
  editor.addEventListener('input',()=>{
    drafts.set(current,editor.value);paint();
    if(current==='javascript'||current==='python'){
      if(current==='javascript')stopJavaScript();
      else{runId++;if(!pythonReady)pythonPending=editor.value}
      result.textContent='代码已修改，等待运行…';result.dataset.state='';
      clearTimeout(timer);timer=setTimeout(run,current==='python'?650:450);
    }
  });
  editor.addEventListener('scroll',()=>{highlight.scrollTop=editor.scrollTop;highlight.scrollLeft=editor.scrollLeft});
  editor.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    event.preventDefault();const start=editor.selectionStart,end=editor.selectionEnd;
    editor.setRangeText('  ',start,end,'end');editor.dispatchEvent(new Event('input'));
  });
  runButton.onclick=run;
  resetButton.onclick=()=>{const example=examples.get(current);if(!example)return;drafts.delete(current);editor.value=example.code;paint();if(current==='javascript'||current==='python')run();editor.focus()};
  pick.onchange=()=>show(pick.value);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)leave();
    else if(!document.querySelector('#lab').hidden)onTabChange(true);
  });
  window.MUSEUM_LAB={canRun:id=>id==='javascript'||id==='python',open(id){show(id);document.querySelector('#lab-view').click();editor.focus({preventScroll:true})},show,stop,onTabChange};
  show('javascript');
})();
