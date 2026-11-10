(() => {
  const lab=window.MUSEUM_LAB,$=id=>document.getElementById(id);
  if(!lab||!window.MUSEUM_LAB_EXPLANATIONS)return;
  const entries=new Map(window.MUSEUM_LAB_EXPLANATIONS.entries.map(row=>[row.language+':'+row.topic,row]));
  const panel=$('lab-explanation'),body=$('lab-explanation-content'),toggle=$('lab-explanation-toggle'),editor=$('lab-code'),action=$('lab-explain-current');
  const cache=new Map(),errors=new Map(),key=()=>lab.current+'\0'+lab.code;
  let selected=null,lastKey=null,displayed=null,pending=null;
  function valid(value,code){
    const text=(v,max)=>typeof v==='string'&&v.trim()&&v.length<=max;
    return value&&text(value.overview,600)&&text(value.stdin,400)&&Array.isArray(value.steps)&&value.steps.length>=1&&value.steps.length<=8&&value.steps.every(s=>s&&Number.isInteger(s.from)&&Number.isInteger(s.to)&&s.from>=1&&s.to>=s.from&&s.to<=code.split('\n').length&&text(s.title,80)&&text(s.detail,500));
  }
  function bounded(map,k,value,max){map.delete(k);map.set(k,value);while(map.size>max)map.delete(map.keys().next().value)}
  function select(step,button){
    if(!displayed||displayed.key!==key())return;
    const lines=editor.value.split('\n'),start=lines.slice(0,step.from-1).reduce((n,line)=>n+line.length+1,0),end=lines.slice(0,step.to).join('\n').length;
    editor.focus({preventScroll:true});editor.setSelectionRange(start,end);
    editor.scrollTop=Math.max(0,(step.from-1)*parseFloat(getComputedStyle(editor).lineHeight)-12);
    editor.scrollLeft=0;
    editor.dispatchEvent(new Event('scroll'));
    editor.scrollIntoView({block:'nearest',inline:'nearest'});
    selected?.setAttribute('aria-pressed','false');button.setAttribute('aria-pressed','true');selected=button;
    $('lab-explanation-status').textContent='已定位第'+step.from+(step.to===step.from?'':'–'+step.to)+'行；仅选择代码。';
  }
  function render(force=false){
    const snapshot=key(),original=entries.get(lab.current+':'+lab.topic),ai=cache.get(snapshot),matched=!!original&&lab.code===original.code,entry=ai?.explanation||(matched?original:null);
    const state=ai?'ai':matched?'matched':original?'modified':'unavailable',busy=pending?.key===snapshot;
    const invalid=!lab.code.trim()||new TextEncoder().encode(lab.code).length>24576||lab.code.split('\n').length>400;
    action.disabled=!!pending||!!ai||invalid;action.textContent=busy?'正在讲解…':pending?'等待上次讲解…':ai?'当前讲解已就绪':'讲解当前代码';
    panel.setAttribute('aria-busy',String(!!busy));
    const status=busy?'正在分析当前代码，完成后显示讲解。':errors.get(snapshot)|| (ai?'DeepSeek · '+(ai.cached?'已复用讲解':'当前代码讲解')+' · 点击行号定位':matched?'馆内示例 · 点击行号定位代码':invalid?'一次最多讲解24KB、400行非空代码。':'点击按钮，为当前代码生成讲解。');
    $('lab-explanation-status').textContent=status;
    const signature=snapshot+'\0'+state+'\0'+String(!!busy);
    if(!force&&lastKey===signature)return;
    lastKey=signature;selected=null;displayed=entry?{key:snapshot}:null;body.replaceChildren();panel.dataset.state=state;
    const paragraph=text=>{const p=document.createElement('p');p.textContent=text;body.append(p);return p};
    if(!entry){paragraph(original?'当前代码与馆内示例不同，原讲解已暂停。点击“讲解当前代码”，即可为改写后的代码生成讲解。':'这门语言尚无对应的馆内示例讲解，可点击“讲解当前代码”分析编辑器中的内容。');return}
    paragraph(entry.overview).className='lab-explanation-overview';
    const input=paragraph(entry.stdin);input.className='lab-explanation-input';
    const list=document.createElement('ol');list.className='lab-explanation-steps';
    for(const step of entry.steps){
      const item=document.createElement('li'),button=document.createElement('button'),detail=document.createElement('p');
      button.type='button';button.textContent='第'+step.from+(step.to===step.from?'':'–'+step.to)+'行 · '+step.title;button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>select(step,button));
      detail.textContent=step.detail;item.append(button,detail);list.append(item);
    }
    body.append(list);paragraph(ai?'AI讲解可能有误；实际输出与错误请查看运行结果。':'讲解说明原示例的逻辑；实际输出与错误请查看运行结果。').className='lab-explanation-footnote';
  }
  action.addEventListener('click',async()=>{
    const snapshot=key(),code=lab.code,language=lab.current;
    if(pending||cache.has(snapshot)||!code.trim()||new TextEncoder().encode(code).length>24576||code.split('\n').length>400)return;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),40000);
    pending={key:snapshot};errors.delete(snapshot);render(true);
    try{
      const response=await fetch('/api/explanations',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',body:JSON.stringify({language,code}),signal:controller.signal});
      const raw=await response.text();if(raw.length>65536)throw new Error('讲解内容过大，请稍后重试。');
      let data;try{data=JSON.parse(raw)}catch{throw new Error('讲解服务暂不可用，请稍后点击重试。')}
      if(!response.ok)throw new Error(typeof data.error==='string'&&data.error.length<=200?data.error:'讲解服务暂不可用，请稍后点击重试。');
      if(!valid(data.explanation,code))throw new Error('这次讲解格式不完整，请点击重试。');
      bounded(cache,snapshot,{explanation:data.explanation,cached:!!data.cached},16);
    }catch(error){bounded(errors,snapshot,error.name==='AbortError'?'等待讲解超时，可稍后点击重试。':error.message||'讲解请求未完成，请稍后点击重试。',16)}
    finally{clearTimeout(timer);pending=null;render(true)}
  });
  toggle.addEventListener('click',()=>{const visible=panel.hidden;panel.hidden=!visible;toggle.setAttribute('aria-expanded',String(visible));toggle.textContent=visible?'隐藏讲解':'显示讲解';$('lab').classList.toggle('lab-without-explanation',!visible)});
  document.addEventListener('museum-lab-change',()=>render());
  render();
})();
