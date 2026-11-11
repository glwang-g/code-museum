(()=>{
  const $=id=>document.getElementById(id),execution=window.MUSEUM_EXECUTION;
  if(!execution)return;
  let generation=0;
  function clear(){generation++;$('lab-service-metrics').replaceChildren();$('lab-service-summary').textContent='点击刷新查看运行环境是否可用。';}
  async function refresh(){
    const gen=++generation;
    $('lab-service-summary').textContent='正在读取服务状态…';$('lab-service-metrics').replaceChildren();
    try{
      const data=await execution.serviceStatus();if(gen!==generation)return;
      const guest=data.private===false&&data.access?.mode==='guest';
      $('lab-service-summary').textContent=!guest?'远端执行暂未开放。':(data.available?(data.complete===false?'部分运行环境可用':'服务可用'):'服务暂停')+' · '+data.runtimes.length+'个运行环境 · 最多'+data.access.maxSessions+'个活跃会话';
      const note=document.createElement('p');
      note.textContent=(data.complete===false?'部分运行环境暂不可达，仅列出当前可达环境。':'')+'此处只检查运行环境是否可用；当前访问比较多时，请稍后重试。';
      $('lab-service-metrics').append(note);
    }catch(error){if(gen===generation)$('lab-service-summary').textContent=error.message||'服务状态暂不可用。';}
  }
  $('lab-service-refresh').onclick=refresh;
  document.addEventListener('museum-lab-change',clear);
})();
