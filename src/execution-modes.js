(()=>{
  const config=window.MUSEUM_EXECUTION_CONFIG;if(!config?.enabled)return;
  const $=id=>document.getElementById(id),local=new Map([['python','Python · Pyodide，约13.53 MB未压缩'],['lua','Lua · Wasmoon，约413 KiB未压缩'],['scheme','Scheme · BiwaScheme，约244 KiB，非Wasm']]);
  const remoteIds=new Set(['python','ruby','c','cpp','rust','go','java','typescript','sql','bash','awk','sed','php','perl','xslt','csharp','fortran','pascal','r','algol-60','common-lisp','prolog','forth','racket','smalltalk','cobol','ada','clojure','ocaml','haskell','kotlin','groovy','erlang','elixir','tcl','standard-ml','scala','visual-basic.net','f-sharp','d','nim','zig','swift','dart','julia','octave','powershell','korn-shell','tcsh','wasm','x86-assembly','verilog','vhdl','postscript','bcpl','oberon']),modes=new Map(),consent=new Set();
  const status=window.MUSEUM_RUNTIME_STATUS;
  const terminal=new Set(['completed','failed','compile_error','compile_timed_out','timed_out','cancelled','output_limit','memory_limit','infrastructure_error']);
  let current=null,capabilities=null,callbacks={},generation=0,active=null,connectionGeneration=0;
  const endpoint=config.endpoint;
  if(endpoint!=='/api')throw new Error('Executor must use the same-origin /api endpoint');
  const shortVersion=value=>{const r=String(value).match(/^Rscript \(R\) version ([\d.]+)/);if(r)return 'R '+r[1];const text=String(value).split(' / ')[0].replace(/\s*\(.*$/,'').trim();return text||String(value)};
  const mode=id=>modes.get(id)||(remoteIds.has(id)?'remote':'local');
  const handles=id=>local.has(id)||remoteIds.has(id);
  const allowed=id=>mode(id)==='local'&&consent.has(id)&&local.has(id);
  const guestEnabled=()=>capabilities?.private===false&&capabilities?.access?.mode==='guest';
  const remoteAvailable=id=>guestEnabled()&&!!capabilities?.available&&capabilities.runtimes.some(r=>r.id===id);
  function headers(){return {'Content-Type':'application/json'};}
  async function request(path,options={}){
    let response;
    try{response=await fetch(endpoint+path,{...options,credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(6000)})}
    catch(cause){const error=new Error((cause.name==='TimeoutError'?'连接远端执行服务超时。':cause.message||'远端连接中断。')+(options.method==='POST'?' 提交结果暂不确定，请勿立即重复提交。':''));error.network=true;throw error}
    let data;
    try{data=await response.json();if(!data||typeof data!=='object')throw new Error('Invalid response')}
    catch{const error=new Error('远端服务尚未连接或响应无效。');error.status=response.status;throw error}
    if(!response.ok){const error=new Error(response.status===401?'远端执行暂未开放，请稍后重试。':response.status===429?'当前访问比较多，请稍后重试。':(data.error||'远端执行请求失败。')+(data.retrySafe===false?' 提交结果暂不确定，请勿立即重复提交。':''));error.status=response.status;throw error}
    return data;
  }
  async function readJob(ident,gen){
    // Re-read only the original accepted job. A submission or cancellation is never retried.
    for(let attempt=0;attempt<3;attempt++){
      if(gen!==generation)return null;
      try{return await request('/executions/'+ident,{headers:headers()})}
      catch(error){if(attempt===2||(!error.network&&error.status!==503))throw error;await new Promise(resolve=>setTimeout(resolve,250))}
    }
  }
  const simulation=id=>['verilog','vhdl'].includes(id);
  function render(){
    $('lab-run').textContent=simulation(current)?'仿真代码':'运行代码';
    if($('lab-output-label'))$('lab-output-label').textContent=simulation(current)?'仿真结果':'运行结果';
    const on=handles(current);$('lab-execution-controls').hidden=!on;
    if(!on){if(typeof Event!=='undefined')document.dispatchEvent?.(new Event('museum-execution-change'));return;}
    const isRemote=mode(current)==='remote';
    status?.select(current,mode(current));
    if(!isRemote&&!allowed(current))status?.update(current,'local',{stage:'not-enabled',detail:'点击“下载并启用”后才读取本地运行资源。'});
    $('lab-execution-mode').value=mode(current);
    $('lab-execution-mode').querySelector('[value="remote"]').disabled=!remoteIds.has(current);
    $('lab-execution-mode').querySelector('[value="local"]').disabled=!local.has(current);
    $('lab-remote-access').hidden=!isRemote;
    $('lab-stdin').disabled=current==='sql';
    $('lab-stdin').placeholder=current==='sql'?'SQLite 直接读取编辑区 SQL，不使用独立标准输入':current==='xslt'?'XSLT 样式表读取编辑区；在此填写 XML 输入文档':current==='r'?'Rscript 用 file("stdin") 或 scan("stdin", ...) 读取':'程序要读取的数据，可留空';
    $('lab-enable-local').hidden=isRemote||allowed(current)||!local.has(current);
    $('lab-enable-local').textContent=local.get(current)+' · 下载并启用';
    $('lab-cancel-remote').hidden=!active||!isRemote;
    $('lab-run').disabled=isRemote?!remoteAvailable(current)||!!active:!allowed(current);
    const record=capabilities?.runtimes.find(r=>r.id===current);
    $('lab-execution-info').textContent=isRemote?(record&&guestEnabled()?'远端 '+shortVersion(record.version)+' · 免令牌试用 · 最多'+capabilities.access.maxSessions+'个活跃会话 · 点击运行才上传代码':(capabilities&&!guestEnabled()?'远端执行暂未开放。':'远端执行服务尚未连接；不会下载本地运行时。')):(allowed(current)?'浏览器本地执行；代码不会发送到执行服务器。':'本地环境尚未启用，点击下载后才加载。');
    if(isRemote){
      $('lab-status').textContent=simulation(current)?'远端文本仿真 · 点击“仿真代码”才上传；不是真实电路。':'远端执行 · 代码只在点击“运行代码”时上传。';
      $('lab-runtime-note').textContent=(record?.compileSeconds?'编译'+record.compileSeconds+'秒 / ':'')+(simulation(current)?'仿真3秒实际时间上限，无综合、FPGA 部署或波形下载；':'运行'+(record?.runSeconds||3)+'秒上限、')+'禁网、独立Docker环境；不自动安装第三方包。';
      $('lab-runtime-credit').hidden=!record;
      $('lab-runtime-credit').textContent=record?'运行环境 · 项目与许可 ↗':'';
      $('lab-runtime-credit').onclick=()=>{if(record)window.MUSEUM_CREDITS_UI?.openRemoteFor(current)};
    }else{
      const label=window.MUSEUM_CREDITS_UI?.labelFor(current);
      $('lab-runtime-credit').hidden=!label;
      $('lab-runtime-credit').textContent=label||'';
      $('lab-runtime-credit').onclick=()=>window.MUSEUM_CREDITS_UI?.openFor(current);
      $('lab-status').textContent='浏览器本地执行 · 启用后，编辑会自动更新结果。';
      $('lab-runtime-note').textContent=allowed(current)?'浏览器本地执行，不上传代码。':'尚未下载或初始化本地运行环境。';
    }
    if(typeof Event!=='undefined')document.dispatchEvent?.(new Event('museum-execution-change'));
  }
  function clearDetails(){
    if($('lab-compiler')){$('lab-compiler').hidden=true;$('lab-compiler').open=false;$('lab-compiler-result').textContent='';}
    if($('lab-timings')){$('lab-timings').hidden=true;$('lab-timings').textContent='';}
  }
  function cancel(message=false,redraw=true){
    clearDetails();
    generation++;
    const job=active;active=null;
    if(job)status?.update(current,'remote',{stage:'cancelled',detail:job.id?'已请求服务器停止任务。':'已停止等待提交结果。'});
    if(job?.id)request('/executions/'+job.id,{method:'DELETE',headers:headers()}).catch(()=>{});
    if(message){$('lab-result').textContent='任务已取消；正在请求服务器停止。';$('lab-result').dataset.state='';}
    if(redraw)render();
  }
  async function run(id,code){
    if(!remoteIds.has(id)||mode(id)!=='remote')return;
    cancel();const gen=generation;
    if(!remoteAvailable(id)){$('lab-result').textContent='远端执行暂不可用，请重新连接后重试。';$('lab-result').dataset.state='error';return}
    active={id:null};render();$('lab-result').textContent='正在提交远端任务…';$('lab-result').dataset.state='';
    status?.update(id,'remote',{stage:'submitting',detail:'正在提交本次代码。',retryLabel:'重试运行'});
    try{
      let job=await request('/executions',{method:'POST',headers:headers(),body:JSON.stringify({language:id,code,stdin:id==='sql'?'':$('lab-stdin').value})});
      if(gen!==generation){await request('/executions/'+job.id,{method:'DELETE',headers:headers()});return}
      active.id=job.id;
      const deadline=Date.now()+90000;
      while(!terminal.has(job.state)){
        if(gen!==generation)return;
        if(Date.now()>deadline)throw new Error('等待远端结果超时。');
        $('lab-result').textContent=job.state==='queued'?'任务正在排队…':job.state==='compiling'?'正在远端编译…':'正在远端执行…';
        status?.update(id,'remote',{stage:job.state==='queued'?'queued':job.state==='compiling'?'compiling':'running',detail:job.state==='queued'?'等待服务器执行名额。':job.state==='compiling'?'正在受限环境中编译；成功后才执行。':'代码正在远端独立环境中执行。'});
        await new Promise(resolve=>setTimeout(resolve,250));
        if(gen!==generation)return;
        job=await readJob(job.id,gen);
        if(!job)return;
      }
      if(gen!==generation)return;
      const reasons={compile_error:'编译失败，未执行程序。',compile_timed_out:'编译超过时间预算，未执行程序。',timed_out:'运行超过时间预算，已停止。',output_limit:'编译与运行输出超过32 KiB，已停止。',memory_limit:'达到内存上限，已停止。',cancelled:'任务已取消。',infrastructure_error:'远端执行环境不可用。'};
      $('lab-result').textContent=(job.stdout||'')+(job.stderr?'\n'+job.stderr:'')+(reasons[job.state]?'\n'+reasons[job.state]:'')||'（程序没有输出）';
      const diagnostic=(job.compilerStdout||'')+(job.compilerStderr?'\n'+job.compilerStderr:'');
      if($('lab-compiler')){
        $('lab-compiler').hidden=job.compileMs===undefined&&!diagnostic;
        $('lab-compiler').open=!!diagnostic;
        $('lab-compiler-result').textContent=diagnostic||'编译成功，无诊断输出。';
      }
      if($('lab-timings')){
        const timing=[['排队',job.queueMs],['编译',job.compileMs],[simulation(id)?'仿真':'运行',job.runMs],['环境与执行',job.elapsedMs]];
        $('lab-timings').textContent=timing.filter(([,v])=>Number.isFinite(v)).map(([label,v])=>label+' '+v+' ms').join(' · ');
        $('lab-timings').hidden=!$('lab-timings').textContent;
        $('lab-timings').title='排队不计入环境与执行；环境与执行还包含容器准备、代码传入等开销。';
      }
      $('lab-result').dataset.state=job.state==='completed'?'ok':'error';
      active=null;render();
      status?.update(id,'remote',{stage:job.state==='completed'?'completed':job.state==='cancelled'?'cancelled':'failed',detail:job.state==='completed'?(simulation(id)?'仿真完成 · ':'执行完成 · ')+(job.elapsedMs??'?')+' ms':reasons[job.state]||'代码执行失败，请查看运行结果。',version:shortVersion(job.runtimeVersion||id),retryLabel:'重试运行'});
      $('lab-runtime-note').textContent='远端实际结果 · '+shortVersion(job.runtimeVersion||id)+(job.compileMs!==undefined?' · 编译 '+job.compileMs+' ms':'')+(job.runMs!==undefined?(simulation(id)?' · 仿真 ':' · 运行 ')+job.runMs+' ms':'')+' · 总计 '+(job.elapsedMs??'?')+' ms · '+job.state;
    }catch(error){
      if(gen!==generation)return;
      cancel();$('lab-result').textContent=error.message+' 不会自动切换执行位置。';$('lab-result').dataset.state='error';
      status?.update(id,'remote',{stage:'failed',detail:error.message,retryLabel:'重试运行'});
    }
  }
  function show(id){
    cancel(false,false);current=id;render();
    if(handles(id)&&!allowed(id)){$('lab-result').textContent=mode(id)==='remote'?'点击运行后才提交代码。':'选择下载并启用本地环境后运行。';$('lab-result').dataset.state='';}
  }
  function useLocal(id=current){
    if(!local.has(id))return;
    consent.add(id);modes.set(id,'local');
    if(id===current){cancel();callbacks.stop?.();render();callbacks.run?.();}
  }
  $('lab-execution-mode').onchange=()=>{
    const nextMode=$('lab-execution-mode').value;
    cancel();callbacks.stop?.();modes.set(current,nextMode);render();
    if(allowed(current))status?.update(current,'local',{stage:'idle',detail:'本地执行已启用，点击运行会准备环境。'});
    $('lab-result').textContent=allowed(current)?'点击运行代码，在浏览器本地执行。':mode(current)==='remote'?'点击运行后才提交代码。':'点击下载并启用本地环境。';$('lab-result').dataset.state='';
  };
  $('lab-enable-local').onclick=()=>useLocal();
  $('lab-cancel-remote').onclick=()=>cancel(true);
  async function connect(){
    const gen=++connectionGeneration;
    for(const id of remoteIds)status?.update(id,'remote',{stage:'connecting',detail:'正在检查执行服务。',retryLabel:'重新连接'});
    try{
      const data=await request('/runtimes');
      if(gen!==connectionGeneration)return;
      if(!Array.isArray(data.runtimes))throw new Error('执行服务的运行时列表无效。');
      capabilities=data;
      for(const id of remoteIds){
        const record=data.runtimes.find(r=>r.id===id);
        status?.update(id,'remote',{stage:remoteAvailable(id)?'ready':'failed',detail:remoteAvailable(id)?'服务可用；点击运行才上传代码，繁忙时请稍后重试。':guestEnabled()?'执行服务当前不可用，可重新连接。':'远端执行暂未开放。',version:record?shortVersion(record.version):'运行时待连接',retryLabel:'重新连接'});
      }
    }catch(error){
      if(gen!==connectionGeneration)return;
      capabilities=null;
      for(const id of remoteIds)status?.update(id,'remote',{stage:'failed',detail:error.message,retryLabel:'重新连接'});
    }
    render();
  }
  window.MUSEUM_EXECUTION={handles,allowed,mode,localSupported:id=>local.has(id),
    chooseLocal(){if(!local.has(current))return;cancel();callbacks.stop?.();modes.set(current,'local');render();$('lab-result').textContent=allowed(current)?'点击运行代码，在浏览器本地执行。':'点击下载并启用本地环境；不会上传代码。';$('lab-result').dataset.state='';},serviceStatus:()=>request('/runtimes'),run,show,render,cancel,useLocal,configure:value=>{callbacks=value},canRun:id=>remoteAvailable(id),retry:(id,code)=>remoteAvailable(id)?run(id,code):connect(),edited(){cancel();if(remoteAvailable(current))status?.update(current,'remote',{stage:'idle',detail:'代码已修改，点击运行后执行。'});$('lab-result').textContent='代码已修改；点击运行后执行。';$('lab-result').dataset.state='';}};
  connect();
})();
