(() => {
  const lab=window.MUSEUM_LAB,$=id=>document.getElementById(id);
  if(!lab||!window.MUSEUM_LAB_EXPLANATIONS)return;
  const entries=new Map(window.MUSEUM_LAB_EXPLANATIONS.entries.map(row=>[row.language+':'+row.topic,row]));
  const panel=$('lab-explanation'),body=$('lab-explanation-content'),toggle=$('lab-explanation-toggle'),editor=$('lab-code'),action=$('lab-explain-current'),intent=$('lab-code-intent');
  const cache=new Map(),errors=new Map(),intents=new Map(),key=()=>JSON.stringify([lab.current,lab.code,intent.value.trim()]);
  let selected=null,lastKey=null,displayed=null,pending=null,lastLanguage=lab.current;
  function valid(value,code){
    const text=(v,max)=>typeof v==='string'&&v.trim()&&v.length<=max;
    const range=s=>s&&Number.isInteger(s.from)&&Number.isInteger(s.to)&&s.from>=1&&s.to>=s.from&&s.to<=code.split('\n').length;
    const review=value?.review;
    if(!value||!text(value.overview,600)||!text(value.stdin,400)||!review||!['ok','issues','uncertain'].includes(review.verdict)||!text(review.summary,600)||!text(review.intent,600)||!Array.isArray(review.issues)||review.issues.length>6||!Array.isArray(value.steps))return false;
    if(review.verdict==='ok'?(review.issues.length||value.steps.length<1||value.steps.length>8):(value.steps.length||review.verdict==='issues'&&!review.issues.length))return false;
    if(!value.steps.every(s=>range(s)&&text(s.title,80)&&text(s.detail,500)))return false;
    let end=0,bytes=0;
    for(const s of review.issues){
      if(!range(s)||s.from<=end||!text(s.title,80)||!text(s.detail,500)||!text(s.suggestion,500))return false;end=s.to;
      if(s.replacement!==null){if(typeof s.replacement!=='string'||review.verdict!=='issues')return false;const size=new TextEncoder().encode(s.replacement).length;bytes+=size;if(size>4096||bytes>8192)return false}
    }
    if(review.verdict==='issues'&&review.issues.every(s=>s.replacement!==null)){
      const lines=code.split('\n');for(const s of [...review.issues].reverse())lines.splice(s.from-1,s.to-s.from+1,...(s.replacement?s.replacement.split('\n'):[]));
      const candidate=lines.join('\n');return candidate!==code&&candidate.trim()&&new TextEncoder().encode(candidate).length<=24576&&lines.length<=400&&value.correction===candidate;
    }
    return value.correction===null;
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
    if(lastLanguage!==lab.current){intents.set(lastLanguage,intent.value);intent.value=intents.get(lab.current)||'';lastLanguage=lab.current}
    const snapshot=key(),original=entries.get(lab.current+':'+lab.topic),ai=cache.get(snapshot),matched=!!original&&lab.code===original.code,entry=ai?.explanation||(matched?original:null);
    const review=ai?.explanation.review,state=ai?(review.verdict==='ok'?'ai':review.verdict):matched?'matched':original?'modified':'unavailable',busy=pending?.key===snapshot;
    const invalid=!lab.code.trim()||new TextEncoder().encode(lab.code).length>24576||lab.code.split('\n').length>400||intent.value.length>600;
    action.disabled=!!pending||!!ai||invalid;action.textContent=busy?'正在检查…':pending?'等待上次检查…':ai?'本次检查已就绪':'检查并讲解当前代码';
    panel.setAttribute('aria-busy',String(!!busy));
    const status=busy?'正在检查当前代码及预期行为。':errors.get(snapshot)|| (ai?'大模型检查 · '+(review.verdict==='ok'?'未发现明显问题':review.verdict==='issues'?'发现问题':'需确认预期')+(ai.cached?' · 已复用':''):matched?'馆内示例讲解 · 尚未进行模型检查':invalid?'最多24KB、400行代码；预期行为最多600字。':'点击按钮，先检查，再讲解或给出纠错建议。');
    $('lab-explanation-status').textContent=status;
    const signature=snapshot+'\0'+lab.topic+'\0'+state+'\0'+String(!!busy);
    if(!force&&lastKey===signature)return;
    lastKey=signature;selected=null;displayed=entry?{key:snapshot}:null;body.replaceChildren();panel.dataset.state=state;
    const paragraph=text=>{const p=document.createElement('p');p.textContent=text;body.append(p);return p};
    if(!entry){paragraph(original?'当前代码与馆内示例不同，原讲解已暂停。点击“检查并讲解当前代码”，可检查问题并获得讲解或纠错建议。':'这门语言尚无对应的馆内示例讲解，可点击“检查并讲解当前代码”分析编辑器中的内容。');return}
    if(review){
      const heading=document.createElement('h4');heading.className='lab-review-heading';heading.textContent=review.verdict==='ok'?'未发现明显问题':review.verdict==='issues'?'发现需要修正的问题':'需要确认预期或上下文';body.append(heading);
      paragraph(review.summary).className='lab-review-summary';paragraph('理解的原意：'+review.intent).className='lab-explanation-input';
      if(review.verdict!=='ok'){
        const list=document.createElement('ol');list.className='lab-explanation-steps lab-review-issues';
        for(const issue of review.issues){
          const item=document.createElement('li'),button=document.createElement('button'),detail=document.createElement('p'),suggestion=document.createElement('p');
          button.type='button';button.textContent='第'+issue.from+(issue.to===issue.from?'':'–'+issue.to)+'行 · '+issue.title;button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>select(issue,button));
          detail.textContent=issue.detail;suggestion.textContent='改进建议：'+issue.suggestion;item.append(button,detail,suggestion);list.append(item);
        }
        body.append(list);
        if(entry.correction!==null){
          const box=document.createElement('details'),summary=document.createElement('summary'),note=document.createElement('p'),copy=document.createElement('button'),pre=document.createElement('pre'),code=document.createElement('code');
          box.className='lab-review-correction';summary.textContent='建议修正版（未运行）';note.textContent='仅替换指出的问题行，请核对是否符合你的原意。';copy.type='button';copy.textContent='复制建议代码';code.textContent=entry.correction;
          copy.addEventListener('click',async()=>{if(displayed?.key!==key())return;try{await window.navigator.clipboard.writeText(entry.correction);$('lab-explanation-status').textContent='已复制建议代码，可在编辑器中对照修改。'}catch{$('lab-explanation-status').textContent='请选中下方建议代码并手动复制。'}});
          pre.append(code);box.append(summary,note,copy,pre);body.append(box);
        }
        paragraph('模型仅作静态检查，建议可能有误；请按预期核对，并运行代码验证。').className='lab-explanation-footnote';return;
      }
    }
    paragraph(entry.overview).className='lab-explanation-overview';
    const input=paragraph(entry.stdin);input.className='lab-explanation-input';
    const list=document.createElement('ol');list.className='lab-explanation-steps';
    for(const step of entry.steps){
      const item=document.createElement('li'),button=document.createElement('button'),detail=document.createElement('p');
      button.type='button';button.textContent='第'+step.from+(step.to===step.from?'':'–'+step.to)+'行 · '+step.title;button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>select(step,button));
      detail.textContent=step.detail;item.append(button,detail);list.append(item);
    }
    body.append(list);paragraph(ai?'模型未发现明显问题，不代表正确性保证；实际结果请运行代码核对。':'讲解说明原示例的逻辑；实际输出与错误请查看运行结果。').className='lab-explanation-footnote';
  }
  action.addEventListener('click',async()=>{
    const snapshot=key(),code=lab.code,language=lab.current,expected=intent.value.trim();
    if(pending||cache.has(snapshot)||!code.trim()||new TextEncoder().encode(code).length>24576||code.split('\n').length>400||intent.value.length>600)return;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),40000);
    pending={key:snapshot};errors.delete(snapshot);render(true);
    try{
      const response=await fetch('/api/explanations',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',body:JSON.stringify({language,code,intent:expected}),signal:controller.signal});
      const raw=await response.text();if(raw.length>65536)throw new Error('讲解内容过大，请稍后重试。');
      let data;try{data=JSON.parse(raw)}catch{throw new Error('讲解服务暂不可用，请稍后点击重试。')}
      if(!response.ok)throw new Error(typeof data.error==='string'&&data.error.length<=200?data.error:'讲解服务暂不可用，请稍后点击重试。');
      if(!valid(data.explanation,code))throw new Error('这次检查结果不完整，请点击重试。');
      bounded(cache,snapshot,{explanation:data.explanation,cached:!!data.cached},16);
    }catch(error){bounded(errors,snapshot,error.name==='AbortError'?'等待讲解超时，可稍后点击重试。':error.message||'讲解请求未完成，请稍后点击重试。',16)}
    finally{clearTimeout(timer);pending=null;render(true)}
  });
  intent.addEventListener('input',()=>render());
  toggle.addEventListener('click',()=>{const visible=panel.hidden;panel.hidden=!visible;toggle.setAttribute('aria-expanded',String(visible));toggle.textContent=visible?'隐藏讲解':'显示讲解';$('lab').classList.toggle('lab-without-explanation',!visible)});
  document.addEventListener('museum-lab-change',()=>render());
  render();
})();
