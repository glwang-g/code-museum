(()=>{
  const $=id=>document.getElementById(id),execution=window.MUSEUM_EXECUTION;
  if(!execution)return;
  const states={completed:'执行完成',failed:'程序错误',compile_error:'编译错误',compile_timed_out:'编译超时',timed_out:'运行超时',cancelled:'取消',output_limit:'输出上限',memory_limit:'内存上限',infrastructure_error:'环境故障'};
  let generation=0;
  function clear(){generation++;$('lab-service-metrics').replaceChildren();$('lab-service-summary').textContent='输入执行令牌后，点击刷新查看。';}
  async function refresh(){
    const gen=++generation;
    $('lab-service-summary').textContent='正在读取服务状态…';$('lab-service-metrics').replaceChildren();
    try{
      const data=await execution.serviceStatus();if(gen!==generation)return;
      const metrics=data.metrics;
      $('lab-service-summary').textContent=(data.available?'服务可用':'服务暂停')+' · 排队 '+data.queue+' · 执行中 '+data.active+' · 本次服务已运行 '+data.uptimeSeconds+' 秒 · 读取于 '+new Date(data.checkedAt).toLocaleTimeString('zh-CN');
      const container=$('lab-service-metrics'),counts=document.createElement('p');
      counts.textContent=Object.entries(states).map(([key,label])=>label+' '+(metrics.states[key]??0)).join(' · ');container.append(counts);
      const times=document.createElement('p');times.textContent=Object.entries({queue:'排队',compile:'编译',run:'运行'}).map(([key,label])=>label+'均值 '+(metrics.timings[key].meanMs===null?'暂无样本':metrics.timings[key].meanMs+' ms（'+metrics.timings[key].samples+' 次）')).join(' · ');container.append(times);
      const note=document.createElement('p');note.textContent=(metrics.persistent?'汇总自 ':'本次进程汇总自 ')+new Date(metrics.startedAt).toLocaleString('zh-CN')+'；仅统计进入终态的任务，代码错误不等于服务故障。不保存代码、输入或输出。'+(metrics.missedRecordsSinceRestart?' 有 '+metrics.missedRecordsSinceRestart+' 次记录失败，数据不完整。':'');container.append(note);
    }catch(error){if(gen===generation)$('lab-service-summary').textContent=error.message||'服务状态暂不可用。';}
  }
  $('lab-service-refresh').onclick=refresh;
  $('lab-remote-token').addEventListener('input',clear);
  document.addEventListener('museum-lab-change',clear);
})();
