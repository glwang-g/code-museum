(()=>{
 const $=id=>document.getElementById(id),data=window.MUSEUM_LEARNING_PATHS;
 const key='code-museum-guide',routes=new Map(data.routes.map(r=>[r.id,r]));
 let state=null,persistent=true,completed={};
 try{completed=JSON.parse(localStorage.getItem(key+'-completed'))||{}}catch{}
 $('guide-toggle').onclick=()=>{const compact=$('learning-guide').classList.toggle('compact');$('guide-toggle').textContent=compact?'展开导览':'收起导览';$('guide-toggle').setAttribute('aria-expanded',String(!compact));$('guide-body').inert=compact};
 const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 try{const saved=JSON.parse(localStorage.getItem(key));if(saved&&routes.has(saved.route)&&Number.isInteger(saved.index)&&saved.index>=0&&saved.index<routes.get(saved.route).steps.length)state={route:saved.route,index:saved.index};}catch{persistent=false}
 function save(){try{state?localStorage.setItem(key,JSON.stringify(state)):localStorage.removeItem(key);persistent=true}catch{persistent=false}}
 function render(){
  $('learning-guide').hidden=!state;if(!state)return;
  const route=routes.get(state.route),step=route.steps[state.index];
  $('guide-title').textContent=route.title+' · '+step.title;
  $('guide-progress').textContent=(state.index+1)+' / '+route.steps.length+(persistent?'':' · 进度仅本页面保存');
  $('guide-note').textContent=step.note;
  $('guide-task-content').innerHTML=[['观察',step.observe],['动手',step.change],['预期',step.expected]].map(([label,value])=>`<dt>${label}</dt><dd>${esc(value)}</dd>`).join('');
  $('guide-feedback').textContent=step.check?'运行后将比较本次真实输出与练习预期。':'本步为阅读或探索任务，不自动判定完成。';delete $('guide-feedback').dataset.state;
  $('guide-completion').textContent=completed[state.route+':'+state.index]?'此练习曾得到与预期匹配的输出。':'';
  $('guide-prev').disabled=state.index===0;$('guide-next').disabled=state.index===route.steps.length-1;
 }
 function open(){
  if(!state)return;const step=routes.get(state.route).steps[state.index];
  if(step.action==='archive')window.MUSEUM_RELATIONS_UI.openLanguage(step.language);
  else if(step.action==='proof'){$('lineage-view').click();window.MUSEUM_RELATIONS_UI.open(step.key);}
  else if(step.action==='lesson')window.MUSEUM_LAB.openLesson(step.language,step.topic);
  else window.MUSEUM_COMPARE.open(step.left,step.right,step.topic);
  render();
 }
 function start(route){if(!routes.has(route))return;state={route,index:0};save();open()}
 $('learning-path-cards').innerHTML=data.routes.map(r=>`<article><h4>${esc(r.title)}</h4><p>${esc(r.description)}</p><button type="button" data-guide-start="${esc(r.id)}">开始 · ${r.steps.length} 步</button></article>`).join('');
 for(const b of document.querySelectorAll('[data-guide-start]'))b.onclick=()=>start(b.dataset.guideStart);
 $('guide-open').onclick=open;
 $('guide-prev').onclick=()=>{if(state&&state.index>0){state.index--;save();open()}};
 $('guide-next').onclick=()=>{if(state&&state.index<routes.get(state.route).steps.length-1){state.index++;save();open()}};
 $('guide-end').onclick=()=>{state=null;save();render()};
 new MutationObserver(()=>{
  if(!state)return;const step=routes.get(state.route).steps[state.index],lab=window.MUSEUM_LAB;
  if(!step.check||lab.current!==step.language||lab.topic!==step.topic)return;
  const result=$('lab-result'),answer=window.MUSEUM_EXPLORATION.feedback(result.textContent,result.dataset.state,step.check.output);
  $('guide-feedback').textContent=answer.text;$('guide-feedback').dataset.state=answer.status;
  if(answer.status==='matched'){completed[state.route+':'+state.index]=true;try{localStorage.setItem(key+'-completed',JSON.stringify(completed))}catch{}$('guide-completion').textContent='此练习已得到与预期匹配的输出；仅核对输出，不评判代码写法。'}
 }).observe($('lab-result'),{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-state']});
 window.MUSEUM_GUIDE={start,open,get state(){return state?{...state}:null}};
 render();
})();
