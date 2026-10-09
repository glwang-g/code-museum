(() => {
  const $=id=>document.getElementById(id),states=new Map();
  const labels={'not-enabled':'未启用',connecting:'连接中','waiting-token':'等待令牌',idle:'待运行',downloading:'读取资源',initializing:'初始化中',ready:'可运行',submitting:'提交中',queued:'排队中',running:'执行中',completed:'执行完成',failed:'失败',paused:'已暂停',cancelled:'已取消',unsupported:'未接入'};
  const busy=new Set(['connecting','downloading','initializing','submitting','queued','running']);
  let current=null,location='local',retry=null;
  const key=(id,mode)=>id+':'+mode;
  const bytes=value=>value<1024*1024?(value/1024).toFixed(0)+' KiB':(value/(1024*1024)).toFixed(2)+' MiB';
  function render(){
    const state=states.get(key(current,location))||{stage:'idle'};
    const root=$('lab-runtime-state');if(!root)return;
    root.dataset.stage=state.stage;
    $('lab-state-label').textContent=labels[state.stage]||state.stage;
    const meta=window.MUSEUM_RUNTIME_ASSETS?.[current];
    $('lab-state-version').textContent=(location==='remote'?'远端 · ':'本地 · ')+(state.version||(location==='remote'?'运行时待连接':meta?.version||(current==='javascript'?'浏览器 JavaScript':'运行环境未接入')));
    const counted=state.stage==='downloading'&&Number.isFinite(state.total)&&state.total>0;
    $('lab-state-detail').textContent=(state.detail||'')+(counted?' · '+bytes(Math.min(state.loaded||0,state.total))+' / '+bytes(state.total)+'（核心资源，解压后）':'');
    const progress=$('lab-state-progress');
    progress.hidden=!busy.has(state.stage);
    if(counted){progress.max=state.total;progress.value=Math.min(state.loaded||0,state.total)}else progress.removeAttribute('value');
    $('lab-runtime-retry').hidden=state.stage!=='failed';
    $('lab-runtime-retry').textContent=state.retryLabel||(location==='remote'?'重试':'重新加载并运行');
  }
  function select(id,mode){current=id;location=mode;render()}
  function update(id,mode,value){states.set(key(id,mode),{...states.get(key(id,mode)),...value});if(id===current&&mode===location)render()}
  $('lab-runtime-retry').onclick=()=>retry?.(current,location);
  window.MUSEUM_RUNTIME_STATUS={select,update,get:(id,mode)=>states.get(key(id,mode)),configure:callback=>{retry=callback}};
})();
