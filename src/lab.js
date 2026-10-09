(() => {
  const examples=new Map(window.MUSEUM_LAB_EXAMPLES.map(example=>[example.id,example]));
  const byId=new Map(window.MUSEUM_DATA.records.map(record=>[record.id,record]));
  const pick=document.querySelector('#lab-language'),editor=document.querySelector('#lab-code');
  const highlight=document.querySelector('#lab-highlight'),result=document.querySelector('#lab-result');
  const runButton=document.querySelector('#lab-run'),resetButton=document.querySelector('#lab-reset');
  const escape=text=>text.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const execution=window.MUSEUM_EXECUTION;
  const runtimeStatus=window.MUSEUM_RUNTIME_STATUS;
  const localState=(stage,detail,extra={})=>runtimeStatus?.update(current,'local',{stage,detail,retryLabel:'重新加载并运行',...extra});
  const runnableIds=new Set(['javascript','python','lua','scheme']);
  const freshRuntimes={javascript:{file:'lab-worker.js'},lua:{file:'lua-worker.js',name:'Lua'},scheme:{file:'scheme-worker.js',name:'Scheme',module:true}};
  const schemeKeywords=new Set('define lambda let let* letrec if cond else begin set! quote quasiquote unquote and or do delay case define-syntax syntax-rules display newline map apply car cdr cons list'.split(' '));
  const keywords=new Set('async await break case catch class const continue default do else export extends false finally for from function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield def print range pass lambda None True False import as is not and or with int char return public private package namespace using fn mut impl use mod struct enum match pub crate let typeset done then fi foreach end endif echo set local nil repeat until elseif ipairs pairs true false'.split(' '));
  let current=null,timer=null,worker=null,workerTimeout=null,runId=0;
  let pythonWorker=null,pythonReady=false,pythonBusy=false,pythonPending=null,pythonTimeout=null,pythonGeneration=0;
  let idleTimer=null,needsRun=false;
  const store=window.MUSEUM_DRAFT_STORE;
  const drafts=store?.drafts||new Map(),backups=store?.backups||new Map();
  const topics=store?.topics||new Map();let currentTopic='default';
  const draftKey=()=>currentTopic==='default'?current:current+':'+currentTopic;
  const baseCode=()=>currentTopic==='default'?(examples.get(current)?.code||window.MUSEUM_LESSONS?.languages[current]?.examples.variables.code||''):(window.MUSEUM_LESSONS?.languages[current]?.examples[currentTopic]?.code||'');
  function changed(){if(typeof CustomEvent!=='undefined')document.dispatchEvent(new CustomEvent('museum-lab-change'))}
  function remember(){if(current){drafts.set(draftKey(),editor.value);store?.save()}}
  function backup(){backups.set(draftKey(),editor.value);store?.save()}
  function replaceCode(code,execute=false){
    stop();execution?.cancel();needsRun=false;
    editor.value=code;remember();paint();
    result.textContent='代码已载入；点击运行后执行。';result.dataset.state='';
    if(execution?.handles(current)&&!execution.allowed(current))execution.edited();
    else localState(runnableIds.has(current)?'idle':'unsupported','代码已载入，点击运行后执行。');
    changed();if(execute&&runnableIds.has(current)&&(!execution?.handles(current)||execution.allowed(current)))run();
  }
  function chooseTopic(topic){
    const available=window.MUSEUM_LESSONS?.languages[current]?.examples||{};
    if(topic!=='default'&&!available[topic])return;
    if(topic===currentTopic)return;
    remember();currentTopic=topic;topics.set(current,topic);
    const code=drafts.get(draftKey())??baseCode();replaceCode(code,false);
  }
  function manualStop(){
    stop();execution?.cancel();needsRun=false;
    result.textContent='运行已停止；可修改代码后重新运行。';result.dataset.state='';
    runtimeStatus?.update(current,execution?.mode?.(current)||'local',{stage:'cancelled',detail:'已停止加载或运行；远端活动任务已请求取消。'});
    changed();
  }
  function formatCode(source,language=current){
    const pattern=language==='scheme'?/(;[^\n]*|#\|[\s\S]*?\|#|"(?:\\.|[^"\\])*"|#[tf]|[+-]?\b\d+(?:\.\d+)?\b|[A-Za-z_][A-Za-z_0-9?!*+\/-]*)/g:language==='lua'?/(--\[\[[\s\S]*?\]\]|--[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b)/g:/(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b)/g;
    let out='',at=0,match;
    while((match=pattern.exec(source))){
      out+=escape(source.slice(at,match.index));
      const token=match[0];
      const kind=(language==='scheme'?/^(;|#\|)/:/^(\/\/|\/\*|#|--)/).test(token)?'comment':/^["'`]/.test(token)?'string':/^[+-]?\d/.test(token)?'number':(language==='scheme'?schemeKeywords:keywords).has(token)||language==='scheme'&&/^#[tf]$/.test(token)?'keyword':'';
      out+=kind?`<span class="tok-${kind}">${escape(token)}</span>`:escape(token);
      at=pattern.lastIndex;
    }
    return out+escape(source.slice(at))+'\n';
  }
  function paint(){
    highlight.innerHTML=formatCode(editor.value);
    highlight.scrollTop=editor.scrollTop;highlight.scrollLeft=editor.scrollLeft;
  }
  function stopFreshWorker(){
    clearTimeout(timer);timer=null;
    clearTimeout(workerTimeout);workerTimeout=null;
    if(worker){worker.terminate();worker=null;localState('idle','运行已停止；可重新运行。')}
    runId++;
  }
  function stopPython(){
    clearTimeout(pythonTimeout);pythonTimeout=null;
    if(pythonWorker)pythonWorker.terminate();
    pythonWorker=null;pythonReady=false;pythonBusy=false;pythonPending=null;pythonGeneration++;
    runtimeStatus?.update('python','local',{stage:'idle',detail:'本地环境已释放；再次运行会重新初始化。'});
  }
  function stop(){stopFreshWorker();stopPython()}
  function leave(){
    if(execution?.handles(current)&&!execution.allowed(current)){execution.cancel();needsRun=false;return}
    const hadPending=timer!==null;
    clearTimeout(timer);timer=null;
    if(hadPending)needsRun=true;
    if(!!freshRuntimes[current]){
      if(worker||hadPending){stopFreshWorker();needsRun=true;result.textContent='已离开实验台，运行暂停。';result.dataset.state='';localState('paused','回到实验台后重新运行。')}
    }else if(current==='python'){
      if((pythonWorker&&!pythonReady)||pythonBusy){
        stopPython();needsRun=true;result.textContent='已离开实验台，运行暂停。';result.dataset.state='';localState('paused','回到实验台后重新准备环境。');
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
    if(execution?.handles(current)&&!execution.allowed(current))return;
    if(needsRun){needsRun=false;run()}
  }
  function runFreshWorker(){
    const runtime=freshRuntimes[current],interpreted=!!runtime.name;
    stopFreshWorker();
    const id=runId;
    result.textContent='正在运行…';result.dataset.state='';
    localState(interpreted?(current==='scheme'?'initializing':'downloading'):'running',interpreted?'正在准备本地解释器；浏览器可能复用缓存。':'正在执行代码。',{loaded:null,total:null});
    try{worker=new Worker(runtime.file,runtime.module?{type:'module'}:undefined)}
    catch(error){result.textContent=`无法启动浏览器运行环境：${error.message}`;result.dataset.state='error';localState('failed','无法启动本地环境，点击重新加载并运行。');return}
    const active=worker;
    workerTimeout=setTimeout(()=>{
      if(id!==runId)return;
      active.terminate();worker=null;workerTimeout=null;
      result.textContent=interpreted?`${runtime.name} 运行时加载超过 30 秒，已停止。`:'运行超过 2 秒，已停止。';result.dataset.state='error';
      localState('failed',interpreted?'环境准备超时，可重试。':'运行超时，已停止。');
    },interpreted?30000:2000);
    active.onmessage=event=>{
      if(id!==runId)return;
      if(event.data.kind==='progress'){
        localState(event.data.stage,event.data.stage==='initializing'?'核心资源读取完成，正在初始化。':'正在下载或读取核心资源。',{loaded:event.data.loaded,total:event.data.total});return;
      }
      if(interpreted&&event.data.kind==='ready'){
        clearTimeout(workerTimeout);
        result.textContent=`正在运行 ${runtime.name}…`;
        localState('running','环境已就绪，正在执行代码。');
        workerTimeout=setTimeout(()=>{
          if(id!==runId)return;
          active.terminate();worker=null;workerTimeout=null;
          result.textContent=`${runtime.name} 运行超过 2 秒，已停止。`;result.dataset.state='error';
          localState('failed','运行超时，已停止；修改代码后重试。');
        },2000);
        return;
      }
      clearTimeout(workerTimeout);workerTimeout=null;active.terminate();worker=null;
      result.textContent=event.data.output;
      result.dataset.state=event.data.ok?'ok':'error';
      localState(event.data.ok?'completed':'failed',event.data.ok?'本次执行完成；再次运行会使用独立环境。':'代码执行失败，请查看运行结果。',{retryLabel:'重试运行'});
    };
    active.onerror=event=>{
      if(id!==runId)return;
      clearTimeout(workerTimeout);workerTimeout=null;active.terminate();worker=null;
      result.textContent=`运行环境错误：${event.message}`;result.dataset.state='error';
      localState('failed','本地运行环境出错，可重新加载并运行。');
    };
    active.postMessage({id,code:editor.value,files:window.MUSEUM_RUNTIME_ASSETS?.[current]?.files});
  }
  function startPythonWorker(){
    const generation=++pythonGeneration;
    try{pythonWorker=new Worker('python-worker.js',{type:'module'})}
    catch(error){result.textContent=`无法启动 Python Worker：${error.message}`;result.dataset.state='error';document.querySelector('#lab-runtime-note').textContent='本地 Python 运行时未能启动。';localState('failed','无法启动本地 Python，可重新加载并运行。');return}
    const active=pythonWorker;
    pythonReady=false;
    result.textContent='正在加载本地 Python 运行时…';result.dataset.state='';
    localState('downloading','正在下载或读取核心资源；浏览器可能复用缓存。',{loaded:0,total:window.MUSEUM_RUNTIME_ASSETS?.python?Object.values(window.MUSEUM_RUNTIME_ASSETS.python.files).reduce((sum,size)=>sum+size,0):null});
    document.querySelector('#lab-runtime-note').textContent='正在准备本地 WebAssembly 运行时；只显示真实输出或错误。';
    pythonTimeout=setTimeout(()=>{
      if(generation!==pythonGeneration||pythonReady)return;
      stopPython();result.textContent='Python 运行时加载超过 90 秒，已停止。';result.dataset.state='error';document.querySelector('#lab-runtime-note').textContent='点击「运行代码」可重新加载。';
      localState('failed','环境准备超过 90 秒，已停止；可重新加载。');
    },90000);
    active.onmessage=event=>{
      if(generation!==pythonGeneration)return;
      const data=event.data;
      if(data.kind==='progress'){
        localState(data.stage,data.stage==='initializing'?'核心资源读取完成，正在初始化 Python。':'正在下载或读取核心资源。',{loaded:data.loaded,total:data.total});
      }else if(data.kind==='ready'){
        clearTimeout(pythonTimeout);pythonTimeout=null;pythonReady=true;
        document.querySelector('#lab-runtime-note').textContent='本地 Pyodide 已就绪；代码在独立 Worker 中真实执行，超过 3 秒会停止。';
        localState('ready','环境已就绪，运行代码不会上传。',data.version?{version:data.version+' · '+(window.MUSEUM_RUNTIME_ASSETS?.python?.version||'Pyodide')}:{});
        if(pythonPending!==null&&timer===null)dispatchPython();
      }else if(data.kind==='fatal'){
        stopPython();result.textContent=data.output;result.dataset.state='error';document.querySelector('#lab-runtime-note').textContent='点击「运行代码」可重试加载。';
        localState('failed','Python 环境加载失败，可重新加载并运行。');
      }else if(data.kind==='result'){
        clearTimeout(pythonTimeout);pythonTimeout=null;pythonBusy=false;
        if(data.id===runId){result.textContent=data.output;result.dataset.state=data.ok?'ok':'error';localState(data.ok?'completed':'failed',data.ok?'执行完成，Python 环境可继续复用。':'代码执行失败，请查看运行结果。',{retryLabel:'重试运行'})}
        if(pythonPending!==null&&timer===null)dispatchPython();
      }
    };
    active.onerror=event=>{
      if(generation!==pythonGeneration)return;
      stopPython();result.textContent=`Python 运行环境错误：${event.message||'模块文件或资源未能加载'}`;result.dataset.state='error';document.querySelector('#lab-runtime-note').textContent='请通过本地预览服务打开页面，再点击「运行代码」重试。';
      localState('failed','运行资源未能加载，可重新加载并运行。');
    };
    active.postMessage({kind:'init',files:window.MUSEUM_RUNTIME_ASSETS?.python?.files});
  }
  function dispatchPython(){
    if(!pythonReady||!pythonWorker||pythonBusy||pythonPending===null)return;
    const code=pythonPending;pythonPending=null;pythonBusy=true;
    const id=++runId;
    result.textContent='正在运行 Python…';result.dataset.state='';
    localState('running','正在执行代码，超过 3 秒会停止。');
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
        localState('failed','运行超时，已停止；修改代码后重试。');
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
    if(execution?.handles(current)&&!execution.allowed(current)){execution.run(current,editor.value);return}
    if(freshRuntimes[current])runFreshWorker();else if(current==='python')runPython();
  }
  function options(id){
    const entries=[...examples.values()];
    for(const extra of Object.keys(window.MUSEUM_LESSONS?.languages||{}))if(!entries.some(entry=>entry.id===extra))entries.push({id:extra});
    if(!entries.some(entry=>entry.id===id)&&byId.has(id))entries.unshift({id});
    pick.innerHTML=entries.map(entry=>`<option value="${escape(entry.id)}">${escape(byId.get(entry.id)?.name||entry.id)}</option>`).join('');
    pick.value=id;
  }
  function show(id){
    if(!byId.has(id))id='javascript';
    // Reopening an archive entry should preserve its draft, result and loaded runtime.
    if(id===current)return;
    clearTimeout(idleTimer);idleTimer=null;
    remember();stop();
    current=id;currentTopic=topics.get(id)||'default';if(currentTopic!=='default'&&!window.MUSEUM_LESSONS?.languages[id]?.examples[currentTopic])currentTopic='default';options(id);
    const creditButton=document.querySelector('#lab-runtime-credit'),creditLabel=window.MUSEUM_CREDITS_UI?.labelFor(id);
    if(creditButton){creditButton.hidden=!creditLabel;creditButton.textContent=creditLabel||'';creditButton.onclick=()=>window.MUSEUM_CREDITS_UI?.openFor(current)}
    const record=byId.get(id),example=examples.get(id),runnable=runnableIds.has(id);
    document.querySelector('#lab-title').textContent=`${record.name} · 实验台`;
    document.querySelector('#lab-file').textContent=example?.file||`${record.name} · 草稿`;
    document.querySelector('#lab-status').textContent=id==='javascript'?'JavaScript 在浏览器 Worker 中执行；改动后自动更新结果。':id==='python'?'Python 在本地 Pyodide Worker 中执行；首次加载需要一些时间。':id==='lua'?'Lua 5.4 在本地 WebAssembly Worker 中执行；改动后自动更新结果。':id==='scheme'?'Scheme 由 BiwaScheme 0.8.3 浏览器解释器执行；改动后自动更新结果。':example?.note||((example||window.MUSEUM_LESSONS?.languages[id])?'这是可编辑的语法示例；本页尚未接入该语言的运行环境。':'尚无经审核的示例；可记下草稿，本页尚未接入该语言的运行环境。');
    document.querySelector('#lab-runtime-note').textContent=id==='javascript'?'只显示本次代码实际产生的控制台输出或错误；超过 2 秒会停止。':id==='python'?'正在准备本地 WebAssembly 运行时；只显示真实输出或错误。':id==='lua'?'只显示真实输出或错误；超过 2 秒会停止。支持 print 和基础标准库，不提供文件、系统或第三方模块。':id==='scheme'?'BiwaScheme（非 Wasm）；非完整 R7RS，2 秒超时。':'运行环境未接入，不显示模拟结果。';
    editor.value=drafts.get(draftKey())??baseCode();
    editor.placeholder=example?'':'暂无经审核的代码示例，可在此记录草稿。';
    resetButton.disabled=!example&&!window.MUSEUM_LESSONS?.languages[id];
    runButton.disabled=!runnable;
    result.textContent=runnable?'进入实验台后运行…':'本语言尚未接入浏览器运行环境。';
    result.dataset.state='';
    paint();
    needsRun=runnable;
    execution?.show(id);changed();
    if(!execution?.handles(id)){
      runtimeStatus?.select(id,'local');localState(runnable?'idle':'unsupported',runnable?'进入实验台后运行。':'该语言仅支持编辑，尚未接入执行环境。');
    }
    if(runnable&&!document.querySelector('#lab').hidden&&(!execution?.handles(id)||execution.allowed(id))){needsRun=false;run()}
  }
  editor.addEventListener('input',()=>{
    remember();paint();changed();
    if(execution?.handles(current)&&!execution.allowed(current)){execution.edited();return}
    if(runnableIds.has(current)){
      if(!!freshRuntimes[current])stopFreshWorker();
      else{runId++;if(!pythonReady)pythonPending=editor.value}
      result.textContent='代码已修改，等待运行…';result.dataset.state='';
      if(!pythonBusy&&(current!=='python'||pythonReady))localState('idle','代码已修改，即将自动运行。');
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
  resetButton.onclick=()=>{if(!baseCode())return;backup();replaceCode(baseCode(),false);editor.focus()};
  pick.onchange=()=>show(pick.value);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)leave();
    else if(!document.querySelector('#lab').hidden)onTabChange(true);
  });
  window.MUSEUM_LAB={
    get current(){return current},get topic(){return currentTopic},get code(){return editor.value},
    get hasBackup(){return backups.has(draftKey())},get modified(){return editor.value!==baseCode()},
    formatCode,chooseTopic,manualStop,
    importCode(code){if(typeof code!=='string'||code.length>131072)throw new Error('文件最多128 KiB字符。');backup();replaceCode(code,false)},
    undo(){if(!backups.has(draftKey()))return;const code=backups.get(draftKey());backups.set(draftKey(),editor.value);replaceCode(code,false)},
    openLesson(id,topic){show(id);chooseTopic(topic);document.querySelector('#lab-view').click();editor.focus({preventScroll:true})},
    canRun:id=>runnableIds.has(id)||!!execution?.canRun(id),useLocal:id=>execution?.useLocal(id),open(id){show(id);document.querySelector('#lab-view').click();editor.focus({preventScroll:true})},show,stop,onTabChange};
  execution?.configure({run,stop});
  runtimeStatus?.configure((id,mode)=>{
    if(id!==current)return;
    if(mode==='remote'){execution?.retry(id,editor.value);return}
    if(execution?.handles(id)&&!execution.allowed(id))return;
    if(id!=='python'||!pythonReady)stop();
    run();
  });
  show('javascript');
})();
