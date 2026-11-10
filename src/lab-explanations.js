(() => {
  const lab=window.MUSEUM_LAB,$=id=>document.getElementById(id);
  if(!lab||!window.MUSEUM_LAB_EXPLANATIONS)return;
  const entries=new Map(window.MUSEUM_LAB_EXPLANATIONS.entries.map(row=>[row.language+':'+row.topic,row]));
  const panel=$('lab-explanation'),body=$('lab-explanation-content'),toggle=$('lab-explanation-toggle'),editor=$('lab-code');
  let selected=null,lastKey=null;
  function select(step,button){
    const entry=entries.get(lab.current+':'+lab.topic);
    if(!entry||lab.code!==entry.code)return;
    const lines=editor.value.split('\n'),start=lines.slice(0,step.from-1).reduce((n,line)=>n+line.length+1,0),end=lines.slice(0,step.to).join('\n').length;
    editor.focus({preventScroll:true});editor.setSelectionRange(start,end);
    editor.scrollTop=Math.max(0,(step.from-1)*parseFloat(getComputedStyle(editor).lineHeight)-12);
    editor.scrollLeft=0;
    editor.dispatchEvent(new Event('scroll'));
    editor.scrollIntoView({block:'nearest',inline:'nearest'});
    selected?.setAttribute('aria-pressed','false');button.setAttribute('aria-pressed','true');selected=button;
    $('lab-explanation-status').textContent='已定位第'+step.from+(step.to===step.from?'':'–'+step.to)+'行；仅选择代码。';
  }
  function render(){
    const key=lab.current+':'+lab.topic,entry=entries.get(key),matched=!!entry&&lab.code===entry.code;
    const state=matched?'matched':entry?'modified':'unavailable';
    if(lastKey===key+':'+state)return;
    lastKey=key+':'+state;selected=null;body.replaceChildren();panel.dataset.state=state;
    $('lab-explanation-status').textContent=matched?'馆内示例 · 点击行号定位代码':entry?'代码已修改，讲解需重新匹配':'暂无对应讲解';
    const paragraph=text=>{const p=document.createElement('p');p.textContent=text;body.append(p);return p};
    if(!entry){paragraph('这门语言尚无对应的馆内示例讲解。');return}
    if(!matched){paragraph('当前代码与馆内示例不同，原讲解已暂停。点击代码区的“恢复示例”后，可重新对照讲解。');return}
    paragraph(entry.overview).className='lab-explanation-overview';
    const input=paragraph(entry.stdin);input.className='lab-explanation-input';
    const list=document.createElement('ol');list.className='lab-explanation-steps';
    for(const step of entry.steps){
      const item=document.createElement('li'),button=document.createElement('button'),detail=document.createElement('p');
      button.type='button';button.textContent='第'+step.from+(step.to===step.from?'':'–'+step.to)+'行 · '+step.title;button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>select(step,button));
      detail.textContent=step.detail;item.append(button,detail);list.append(item);
    }
    body.append(list);paragraph('讲解说明原示例的逻辑；实际输出与错误请查看运行结果。').className='lab-explanation-footnote';
  }
  toggle.addEventListener('click',()=>{const visible=panel.hidden;panel.hidden=!visible;toggle.setAttribute('aria-expanded',String(visible));toggle.textContent=visible?'隐藏讲解':'显示讲解';$('lab').classList.toggle('lab-without-explanation',!visible)});
  document.addEventListener('museum-lab-change',render);
  render();
})();
