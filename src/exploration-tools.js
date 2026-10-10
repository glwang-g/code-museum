(()=>{
  const $=id=>document.getElementById(id),panel=$('detail'),content=$('detail-content');
  function compact(value){
    const changed=panel.classList.contains('compact')!==value;
    panel.classList.toggle('compact',value);content.hidden=value;content.inert=value;
    $('detail-toggle').textContent=value?'展开档案':'收起档案';$('detail-toggle').setAttribute('aria-expanded',String(!value));
    if(changed&&activeId&&!$('river').hidden)requestAnimationFrame(()=>renderLineageFocus(activeId));
  }
  $('detail-toggle').onclick=()=>compact(!panel.classList.contains('compact'));
  $('detail-map').onclick=()=>{if($('river').hidden)setView(viewMode);compact(true);$('viewport').tabIndex=0;$('viewport').focus({preventScroll:true})};
  const original=openPanel;openPanel=function(html){compact(false);original(html)};
  let trail=[],returning=false;
  const choose=select;select=function(id){
    const previous=window.MUSEUM_NAV.state().language;
    if(!returning&&previous&&previous!==id&&byId.has(previous)&&!$('river').hidden)trail.push(previous);
    const result=choose(id);$('map-previous').disabled=!trail.length;return result;
  };
  $('map-previous').onclick=()=>{const id=trail.pop();if(!id)return;returning=true;try{select(id);activeId=mapLanguageIds.has(id)?id:null;if(activeId)renderLineageFocus(id)}finally{returning=false;$('map-previous').disabled=!trail.length}};
  $('relation-direction').onchange=()=>{relationDirection=$('relation-direction').value;setRelationScope('levels')};
  $('relation-levels').onchange=()=>{relationLevels=Number($('relation-levels').value);setRelationScope('levels')};
  window.addEventListener('popstate',()=>{trail=[];$('map-previous').disabled=true});
})();
