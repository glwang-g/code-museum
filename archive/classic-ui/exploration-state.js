(function(root){
  function neighborhood(edges,id,direction='both',levels=1){
    const nodes=new Set([id]);let frontier=new Set([id]);
    for(let level=0;level<levels&&frontier.size;level++){
      const next=new Set();
      for(const e of edges){
        if(direction!=='up'&&frontier.has(e.from)&&!nodes.has(e.to))next.add(e.to);
        if(direction!=='down'&&frontier.has(e.to)&&!nodes.has(e.from))next.add(e.from);
      }
      for(const node of next)nodes.add(node);frontier=next;
    }
    return {nodes,edges:edges.filter(e=>nodes.has(e.from)&&nodes.has(e.to))};
  }
  function feedback(output,state,expected){
    if(state==='error')return {status:'error',text:'执行错误或超时；请先查看真实运行诊断。'};
    if(state!=='ok')return {status:'pending',text:'等待本次运行完成。'};
    const actual=String(output).replace(/\r\n/g,'\n').trim(),target=String(expected).trim();
    return actual===target?{status:'matched',text:'本次输出与练习预期一致。'}:{status:'different',text:'本次输出与预期不同。预期：'+target+'；实际：'+(actual||'（无输出）')};
  }
  const api={neighborhood,feedback};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MUSEUM_EXPLORATION=api;
})(typeof window!=='undefined'?window:globalThis);
