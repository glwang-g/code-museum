(()=>{
  const config=window.MUSEUM_EXECUTION_CONFIG;if(!config?.enabled)return;
  const $=id=>document.getElementById(id),local=new Map([['python','Python · Pyodide，约13.53 MB未压缩'],['lua','Lua · Wasmoon，约413 KiB未压缩'],['scheme','Scheme · BiwaScheme，约244 KiB，非Wasm']]);
  const remoteIds=new Set(['python','ruby']),modes=new Map(),consent=new Set();
  const terminal=new Set(['completed','failed','timed_out','cancelled','output_limit','memory_limit','infrastructure_error']);
  const session=crypto.randomUUID().replaceAll('-','');
  let current=null,capabilities=null,callbacks={},generation=0,active=null;
  const endpoint=config.endpoint;
  if(endpoint!=='/api')throw new Error('Executor must use the same-origin /api endpoint');
  const shortVersion=value=>String(value).match(/(?:Python|ruby)\s+[\d.]+/i)?.[0].replace(/^ruby/i,'Ruby')||String(value);
  const mode=id=>modes.get(id)||(remoteIds.has(id)?'remote':'local');
  const handles=id=>local.has(id)||remoteIds.has(id);
  const allowed=id=>mode(id)==='local'&&consent.has(id)&&local.has(id);
  const remoteAvailable=id=>!!capabilities?.available&&capabilities.runtimes.some(r=>r.id===id);
  function headers(token){return {'Content-Type':'application/json','Authorization':'Bearer '+token,'X-Execution-Session':session};}
  async function request(path,options={}){
    const response=await fetch(endpoint+path,{...options,cache:'no-store',signal:AbortSignal.timeout(6000)});
    let data;try{data=await response.json()}catch{throw new Error('远端服务尚未连接或响应无效。')}
    if(!response.ok)throw new Error(response.status===401?'私有执行令牌无效。':response.status===429?'执行配额或队列已满，请稍后重试。':data.error||'远端执行请求失败。');
    return data;
  }
  function render(){
    const on=handles(current);$('lab-execution-controls').hidden=!on;
    if(!on)return;
    const isRemote=mode(current)==='remote';
    $('lab-execution-mode').value=mode(current);
    $('lab-execution-mode').querySelector('[value="remote"]').disabled=!remoteIds.has(current);
    $('lab-execution-mode').querySelector('[value="local"]').disabled=!local.has(current);
    $('lab-remote-access').hidden=!isRemote;
    $('lab-enable-local').hidden=isRemote||allowed(current)||!local.has(current);
    $('lab-enable-local').textContent=local.get(current)+' · 下载并启用';
    $('lab-cancel-remote').hidden=!active||!isRemote;
    $('lab-run').disabled=isRemote?!remoteAvailable(current)||!!active:!allowed(current);
    const record=capabilities?.runtimes.find(r=>r.id===current);
    $('lab-execution-info').textContent=isRemote?(record?'远端 '+shortVersion(record.version)+' · 私有试用 · 点击运行才上传代码':'远端执行服务尚未连接；不会下载本地运行时。'):(allowed(current)?'浏览器本地执行；代码不会发送到执行服务器。':'本地环境尚未启用，点击下载后才加载。');
    if(isRemote){
      $('lab-status').textContent='远端执行 · 代码只在点击“运行代码”时上传。';
      $('lab-runtime-note').textContent='3秒上限、禁网、独立Docker环境；不自动安装第三方包。';
      $('lab-runtime-credit').hidden=!record;
      $('lab-runtime-credit').textContent='Docker 官方镜像 · 项目与许可 ↗';
      $('lab-runtime-credit').onclick=()=>{if(record)window.open(record.source,'_blank','noopener,noreferrer')};
    }else{
      const label=window.MUSEUM_CREDITS_UI?.labelFor(current);
      $('lab-runtime-credit').hidden=!label;
      $('lab-runtime-credit').textContent=label||'';
      $('lab-runtime-credit').onclick=()=>window.MUSEUM_CREDITS_UI?.openFor(current);
      $('lab-status').textContent='浏览器本地执行 · 启用后，编辑会自动更新结果。';
      $('lab-runtime-note').textContent=allowed(current)?'浏览器本地执行，不上传代码。':'尚未下载或初始化本地运行环境。';
    }
  }
  function cancel(message=false){
    generation++;
    const job=active;active=null;
    if(job?.id)request('/executions/'+job.id,{method:'DELETE',headers:headers(job.token)}).catch(()=>{});
    if(message){$('lab-result').textContent='任务已取消；正在请求服务器停止。';$('lab-result').dataset.state='';}
    render();
  }
  async function run(id,code){
    if(!remoteIds.has(id)||mode(id)!=='remote')return;
    cancel();const gen=generation,token=$('lab-remote-token').value;
    if(token.length<32){$('lab-result').textContent='请输入私有执行令牌；令牌只保存在当前页面内存中。';$('lab-result').dataset.state='error';return}
    active={id:null,token};render();$('lab-result').textContent='正在提交远端任务…';$('lab-result').dataset.state='';
    try{
      let job=await request('/executions',{method:'POST',headers:headers(token),body:JSON.stringify({language:id,code,stdin:$('lab-stdin').value})});
      if(gen!==generation){await request('/executions/'+job.id,{method:'DELETE',headers:headers(token)});return}
      active.id=job.id;
      const deadline=Date.now()+45000;
      while(!terminal.has(job.state)){
        if(gen!==generation)return;
        if(Date.now()>deadline)throw new Error('等待远端结果超时。');
        $('lab-result').textContent=job.state==='queued'?'任务正在排队…':'正在远端执行…';
        await new Promise(resolve=>setTimeout(resolve,250));
        if(gen!==generation)return;
        job=await request('/executions/'+job.id,{headers:headers(token)});
      }
      if(gen!==generation)return;
      const reasons={timed_out:'运行超过3秒，已停止。',output_limit:'输出超过32 KiB，已停止。',memory_limit:'达到内存上限，已停止。',cancelled:'任务已取消。',infrastructure_error:'远端执行环境不可用。'};
      $('lab-result').textContent=(job.stdout||'')+(job.stderr?'\n'+job.stderr:'')+(reasons[job.state]?'\n'+reasons[job.state]:'')||'（程序没有输出）';
      $('lab-result').dataset.state=job.state==='completed'?'ok':'error';
      active=null;render();
      $('lab-runtime-note').textContent='远端实际结果 · '+shortVersion(job.runtimeVersion||id)+' · '+(job.elapsedMs??'?')+' ms · '+job.state;
    }catch(error){
      if(gen!==generation)return;
      cancel();$('lab-result').textContent=error.message+' 不会自动切换执行位置。';$('lab-result').dataset.state='error';
    }
  }
  function show(id){
    current=id;cancel();
    if(handles(id)&&!allowed(id)){$('lab-result').textContent=mode(id)==='remote'?'点击运行后才提交代码。':'选择下载并启用本地环境后运行。';$('lab-result').dataset.state='';}
  }
  function useLocal(id=current){
    if(!local.has(id))return;
    consent.add(id);modes.set(id,'local');
    if(id===current){cancel();callbacks.stop?.();render();callbacks.run?.();}
  }
  $('lab-execution-mode').onchange=()=>{
    cancel();callbacks.stop?.();modes.set(current,$('lab-execution-mode').value);render();
    $('lab-result').textContent=allowed(current)?'点击运行代码，在浏览器本地执行。':mode(current)==='remote'?'点击运行后才提交代码。':'点击下载并启用本地环境。';$('lab-result').dataset.state='';
  };
  $('lab-enable-local').onclick=()=>useLocal();
  $('lab-cancel-remote').onclick=()=>cancel(true);
  window.MUSEUM_EXECUTION={handles,allowed,run,show,render,cancel,useLocal,configure:value=>{callbacks=value},canRun:id=>remoteAvailable(id),edited(){cancel();$('lab-result').textContent='代码已修改；点击运行后执行。';$('lab-result').dataset.state='';}};
  request('/runtimes').then(data=>{if(!Array.isArray(data.runtimes))throw new Error('Invalid runtime list');capabilities=data;render()}).catch(()=>{capabilities=null;render()});
})();
