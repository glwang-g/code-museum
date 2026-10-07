(() => {
  const examples=new Map(window.MUSEUM_LAB_EXAMPLES.map(example=>[example.id,example]));
  const byId=new Map(window.MUSEUM_DATA.records.map(record=>[record.id,record]));
  const pick=document.querySelector('#lab-language'),editor=document.querySelector('#lab-code');
  const highlight=document.querySelector('#lab-highlight'),result=document.querySelector('#lab-result');
  const runButton=document.querySelector('#lab-run'),resetButton=document.querySelector('#lab-reset');
  const escape=text=>text.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const runnableIds=new Set(['javascript','python','lua','scheme']);
  const freshRuntimes={javascript:{file:'lab-worker.js'},lua:{file:'lua-worker.js',name:'Lua'},scheme:{file:'scheme-worker.js',name:'Scheme',module:true}};
  const schemeKeywords=new Set('define lambda let let* letrec if cond else begin set! quote quasiquote unquote and or do delay case define-syntax syntax-rules display newline map apply car cdr cons list'.split(' '));
  const keywords=new Set('async await break case catch class const continue default do else export extends false finally for from function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield def print range pass lambda None True False import as is not and or with int char return public private package namespace using fn mut impl use mod struct enum match pub crate let typeset done then fi foreach end endif echo set local nil repeat until elseif ipairs pairs true false'.split(' '));
  let current=null,timer=null,worker=null,workerTimeout=null,runId=0;
  let pythonWorker=null,pythonReady=false,pythonBusy=false,pythonPending=null,pythonTimeout=null,pythonGeneration=0;
  let idleTimer=null,needsRun=false;
  const drafts=new Map();
  function paint(){
    const source=editor.value,pattern=current==='scheme'?/(;[^\n]*|#\|[\s\S]*?\|#|"(?:\\.|[^"\\])*"|#[tf]|[+-]?\b\d+(?:\.\d+)?\b|[A-Za-z_][A-Za-z_0-9?!*+\/-]*)/g:current==='lua'?/(--\[\[[\s\S]*?\]\]|--[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b)/g:/(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b)/g;
    let out='',at=0,match;
    while((match=pattern.exec(source))){
      out+=escape(source.slice(at,match.index));
      const token=match[0];
      const kind=(current==='scheme'?/^(;|#\|)/:/^(\/\/|\/\*|#|--)/).test(token)?'comment':/^["'`]/.test(token)?'string':/^[+-]?\d/.test(token)?'number':(current==='scheme'?schemeKeywords:keywords).has(token)||current==='scheme'&&/^#[tf]$/.test(token)?'keyword':'';
      out+=kind?`<span class="tok-${kind}">${escape(token)}</span>`:escape(token);
      at=pattern.lastIndex;
    }
    highlight.innerHTML=out+escape(source.slice(at))+'\n';
    highlight.scrollTop=editor.scrollTop;highlight.scrollLeft=editor.scrollLeft;
  }
  function stopFreshWorker(){
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
  function stop(){stopFreshWorker();stopPython()}
  function leave(){
    const hadPending=timer!==null;
    clearTimeout(timer);timer=null;
    if(hadPending)needsRun=true;
    if(!!freshRuntimes[current]){
      if(worker||hadPending){stopFreshWorker();needsRun=true;result.textContent='已离开实验台，运行暂停。';result.dataset.state=''}
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
  function runFreshWorker(){
    const runtime=freshRuntimes[current],interpreted=!!runtime.name;
    stopFreshWorker();
    const id=runId;
    result.textContent='正在运行…';result.dataset.state='';
    try{worker=new Worker(runtime.file,runtime.module?{type:'module'}:undefined)}
    catch(error){result.textContent=`无法启动浏览器运行环境：${error.message}`;return}
    const active=worker;
    workerTimeout=setTimeout(()=>{
      if(id!==runId)return;
      active.terminate();worker=null;workerTimeout=null;
      result.textContent=interpreted?`${runtime.name} 运行时加载超过 30 秒，已停止。`:'运行超过 2 秒，已停止。';result.dataset.state='error';
    },interpreted?30000:2000);
    active.onmessage=event=>{
      if(id!==runId)return;
      if(interpreted&&event.data.kind==='ready'){
        clearTimeout(workerTimeout);
        result.textContent=`正在运行 ${runtime.name}…`;
        workerTimeout=setTimeout(()=>{
          if(id!==runId)return;
          active.terminate();worker=null;workerTimeout=null;
          result.textContent=`${runtime.name} 运行超过 2 秒，已停止。`;result.dataset.state='error';
        },2000);
        return;
      }
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
    if(document.hidden||document.querySelector('#lab').hidden){needsRun=runnableIds.has(current);return}
    needsRun=false;
    if(freshRuntimes[current])runFreshWorker();else if(current==='python')runPython();
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
    const creditButton=document.querySelector('#lab-runtime-credit'),creditLabel=window.MUSEUM_CREDITS_UI?.labelFor(id);
    if(creditButton){creditButton.hidden=!creditLabel;creditButton.textContent=creditLabel||'';creditButton.onclick=()=>window.MUSEUM_CREDITS_UI?.openFor(current)}
    const record=byId.get(id),example=examples.get(id),runnable=runnableIds.has(id);
    document.querySelector('#lab-title').textContent=`${record.name} · 实验台`;
    document.querySelector('#lab-file').textContent=example?.file||`${record.name} · 草稿`;
    document.querySelector('#lab-status').textContent=id==='javascript'?'JavaScript 在浏览器 Worker 中执行；改动后自动更新结果。':id==='python'?'Python 在本地 Pyodide Worker 中执行；首次加载需要一些时间。':id==='lua'?'Lua 5.4 在本地 WebAssembly Worker 中执行；改动后自动更新结果。':id==='scheme'?'Scheme 由 BiwaScheme 0.8.3 浏览器解释器执行；改动后自动更新结果。':example?.note||(example?'这是可编辑的语法示例；本页尚未接入该语言的运行环境。':'尚无经审核的示例；可记下草稿，本页尚未接入该语言的运行环境。');
    document.querySelector('#lab-runtime-note').textContent=id==='javascript'?'只显示本次代码实际产生的控制台输出或错误；超过 2 秒会停止。':id==='python'?'正在准备本地 WebAssembly 运行时；只显示真实输出或错误。':id==='lua'?'只显示真实输出或错误；超过 2 秒会停止。支持 print 和基础标准库，不提供文件、系统或第三方模块。':id==='scheme'?'BiwaScheme（非 Wasm）；非完整 R7RS，2 秒超时。':'运行环境未接入，不显示模拟结果。';
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
    if(runnableIds.has(current)){
      if(!!freshRuntimes[current])stopFreshWorker();
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
  resetButton.onclick=()=>{const example=examples.get(current);if(!example)return;drafts.delete(current);editor.value=example.code;paint();if(runnableIds.has(current))run();editor.focus()};
  pick.onchange=()=>show(pick.value);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)leave();
    else if(!document.querySelector('#lab').hidden)onTabChange(true);
  });
  window.MUSEUM_LAB={canRun:id=>runnableIds.has(id),open(id){show(id);document.querySelector('#lab-view').click();editor.focus({preventScroll:true})},show,stop,onTabChange};
  show('javascript');
})();
