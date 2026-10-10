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
  $('relation-direction').onchange=()=>{relationDirection=$('relation-direction').value;setRelationScope('levels')};
  $('relation-levels').onchange=()=>{relationLevels=Number($('relation-levels').value);setRelationScope('levels')};
})();
