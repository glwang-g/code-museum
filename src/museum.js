const {records,edges,ecosystemEdges=[],meta}=window.MUSEUM_DATA;
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function statusLabel(r){
  const status=r.review?.status;
  if(status==='verified-language')return '已核语法与实现';
  if(status==='historical-primary-source')return '史料确认的历史语言';
  if(status==='verified-related-technology')return '已核相关技术';
  if(status==='verified-formal-language')return '形式语言／数据语法';
  if(status==='bibliographic-only')return '仅有论文书目，语法与实现待核';
  if(status==='review-blocked')return '来源访问受阻，待继续核实';
  if(r.mapEligible)return '有语法与执行环境线索，待逐项核实';
  if(r.category==='related'&&r.language)return '来源主类或人工分类为相关技术／记法';
  return r.language?'来源标为语言，性质待核':'来源标为相关技术';
}
function categoryLabel(r){return r.category==='language'?'语言':r.category==='pending'?'性质待核':'相关技术／形式语法'}
const byId=new Map(records.map(r=>[r.id,r])),positions=new Map(),timelinePositions=new Map();
const mapLanguageIds=new Set(records.filter(r=>r.mapEligible).map(r=>r.id));
const designEdges=edges.filter(e=>!['implementationOf','compatibleWith'].includes(e.type));
const ecologyEdges=[...edges.filter(e=>['implementationOf','compatibleWith'].includes(e.type)),...ecosystemEdges];
const mapDesignEdges=designEdges.filter(e=>mapLanguageIds.has(e.from)&&mapLanguageIds.has(e.to));
const mapEcologyEdges=ecologyEdges.filter(e=>mapLanguageIds.has(e.from)&&mapLanguageIds.has(e.to));
const activeMapEdges=()=>relationLayer==='design'?mapDesignEdges:mapEcologyEdges;
const relationClass=e=>({supersetOf:'super',successorOf:'successor',implementationOf:'implementation',compatibleWith:'compatible'})[e.type]||'';
const relationLabel=e=>e.label||({supersetOf:'超集扩展',successorOf:'后继',implementationOf:'语言实现',compatibleWith:'语法兼容',extensionInterface:'扩展接口',hostRuntime:'宿主运行时',interop:'互操作'})[e.type]||'影响';
const relationEvidenceState=e=>typeof e.evidence==='string'&&e.evidence.trim()?'claim-with-citation':'record-field-only';
const relationEvidenceLabel=e=>relationEvidenceState(e)==='claim-with-citation'?'附有论证与出处':'来源字段，关系待核';
const relationEvidenceClass=e=>relationEvidenceState(e)==='claim-with-citation'?'cited-edge':'field-edge';
const selectedIds=new Set(meta.mapLabelIds);
const epochs=[[1800,65,'1800 · 序厅'],[1940,430,'1940'],[1950,610,'1950'],[1960,850,'1960'],[1970,1090,'1970'],[1980,1360,'1980'],[1990,1640,'1990'],[2000,1940,'2000'],[2010,2220,'2010'],[2026,2510,'2026']];
function xpos(y){if(!y)return 2540;if(y<1800)return 30;for(let i=1;i<epochs.length;i++){let[a,x]=epochs[i-1],[b,z]=epochs[i];if(y<=b)return x+(y-a)/(b-a)*(z-x)}return 2550}
const hash=s=>[...s].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,0);
let viewMode='timeline',relationLayer='design',activeId=null,zoomScale=1,zoomMode='fit',focusParts=null;
$('#epochs').innerHTML=epochs.map(([,x,n])=>`<span class="epoch" style="left:${x}px">${n}</span>`).join('');
const verifiedCount=records.filter(r=>['verified-language','historical-primary-source'].includes(r.review?.status)).length;
$('#counts').innerHTML=`<b>${meta.count.toLocaleString()}</b> 馆藏条目<br><b>${verifiedCount}</b> 条人工核实 · <b>${meta.mapLanguageCount.toLocaleString()}</b> 个有线索地图节点`;
$('#provenance').textContent=`数据：PLDB / Public domain。获取于 ${meta.retrieved.slice(0,10)}。保留 ${meta.count} 条来源记录；其中 ${meta.languages} 条被来源标记为语言，该标记不等于已核实。无足够语法与实现线索的条目列入「性质待核」，已确认的工具、协议、编码等列入相关技术。`;
const lanes=Array.from({length:9},()=>[]);
const dated=records.filter(r=>r.year&&r.mapEligible).sort((a,b)=>a.year-b.year||a.name.localeCompare(b.name));
for(const r of dated.filter(r=>selectedIds.has(r.id))){const x=xpos(r.year);let lane=lanes.findIndex(l=>l.every(p=>Math.abs(p-x)>125));if(lane<0)lane=hash(r.id)%9;lanes[lane].push(x);positions.set(r.id,{x,y:88+lane*53,label:true});}
for(const r of records)if(!positions.has(r.id))positions.set(r.id,{x:xpos(r.year),y:65+hash(r.id)%490,label:false});
for(const [id,p] of positions)timelinePositions.set(id,p);
$('#docks').innerHTML=dated.map(r=>{let p=positions.get(r.id);return `<button type="button" class="dock ${p.label?'':'dot'}" data-id="${esc(r.id)}" data-name="${esc(r.name)}" style="left:${p.x}px;top:${p.y}px" aria-label="${esc(r.name)}，${r.year}">${p.label?esc(r.name)+`<small>${r.year}</small>`:''}</button>`}).join('');
const events=[{name:'Jacquard · 提花织机',year:1804,url:'https://www.computerhistory.org/babbage/engines/'},{name:'Babbage · 分析机',year:1837,url:'https://www.computerhistory.org/babbage/engines/'},{name:'Ada · 分析机笔记',year:1843,url:'https://www.fourmilab.ch/babbage/sketch.html'},{name:'Church / Turing · 可计算性',year:1936,url:'https://plato.stanford.edu/entries/computability/'}];
events.forEach((e,i)=>{const b=document.createElement('button');b.className='dock';b.style.cssText=`left:${90+i*100}px;top:${120+i*95}px`;b.textContent=e.name;b.onclick=()=>openPanel(`<div class="eyebrow">序厅 · ${e.year}</div><h2>${esc(e.name)}</h2><p>计算史背景事件，不是现代语言的直接派生节点。序厅事件为叙事排布。</p><h3>史料入口</h3><a href="${e.url}" target="_blank" rel="noreferrer">阅读来源 ↗</a>`);$('#docks').append(b)});
// Coordinates follow visible water in history-river.png (1536 × 1024), not the timeline layout.
const riverCurrents=[
  'M 145 258 C 205 294 278 300 367 300',
  'M 58 390 C 146 365 186 350 245 366 S 348 405 420 397',
  'M 282 380 C 355 397 438 412 533 435 S 683 455 770 477',
  'M 672 474 C 794 486 906 510 1016 550 S 1178 625 1296 660',
  'M 1118 586 C 1232 644 1370 687 1536 731',
  'M 48 551 C 136 545 216 565 299 594',
  'M 312 606 C 410 639 480 667 561 682 S 696 706 786 738',
  'M 690 704 C 823 743 931 792 1051 820 S 1230 858 1356 904',
  'M 1155 840 C 1282 870 1402 919 1536 953',
  'M 1028 253 C 1133 271 1227 279 1318 261 S 1447 258 1524 289'
];
const riverFoam=[[220,267],[339,300],[256,383],[491,430],[667,468],[886,510],[1097,582],[1370,693],[172,555],[433,647],[667,698],[934,784],[1279,883]];
$('#water').innerHTML=riverCurrents.map((d,i)=>`<path class="flow" style="animation-delay:-${i*1.6}s" d="${d}"/>`).join('')+riverFoam.map(([x,y],i)=>`<ellipse class="foam" style="animation-delay:-${i%6}s" cx="${x}" cy="${y}" rx="${2+i%3}" ry="1.3"/>`).join('');
const graphIds=new Set([...mapDesignEdges,...mapEcologyEdges].flatMap(e=>[e.from,e.to]));
const indegree=new Map([...graphIds].map(id=>[id,0])),children=new Map([...graphIds].map(id=>[id,[]]));
for(const e of mapDesignEdges){if(children.has(e.from)&&indegree.has(e.to)){children.get(e.from).push(e.to);indegree.set(e.to,indegree.get(e.to)+1)}}
const parents=new Map([...graphIds].map(id=>[id,[]]));
for(const e of mapDesignEdges)if(parents.has(e.to))parents.get(e.to).push(e.from);
const depth=new Map([...graphIds].map(id=>[id,0])),queue=[...graphIds].filter(id=>indegree.get(id)===0);let cursor=0;
while(cursor<queue.length){const id=queue[cursor++];for(const child of children.get(id)){depth.set(child,Math.max(depth.get(child),depth.get(id)+1));indegree.set(child,indegree.get(child)-1);if(indegree.get(child)===0)queue.push(child)}}
const unresolved=[...graphIds].filter(id=>indegree.get(id)>0),maxDepth=Math.max(0,...depth.values());
for(const id of unresolved)depth.set(id,maxDepth+1);
const maxLayer=Math.max(0,...depth.values()),layers=Array.from({length:maxLayer+1},()=>[]);
for(const id of graphIds)layers[depth.get(id)].push(byId.get(id));
const lineagePositions=new Map();
layers.forEach((layer,x)=>layer.sort((a,b)=>(a.year||9999)-(b.year||9999)||a.name.localeCompare(b.name)).forEach((r,i)=>lineagePositions.set(r.id,{x:70+x*2400/Math.max(1,maxLayer),y:35+(i+1)*540/(layer.length+1)})));
function overviewRelationMarkup(){
  return arrowDefinitions()+activeMapEdges().map(edge=>{
    const from=positions.get(edge.from),to=positions.get(edge.to),middle=(from.x+to.x)/2;
    return `<path class="${relationLayer==='ecosystem'?'ecology-edge':''} ${relationClass(edge)} ${relationEvidenceClass(edge)}" data-evidence-state="${relationEvidenceState(edge)}" ${relationLayer==='design'?'marker-end="url(#arrow)"':''} d="M${from.x} ${from.y} C${middle} ${from.y} ${middle} ${to.y} ${to.x} ${to.y}"/>`;
  }).join('');
}
function arrowDefinitions(){return '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><polygon points="0,0 10,5 0,10" fill="#ffd99b"/></marker></defs>'}
const worldSize={width:2600,height:610};
function minimumZoom(){
  const viewport=$('#viewport');
  return Math.min(1,viewport.clientWidth/worldSize.width,viewport.clientHeight/worldSize.height);
}
function applyZoom(scale){
  const viewport=$('#viewport');
  if(!viewport.clientWidth||!viewport.clientHeight)return;
  zoomScale=Math.max(.04,Math.min(2.5,scale));
  const stage=$('#world-stage');
  const bounds=focusParts?window.MUSEUM_MAP_FRAME.boundsAt(focusParts,zoomScale):null;
  const insetX=bounds?Math.max(0,18-bounds.left):0,insetY=bounds?Math.max(0,18-bounds.top):0;
  const width=Math.max(worldSize.width*zoomScale,bounds?.right||0)+insetX+(bounds?18:0);
  const height=Math.max(worldSize.height*zoomScale,bounds?.bottom||0)+insetY+(bounds?18:0);
  stage.style.width=`${width}px`;
  stage.style.height=`${height}px`;
  stage.style.marginTop=`${Math.max(0,(viewport.clientHeight-height)/2)}px`;
  $('#world').style.left=`${insetX}px`;$('#world').style.top=`${insetY}px`;
  $('#world').style.transform=`scale(${zoomScale})`;
  $('#world').style.setProperty('--tooltip-scale',String(1/zoomScale));
  $('#zoom-out').disabled=zoomScale<=minimumZoom()+.001;
  $('#zoom-in').disabled=zoomScale>=2.5;
}
function fitMap(){focusParts=null;zoomMode='fit';applyZoom(minimumZoom())}
function zoomBy(factor){
  const viewport=$('#viewport');
  const focus=activeId&&positions.has(activeId)?positions.get(activeId):null;
  const view=viewport.getBoundingClientRect(),before=$('#world').getBoundingClientRect();
  const x=focus?.x??(view.left+viewport.clientWidth/2-before.left)/zoomScale;
  const y=focus?.y??(view.top+viewport.clientHeight/2-before.top)/zoomScale;
  zoomMode='custom';
  applyZoom(Math.max(minimumZoom(),zoomScale*factor));
  const after=$('#world').getBoundingClientRect();
  viewport.scrollTo({left:after.left-view.left+viewport.scrollLeft+x*zoomScale-viewport.clientWidth/2,top:after.top-view.top+viewport.scrollTop+y*zoomScale-viewport.clientHeight/2,behavior:'instant'});
  repackFocusLabels();
}
$('#zoom-fit').onclick=()=>{fitMap();$('#viewport').scrollTo({left:0,top:0,behavior:'instant'});repackFocusLabels()};
$('#zoom-in').onclick=()=>zoomBy(1.45);
$('#zoom-out').onclick=()=>zoomBy(1/1.45);
new ResizeObserver(()=>{if(zoomMode==='fit'){fitMap();repackFocusLabels()}else if(zoomMode==='focus'&&activeId&&!$('#river').hidden)renderLineageFocus(activeId);else {applyZoom(zoomScale);repackFocusLabels()}}).observe($('#viewport'));
let previewScroll=null;
function activateTab(id){
  closeMapSearch();
  const previous=document.querySelector('.museum-tabs .active')?.id;
  $('#river').hidden=!['timeline-view','lineage-view'].includes(id);
  $('#catalogue').hidden=id!=='catalogue-view';
  $('#lab').hidden=id!=='lab-view';
  $('#about').hidden=id!=='sources-view';
  $('#river').setAttribute('aria-labelledby',id==='lineage-view'?'lineage-view':'timeline-view');
  for(const tab of document.querySelectorAll('.museum-tabs [role=tab]')){
    const active=tab.id===id;
    tab.classList.toggle('active',active);
    tab.setAttribute('aria-selected',String(active));
    tab.tabIndex=active?0:-1;
  }
  if(previous&&previous!==id){
    clearRelationPreview();
    $('#detail').classList.remove('open');
    $('#detail').setAttribute('aria-hidden','true');
    $('#detail').inert=true;
  }
  if(previous!==id&&(previous==='lab-view'||id==='lab-view'))window.MUSEUM_LAB?.onTabChange(id==='lab-view');
}
function showCatalogue(){activateTab('catalogue-view')}
function showSources(){activateTab('sources-view')}
function setView(mode){viewMode=mode;const lineage=mode==='lineage';activateTab(lineage?'lineage-view':'timeline-view');document.body.classList.toggle('lineage-mode',lineage);$('#atlas-title').innerHTML=lineage?'关系谱系 <small>／ 按已记录关系分层，连线有来源</small>':'时间长河 <small>／ 按来源年代定位，非等距时间轴</small>';$('#atlas-note').textContent=lineage?'仅显示已收录地图节点之间有明确来源的关系；全量馆藏仍可检索。':'淡线显示已记录关系；点选语言放大查看上下游，点空白恢复全貌。其余馆藏仍可检索。';const shown=lineage?records.filter(r=>graphIds.has(r.id)):dated;positions.clear();for(const [id,p] of (lineage?lineagePositions:timelinePositions))positions.set(id,p);const layout=lineage?lineagePositions:null;$('#docks').innerHTML=shown.map(r=>{const p=layout?layout.get(r.id):positions.get(r.id);const label=layout?selectedIds.has(r.id):p.label;return '<button type="button" class="dock '+(label?'':'dot')+'" data-id="'+esc(r.id)+'" data-name="'+esc(r.name)+'" style="left:'+p.x+'px;top:'+p.y+'px" aria-label="'+esc(r.name)+'">'+(label?esc(r.name)+(r.year?'<small>'+r.year+'</small>':''):'')+'</button>'}).join('');$('#relations').innerHTML=overviewRelationMarkup();zoomMode='fit';fitMap();$('#viewport').scrollTo({left:0,top:0,behavior:'instant'});}
$('#timeline-view').onclick=()=>{setView('timeline');if(activeId)renderLineageFocus(activeId);history.replaceState(null,'','#river')};
$('#lineage-view').onclick=()=>{setView('lineage');if(activeId&&graphIds.has(activeId))renderLineageFocus(activeId);else restoreMapOverview();history.replaceState(null,'','#lineage')};
function setRelationLayer(layer){
  relationLayer=layer;
  $('#design-layer').setAttribute('aria-pressed',String(layer==='design'));
  $('#ecosystem-layer').setAttribute('aria-pressed',String(layer==='ecosystem'));
  $('#relation-legend').textContent=layer==='design'?'虚线：影响　实线：超集／后继　较淡：依据待核':'青色连线：实现、平台与互操作；无血缘箭头';
  if(activeId){select(activeId);renderLineageFocus(activeId)}else $('#relations').innerHTML=overviewRelationMarkup();
  if(!activeId)$('#atlas-note').textContent=layer==='design'?'淡线显示有来源的设计关系；点击语言查看前序与后续。':'青色线显示有来源的实现、平台与互操作关系；不表示语言继承。';
}
$('#design-layer').onclick=()=>setRelationLayer('design');
$('#ecosystem-layer').onclick=()=>setRelationLayer('ecosystem');
$('#catalogue-view').onclick=()=>{showCatalogue();history.replaceState(null,'','#catalogue')};
$('#lab-view').onclick=()=>{activateTab('lab-view');history.replaceState(null,'','#lab')};
$('#sources-view').onclick=()=>{showSources();history.replaceState(null,'','#about')};
$('.museum-tabs').addEventListener('keydown',event=>{
  const tabs=[...document.querySelectorAll('.museum-tabs [role=tab]')];
  const index=tabs.indexOf(document.activeElement);
  if(index<0)return;
  const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:-1;
  if(next<0)return;
  event.preventDefault();
  tabs[next].focus();
  tabs[next].click();
});
function restoreHashTab(){
  if(location.hash==='#catalogue')showCatalogue();
  else if(location.hash==='#lab')activateTab('lab-view');
  else if(location.hash==='#about')showSources();
  else if(location.hash==='#lineage')setView('lineage');
  else if(location.hash==='#river')setView('timeline');
}
window.addEventListener('hashchange',restoreHashTab);
window.addEventListener('popstate',restoreHashTab);
restoreHashTab();
function clearRelationPreview(){
  document.body.classList.remove('relation-preview');
  document.querySelectorAll('.preview-target,.preview-edge,.relation-link.preview').forEach(node=>node.classList.remove('preview-target','preview-edge','preview'));
  if(previewScroll){$('#viewport').scrollTo({left:previewScroll.left,top:previewScroll.top,behavior:'instant'});previewScroll=null;repackFocusLabels()}
}
function previewRelation(button){
  clearRelationPreview();
  if(!activeId||$('#river').hidden||!$('#detail').classList.contains('open'))return;
  const targetId=button.dataset.related;
  const target=[...document.querySelectorAll('#docks [data-id]')].find(node=>node.dataset.id===targetId);
  const lines=[...document.querySelectorAll('#relations path.related-edge')].filter(path=>(path.dataset.from===activeId&&path.dataset.to===targetId)||(path.dataset.to===activeId&&path.dataset.from===targetId));
  if(!target||!lines.length)return;
  document.body.classList.add('relation-preview');
  button.classList.add('preview');
  target.classList.add('preview-target');
  lines.forEach(path=>path.classList.add('preview-edge'));
  const viewport=$('#viewport'),bounds=viewport.getBoundingClientRect(),targetBounds=target.getBoundingClientRect();
  const targetX=(targetBounds.left+targetBounds.right)/2,targetY=(targetBounds.top+targetBounds.bottom)/2;
  const margin=Math.min(48,viewport.clientWidth*.08);
  if(targetX<bounds.left+margin||targetX>bounds.right-margin||targetY<bounds.top+margin||targetY>bounds.bottom-margin){
    previewScroll={left:viewport.scrollLeft,top:viewport.scrollTop};
    const selected=positions.get(activeId),other=positions.get(targetId);
    const distance=Math.abs(selected.x-other.x)*zoomScale;
    const world=$('#world').getBoundingClientRect();
    const originX=world.left-bounds.left+viewport.scrollLeft,originY=world.top-bounds.top+viewport.scrollTop;
    const centerX=originX+(distance<viewport.clientWidth-2*margin?(selected.x+other.x)*zoomScale/2:other.x*zoomScale);
    viewport.scrollTo({left:centerX-viewport.clientWidth/2,top:originY+other.y*zoomScale-viewport.clientHeight/2,behavior:'instant'});
    repackFocusLabels();
  }
}
function resetFocusLabels(){
  document.querySelectorAll('#docks .dock').forEach(node=>{node.style.removeProperty('--label-shift-x');node.style.removeProperty('--label-shift-y');node.classList.remove('label-deferred');delete node.dataset.labelPlacement;});
  document.querySelectorAll('#relations .label-guide,#relations .label-anchor').forEach(node=>node.remove());
}
function syncMapRunButton(){
  const node=$('#docks .dock.selected');
  let button=$('#docks .map-run');
  if(!node||!window.MUSEUM_LAB?.canRun(node.dataset.id)){button?.remove();return}
  if(!button){
    button=document.createElement('button');button.type='button';button.className='map-run';button.textContent='▶';
    button.onclick=event=>{event.stopPropagation();window.MUSEUM_LAB.open(button.dataset.runLanguage)};
    $('#docks').append(button);
  }
  button.dataset.runLanguage=node.dataset.id;
  button.title=`${node.dataset.name} 可在线运行 · 打开实验台`;
  button.setAttribute('aria-label',button.title);
  const style=getComputedStyle(node,'::after'),base=getComputedStyle(node),n=value=>parseFloat(value)||0;
  const width=n(style.width)+(style.boxSizing==='border-box'?0:n(style.paddingLeft)+n(style.paddingRight)+n(style.borderLeftWidth)+n(style.borderRightWidth));
  const height=n(style.height)+(style.boxSizing==='border-box'?0:n(style.paddingTop)+n(style.paddingBottom)+n(style.borderTopWidth)+n(style.borderBottomWidth));
  const dx=n(node.style.getPropertyValue('--label-shift-x')),dy=n(node.style.getPropertyValue('--label-shift-y'));
  button.style.left=`${node.offsetLeft-node.offsetWidth/2+n(base.borderLeftWidth)+n(style.left)+(dx+width-29)/zoomScale}px`;
  button.style.top=`${node.offsetTop-node.offsetHeight/2+n(base.borderTopWidth)+n(style.top)+(dy+(height-24)/2)/zoomScale}px`;
}
function repackFocusLabels(){
  if(!activeId||!document.body.classList.contains('lineage-focus')||$('#river').hidden)return;
  resetFocusLabels();
  const direct=new Set([activeId]);
  for(const edge of activeMapEdges()){
    const other=edge.from===activeId?edge.to:edge.to===activeId?edge.from:null;
    if(other&&document.querySelector(`#docks .dock[data-id="${CSS.escape(other)}"]`))direct.add(other);
  }
  const viewport=$('#viewport'),view=viewport.getBoundingClientRect(),world=$('#world').getBoundingClientRect();
  placeFocusLabels(direct,world.left-view.left+viewport.scrollLeft,world.top-view.top+viewport.scrollTop,viewport.scrollLeft,viewport.scrollTop);
}
function placeFocusLabels(direct,originX,originY,targetLeft,targetTop){
  const viewport=$('#viewport'),view=viewport.getBoundingClientRect(),number=value=>parseFloat(value)||0;
  const labels=[];
  for(const node of document.querySelectorAll('#docks .dock.related')){
    const id=node.dataset.id,rect=node.getBoundingClientRect();
    let left=rect.left-view.left+viewport.scrollLeft-targetLeft,top=rect.top-view.top+viewport.scrollTop-targetTop,width=rect.width,height=rect.height;
    if(node.classList.contains('selected')||node.classList.contains('dot')){
      const style=getComputedStyle(node,node.classList.contains('selected')?'::after':'::before'),base=getComputedStyle(node);
      left+=(number(base.borderLeftWidth)+number(style.left))*zoomScale;top+=(number(base.borderTopWidth)+number(style.top))*zoomScale;
      width=number(style.width)+(style.boxSizing==='border-box'?0:number(style.paddingLeft)+number(style.paddingRight)+number(style.borderLeftWidth)+number(style.borderRightWidth));
      height=number(style.height)+(style.boxSizing==='border-box'?0:number(style.paddingTop)+number(style.paddingBottom)+number(style.borderTopWidth)+number(style.borderBottomWidth));
    }
    const priority=node.classList.contains('selected')?0:direct.has(id)?1:2;
    if(priority===2&&(left+width<0||left>viewport.clientWidth||top+height<0||top>viewport.clientHeight)){node.dataset.labelPlacement='outside';continue}
    labels.push({id,priority,left,right:left+width,top,bottom:top+height});
  }
  let guides='';
  for(const label of window.MUSEUM_MAP_FRAME.placeLabels(labels,viewport.clientWidth,viewport.clientHeight)){
    const node=document.querySelector(`#docks .dock[data-id="${CSS.escape(label.id)}"]`);
    node.dataset.labelPlacement=label.placed?'placed':'deferred';node.classList.toggle('label-deferred',!label.placed);
    if(!label.placed)continue;
    node.style.setProperty('--label-shift-x',`${label.dx}px`);node.style.setProperty('--label-shift-y',`${label.dy}px`);
    if(Math.hypot(label.dx,label.dy)<2)continue;
    const point=positions.get(label.id),anchorX=originX+point.x*zoomScale-targetLeft,anchorY=originY+point.y*zoomScale-targetTop;
    const endX=Math.max(label.left,Math.min(anchorX,label.right)),endY=Math.max(label.top,Math.min(anchorY,label.bottom));
    const x=(endX+targetLeft-originX)/zoomScale,y=(endY+targetTop-originY)/zoomScale;
    guides+=`<path class="label-guide" data-label-guide="${esc(label.id)}" d="M${point.x} ${point.y} L${x} ${y}"/><circle class="label-anchor" cx="${point.x}" cy="${point.y}" r="${2/zoomScale}"/>`;
  }
  $('#relations').insertAdjacentHTML('beforeend',guides);
  syncMapRunButton();
}
function renderLineageFocus(id){
  resetFocusLabels();
  const currentEdges=activeMapEdges();
  const related=new Set([id]),ancestors=new Set([id]);
  if(relationLayer==='design'){
    const walk=(start,next,target)=>{const stack=[start];while(stack.length){for(const node of next.get(stack.pop())||[])if(!target.has(node)){target.add(node);stack.push(node)}}};
    walk(id,parents,ancestors);
    const descendants=new Set([id]);walk(id,children,descendants);
    for(const node of [...ancestors,...descendants])related.add(node);
  }else{
    const stack=[id];
    while(stack.length){const current=stack.pop();for(const edge of currentEdges){
      const other=edge.from===current?edge.to:edge.to===current?edge.from:null;
      if(other&&!related.has(other)){related.add(other);stack.push(other)}
    }}
  }
  document.body.classList.add('lineage-focus');
  const visible=new Set([...document.querySelectorAll('#docks .dock')].map(n=>n.dataset.id));
  document.querySelectorAll('#docks .dock').forEach(n=>{n.classList.toggle('related',related.has(n.dataset.id));n.classList.toggle('selected',n.dataset.id===id)});
  const paths=currentEdges.filter(e=>related.has(e.from)&&related.has(e.to)&&visible.has(e.from)&&visible.has(e.to)).map(e=>{
    const a=positions.get(e.from),b=positions.get(e.to);
    const curve='M'+a.x+' '+a.y+' C'+((a.x+b.x)/2)+' '+a.y+' '+((a.x+b.x)/2)+' '+b.y+' '+b.x+' '+b.y;
    return '<path class="relation-hit" d="'+curve+'"/><path class="related-edge '+(relationLayer==='ecosystem'?'ecology-edge ':'')+relationClass(e)+' '+relationEvidenceClass(e)+'" data-evidence-state="'+relationEvidenceState(e)+'" data-relation-type="'+e.type+'" data-from="'+esc(e.from)+'" data-to="'+esc(e.to)+'" '+(relationLayer==='design'?'marker-end="url(#arrow)"':'')+' d="'+curve+'"/>';
  }).join('');
  $('#relations').innerHTML=arrowDefinitions()+paths;
  $('#atlas-note').textContent=paths?(relationLayer==='design'?'高亮已记录的设计前序与后续；较淡连线的关系依据待核。点击空白恢复全景。':'高亮实现与生态关联；青色线不表示语言继承。点击空白恢复全景。'):'当前层没有地图内关联；可切换关系层或查看档案。点击空白恢复全景。';
  const direct=new Set([id]);
  for(const edge of currentEdges){
    if(edge.from===id&&visible.has(edge.to))direct.add(edge.to);
    if(edge.to===id&&visible.has(edge.from))direct.add(edge.from);
  }
  if(direct.size&&!$('#river').hidden){
    const viewport=$('#viewport'),parts=[];
    const number=value=>parseFloat(value)||0;
    for(const nodeId of direct){
      const node=document.querySelector(`#docks .dock[data-id="${CSS.escape(nodeId)}"]`),point=positions.get(nodeId);
      const width=node.offsetWidth,height=node.offsetHeight;
      if(!node.classList.contains('selected')&&!node.classList.contains('dot')){
        parts.push({left:point.x,right:point.x,top:point.y,bottom:point.y,fixedLeft:-width/2,fixedWidth:width/2,fixedTop:-height/2,fixedHeight:height/2});
      }else parts.push({left:point.x-width/2,right:point.x+width/2,top:point.y-height/2,bottom:point.y+height/2});
      if(node.classList.contains('selected')||node.classList.contains('dot')){
        const style=getComputedStyle(node,node.classList.contains('selected')?'::after':'::before');
        const textWidth=number(style.width),textHeight=number(style.height);
        const fixedWidth=textWidth+(style.boxSizing==='border-box'?0:number(style.paddingLeft)+number(style.paddingRight)+number(style.borderLeftWidth)+number(style.borderRightWidth));
        const fixedHeight=textHeight+(style.boxSizing==='border-box'?0:number(style.paddingTop)+number(style.paddingBottom)+number(style.borderTopWidth)+number(style.borderBottomWidth));
        const nodeStyle=getComputedStyle(node);
        const left=point.x-width/2+number(nodeStyle.borderLeftWidth)+number(style.left);
        const top=point.y-height/2+number(nodeStyle.borderTopWidth)+number(style.top);
        parts.push({left,right:left,top,bottom:top,fixedWidth,fixedHeight});
      }
    }
    const frame=window.MUSEUM_MAP_FRAME;
    focusParts=parts;
    zoomMode='focus';
    applyZoom(frame.fitScale(parts,viewport.clientWidth,viewport.clientHeight,Math.max(.9,minimumZoom())));
    const bounds=frame.boundsAt(parts,zoomScale),world=$('#world').getBoundingClientRect(),view=viewport.getBoundingClientRect();
    const originX=world.left-view.left+viewport.scrollLeft,originY=world.top-view.top+viewport.scrollTop;
    const point=positions.get(id);
    const left=frame.scrollAxis(originX+bounds.left,originX+bounds.right,viewport.clientWidth,originX+point.x*zoomScale,viewport.scrollWidth-viewport.clientWidth);
    const top=frame.scrollAxis(originY+bounds.top,originY+bounds.bottom,viewport.clientHeight,originY+point.y*zoomScale,viewport.scrollHeight-viewport.clientHeight,18,.5);
    placeFocusLabels(direct,originX,originY,left,top);
    viewport.scrollTo({left,top,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
  }
  const previewButton=$('#detail-content .relation-link.preview');
  if(previewButton)previewRelation(previewButton);
}
let opener=null;
function restoreMapOverview(){
  clearRelationPreview();
  activeId=null;
  $('#docks .map-run')?.remove();
  document.body.classList.remove('lineage-focus');
  document.querySelectorAll('#docks .dock').forEach(node=>{node.classList.remove('related','selected','label-deferred');node.style.removeProperty('--label-shift-x');node.style.removeProperty('--label-shift-y');delete node.dataset.labelPlacement;});
  document.querySelectorAll('#docks [data-transient]').forEach(node=>node.remove());
  $('#relations').innerHTML=overviewRelationMarkup();
  fitMap();
  $('#viewport').scrollTo({left:0,top:0,behavior:'instant'});
  $('#atlas-note').textContent=relationLayer==='ecosystem'?'青色线显示实现、平台与互操作关系；不表示语言继承。':'淡线显示地图节点之间已有来源记录的设计关系；点选语言可看上游与下游。';
  const panelHadFocus=$('#detail').contains(document.activeElement);
  $('#detail').classList.remove('open');
  $('#detail').setAttribute('aria-hidden','true');
  $('#detail').inert=true;
  if(panelHadFocus){$('#viewport').tabIndex=0;$('#viewport').focus({preventScroll:true});}
}
$('#viewport').addEventListener('click',event=>{
  if(event.target.closest('.dock, #relations path'))return;
  if(activeId||document.body.classList.contains('lineage-focus'))restoreMapOverview();
});
function openPanel(html){
  opener=document.activeElement;
  $('#detail-content').innerHTML=html;
  const panel=$('#detail');
  panel.classList.add('open');panel.setAttribute('aria-hidden','false');panel.inert=false;
  // A new archive starts at its title, including when the close button already has focus.
  panel.scrollTop=0;panel.scrollLeft=0;
  $('#close').focus({preventScroll:true});
}
$('#detail').addEventListener('transitionend',event=>{if(event.propertyName==='flex-basis'&&activeId&&!$('#river').hidden)renderLineageFocus(activeId)});
function select(id){clearRelationPreview();if(viewMode==='lineage'&&mapLanguageIds.has(id)&&!graphIds.has(id))setView('timeline');const r=byId.get(id);if(!r)return;document.querySelectorAll('.dock.selected').forEach(n=>n.classList.remove('selected'));let b=document.querySelector(`[data-id="${CSS.escape(id)}"]`);if(!b&&r.year&&mapLanguageIds.has(id)){b=document.createElement('button');b.className='dock';b.dataset.transient='true';b.dataset.id=id;b.dataset.name=r.name;let p=positions.get(id);b.style.cssText=`left:${p.x}px;top:${p.y}px`;b.textContent=r.name;$('#docks').append(b)}if(b){b.classList.add('selected');b.toggleAttribute('data-runnable',!!window.MUSEUM_LAB?.canRun(id));b.setAttribute('aria-label',r.name);}
const incoming=designEdges.filter(e=>e.to===id),outgoing=designEdges.filter(e=>e.from===id),ecology=ecologyEdges.filter(e=>e.from===id||e.to===id);const mapVisible=new Set([...document.querySelectorAll('#docks [data-id]')].map(node=>node.dataset.id));const rel=(es,up,layer='design')=>es.length?es.map(e=>`<button class="relation-link" data-evidence-state="${relationEvidenceState(e)}" data-related="${esc(up?e.from:e.to)}">${esc(byId.get(up?e.from:e.to).name)} · ${esc(relationLabel(e))}<span class="relation-evidence-state">${relationEvidenceLabel(e)}</span><span class="relation-presence">${mapVisible.has(id)&&mapVisible.has(up?e.from:e.to)&&relationLayer===layer?'当前地图有连线':'档案记录／切换关系层'}</span></button>${e.evidence?`<p class="relation-evidence">${esc(e.evidence)}</p>`:''}<a href="${esc(e.source)}" target="_blank" rel="noreferrer">关系出处 ↗</a>`).join(''):'<p>本快照未记录；不表示没有历史关联。</p>';
const evidence=(r.review?`<h3>证据审查</h3>${r.review.notes?`<p>${esc(r.review.notes)}</p>`:''}${r.review.sources.map(source=>`<p><a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.role)} ↗</a></p>`).join('')}`:'')+(r.curationReason?`<h3>地图分类依据</h3><p>${esc(r.curationReason)}</p>`:'');
const correction=r.review?.catalogueCorrection;
const correctionHTML=correction?`<h3>馆藏校订</h3>${correction.changes.map(change=>`<p>${esc({name:'名称',year:'年代',creators:'创造者'}[change.field])}：${esc(change.from===null?'未记载':String(change.from))} → ${esc(String(change.to))}${change.event?` · ${esc(change.event)}`:''}</p>`).join('')}<p>${esc(correction.reason)}</p>${correction.sources.map(url=>`<p><a href="${esc(url)}" target="_blank" rel="noreferrer">校订出处 ↗</a></p>`).join('')}`:'';
openPanel(`<div class="eyebrow">馆藏 / ${esc(r.id)}</div><h2>${esc(r.name)}</h2><p>${r.year||'年代待考'} · ${esc(categoryLabel(r))} · ${esc(statusLabel(r))}</p><h3>档案</h3><p>创造者：${esc(r.creators||'来源未记载')}</p><p>原始分类：${esc(r.tags||'未分类')}</p><p>别名：${esc(r.aliases||'未记载')}</p>${evidence}${correctionHTML}<h3>设计脉络 · 上游 ${incoming.length}</h3>${rel(incoming,true)}<h3>设计脉络 · 下游 ${outgoing.length}</h3>${rel(outgoing,false)}<h3>实现与生态 · ${ecology.length}</h3>${rel(ecology.map(e=>({...e,from:e.from===id?e.to:e.from,to:id})),true,'ecosystem')}<h3>来源与延伸阅读</h3><p><a target="_blank" rel="noreferrer" href="${esc(r.source)}">PLDB 原始记录 ↗</a></p>${r.website&&/^https?:/.test(r.website)?`<p><a target="_blank" rel="noreferrer" href="${esc(r.website)}">官方网站 ↗</a></p>`:''}${r.wiki?`<p><a target="_blank" rel="noreferrer" href="${esc(r.wiki)}">百科条目 ↗</a></p>`:''}<h3>实验台</h3><p>${r.id==='javascript'?'JavaScript 可在浏览器中实际运行。':r.id==='python'?'Python 可用本地 Pyodide 在浏览器 Worker 中实际运行。':r.id==='lua'?'Lua 5.4 可用本地 WebAssembly 在浏览器 Worker 中实际运行。':'此语言尚未接入浏览器运行环境。'}</p>${r.language?'<button type="button" id="detail-open-lab">打开语言实验台 ↗</button>':''}`);
$('#detail-open-lab')?.addEventListener('click',()=>window.MUSEUM_LAB.open(r.id));
$('#detail-content').querySelectorAll('[data-related]').forEach(b=>{b.addEventListener('pointerenter',()=>previewRelation(b));b.addEventListener('pointerleave',clearRelationPreview);b.addEventListener('focus',()=>previewRelation(b));b.addEventListener('blur',clearRelationPreview);b.onclick=()=>{const id=b.dataset.related;if(!mapLanguageIds.has(id)&&document.body.classList.contains('lineage-focus'))restoreMapOverview();select(id);if(mapLanguageIds.has(id)){activeId=id;renderLineageFocus(activeId)}else activeId=null}});
$('#relations').innerHTML='<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><polygon points="0,0 10,5 0,10" fill="#ffd99b"/></marker></defs>'+[...incoming,...outgoing].filter(e=>positions.has(e.from)&&positions.has(e.to)).map(e=>{let a=positions.get(e.from),b=positions.get(e.to);return `<path class="${relationClass(e)} ${relationEvidenceClass(e)}" data-evidence-state="${relationEvidenceState(e)}" marker-end="url(#arrow)" d="M${a.x} ${a.y} C${(a.x+b.x)/2} ${a.y},${(a.x+b.x)/2} ${b.y},${b.x} ${b.y}"/>`}).join('');}
const nearby=document.createElement('div');nearby.className='nearby-list';nearby.hidden=true;nearby.setAttribute('aria-label','附近的语言');$('#river').append(nearby);
function hideNearby(){nearby.hidden=true;nearby.innerHTML=''}
$('#docks').addEventListener('click',e=>{
  const b=e.target.closest('[data-id]');if(!b)return;
  if(b.classList.contains('dot')){
    const center=b.getBoundingClientRect(),x=(center.left+center.right)/2,y=(center.top+center.bottom)/2;
    const close=[...document.querySelectorAll('#docks [data-id]')].filter(node=>{const rect=node.getBoundingClientRect();return Math.hypot((rect.left+rect.right)/2-x,(rect.top+rect.bottom)/2-y)<28});
    if(close.length>1){
      const atlas=$('#river').getBoundingClientRect();
      nearby.style.left=`${Math.max(8,Math.min(x-atlas.left+12,atlas.width-270))}px`;
      nearby.style.top=`${Math.max(48,Math.min(y-atlas.top+12,atlas.height-245))}px`;
      nearby.innerHTML='<strong>选择附近的语言</strong>'+close.sort((a,b)=>(a.dataset.name||'').localeCompare(b.dataset.name||'')).map(node=>`<button type="button" data-nearby="${esc(node.dataset.id)}">${esc(node.dataset.name||byId.get(node.dataset.id)?.name||node.dataset.id)}</button>`).join('');
      nearby.hidden=false;return;
    }
  }
  hideNearby();select(b.dataset.id);activeId=b.dataset.id;renderLineageFocus(activeId);
});
nearby.addEventListener('click',event=>{const choice=event.target.closest('[data-nearby]');if(!choice)return;const id=choice.dataset.nearby;hideNearby();select(id);activeId=id;renderLineageFocus(id)});
document.addEventListener('pointerdown',event=>{if(!nearby.hidden&&!event.target.closest('.nearby-list,#docks .dot'))hideNearby()});
$('#detail').inert=true;$('#close').onclick=()=>{clearRelationPreview();$('#detail').classList.remove('open');$('#detail').setAttribute('aria-hidden','true');$('#detail').inert=true;opener?.focus()};document.addEventListener('keydown',e=>{if(e.key==='Escape')$('#close').click()});
const workspace=$('.workspace'),resizer=$('#detail-resizer');
const savedSize=key=>{try{return Number(localStorage.getItem(key))||null}catch{return null}};
const rememberSize=(key,value)=>{try{localStorage.setItem(key,String(value))}catch{}};
function setDetailSize(size,mobile){
  const minimum=mobile?150:280;
  const limit=Math.max(minimum,mobile?Math.min(workspace.clientHeight*.7,600):Math.min(workspace.clientWidth*.55,720));
  const value=Math.round(Math.max(minimum,Math.min(size,limit)));
  workspace.style.setProperty(mobile?'--detail-height':'--detail-width',`${value}px`);
  resizer.setAttribute('aria-label',mobile?'调整详情高度':'调整详情宽度');
  resizer.setAttribute('aria-orientation',mobile?'horizontal':'vertical');
  resizer.setAttribute('aria-valuemin',String(minimum));
  resizer.setAttribute('aria-valuemax',String(Math.round(limit)));
  resizer.setAttribute('aria-valuenow',String(value));
  return value;
}
setDetailSize(savedSize('museum-detail-width')||440,false);
setDetailSize(savedSize('museum-detail-height')||workspace.clientHeight*.45,true);
if(!matchMedia('(max-width:700px)').matches)setDetailSize(savedSize('museum-detail-width')||440,false);
window.addEventListener('resize',()=>{
  const mobile=matchMedia('(max-width:700px)').matches;
  const key=mobile?'museum-detail-height':'museum-detail-width';
  setDetailSize(savedSize(key)||(mobile?workspace.clientHeight*.45:440),mobile);
});
resizer.addEventListener('pointerdown',event=>{
  event.preventDefault();const mobile=matchMedia('(max-width:700px)').matches;
  const start=mobile?$('#detail').getBoundingClientRect().height:$('#detail').getBoundingClientRect().width;
  const origin=mobile?event.clientY:event.clientX;
  workspace.classList.add('resizing');
  const move=e=>setDetailSize(start+origin-(mobile?e.clientY:e.clientX),mobile);
  const end=()=>{
    window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);
    workspace.classList.remove('resizing');
    rememberSize(mobile?'museum-detail-height':'museum-detail-width',mobile?$('#detail').getBoundingClientRect().height:$('#detail').getBoundingClientRect().width);
    if(activeId&&!$('#river').hidden)renderLineageFocus(activeId);
  };
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',end,{once:true});
});
resizer.addEventListener('keydown',event=>{
  const mobile=matchMedia('(max-width:700px)').matches;
  const increase=mobile?event.key==='ArrowUp':event.key==='ArrowLeft';
  const decrease=mobile?event.key==='ArrowDown':event.key==='ArrowRight';
  if(!increase&&!decrease)return;
  event.preventDefault();
  const current=mobile?$('#detail').getBoundingClientRect().height:$('#detail').getBoundingClientRect().width;
  const value=setDetailSize(current+(increase?24:-24),mobile);
  rememberSize(mobile?'museum-detail-height':'museum-detail-width',value);
  if(activeId&&!$('#river').hidden)renderLineageFocus(activeId);
});
let page=0,filtered=records;const size=60;
function update(reset=true){if(reset)page=0;const q=$('#search').value.trim().toLowerCase(),scope=$('#scope').value;filtered=records.filter(r=>(scope==='all'||r.category===(scope==='languages'?'language':scope==='other'?'related':'pending'))&&`${r.name} ${r.id} ${r.aliases} ${r.creators}`.toLowerCase().includes(q));if($('#sort').value==='year')filtered.sort((a,b)=>(a.year||9999)-(b.year||9999)||a.name.localeCompare(b.name));$('#result-count').textContent=`${filtered.length.toLocaleString()} 条匹配 / ${meta.count.toLocaleString()} 条馆藏`;$('#list').innerHTML=filtered.slice(page*size,(page+1)*size).map(r=>`<button class="record" data-id="${esc(r.id)}"><strong>${esc(r.name)}</strong><span>${r.year||'年代待考'} · ${esc(statusLabel(r))}</span></button>`).join('')||'<div class="empty">这次快照没有匹配条目。</div>';$('#page').textContent=`${filtered.length?page+1:0} / ${Math.ceil(filtered.length/size)}`;$('#prev').disabled=page===0;$('#next').disabled=(page+1)*size>=filtered.length;}
$('#list').onclick=e=>{let b=e.target.closest('[data-id]');if(b){const id=b.dataset.id;if(!mapLanguageIds.has(id)&&document.body.classList.contains('lineage-focus'))restoreMapOverview();select(id);if(mapLanguageIds.has(id)){activeId=id;renderLineageFocus(activeId)}else activeId=null}};$('#search').oninput=()=>update();$('#scope').onchange=()=>update();$('#sort').onchange=()=>update();$('#prev').onclick=()=>{page--;update(false)};$('#next').onclick=()=>{page++;update(false)};update();$('#relations').innerHTML=overviewRelationMarkup();requestAnimationFrame(fitMap);

// Search dated map nodes; full collection remains available through catalogue search.
const mapSearchInput=$('#map-search'),mapSearchPopup=$('#map-search-popup');
let mapSearchMatches=[],mapSearchIndex=-1;
function normalizeMapQuery(value){return String(value??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}+#]/gu,'')}
function mapEditDistance(a,b){
  const matrix=Array.from({length:a.length+1},(_,i)=>[i]);
  for(let j=0;j<=b.length;j++)matrix[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
    matrix[i][j]=Math.min(matrix[i-1][j]+1,matrix[i][j-1]+1,matrix[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
    if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])matrix[i][j]=Math.min(matrix[i][j],matrix[i-2][j-2]+1);
  }
  return matrix[a.length][b.length];
}
const mapSearchEntries=dated.map(record=>({record,terms:[record.name,record.id,...String(record.aliases||'').split(/[,;|\n]|\s+or\s+/i)].map(normalizeMapQuery).filter(Boolean)}));
function mapMatchRank(term,query){
  if(term===query)return 0;
  if(term.startsWith(query))return 10+Math.min(9,(term.length-query.length)/100);
  if(term.includes(query))return 20+term.indexOf(query)/100;
  if(query.length>=4&&Math.abs(term.length-query.length)<=2){const distance=mapEditDistance(term,query);if(distance<=(query.length>=7?2:1))return 30+distance;}
  if(query.length>=3){let i=0;for(const char of term)if(char===query[i])i++;if(i===query.length)return 40+term.length/100;}
  return Infinity;
}
function closeMapSearch(){
  const input=$('#map-search');if(!input)return;
  $('#map-search-popup').hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');
}
function highlightMapSearch(index){
  mapSearchIndex=index;
  $('#map-search-results').querySelectorAll('[role=option]').forEach((option,i)=>option.setAttribute('aria-selected',String(i===index)));
  if(index>=0){const option=$('#map-search-option-'+index);mapSearchInput.setAttribute('aria-activedescendant',option.id);option.scrollIntoView({block:'nearest'});}else mapSearchInput.removeAttribute('aria-activedescendant');
}
function updateMapSearch(){
  const query=normalizeMapQuery(mapSearchInput.value);
  $('#map-search-clear').hidden=!mapSearchInput.value;
  if(!query){closeMapSearch();return;}
  const matches=mapSearchEntries.map(({record,terms})=>({record,rank:Math.min(...terms.map(term=>mapMatchRank(term,query)))})).filter(match=>Number.isFinite(match.rank)).sort((a,b)=>a.rank-b.rank||a.record.name.localeCompare(b.record.name));
  mapSearchMatches=matches.slice(0,8).map(match=>match.record);
  $('#map-search-results').innerHTML=mapSearchMatches.map((record,i)=>`<button type="button" role="option" aria-selected="false" id="map-search-option-${i}" data-map-result="${esc(record.id)}"><strong>${esc(record.name)}</strong><small>${record.year} · ${esc(record.id)}${viewMode==='lineage'&&!graphIds.has(record.id)?' · 仅时间长河':''}</small></button>`).join('');
  $('#map-search-status').textContent=matches.length?`地图中 ${matches.length} 条匹配${matches.length>8?'，显示前 8 条':''}`:`地图中没有匹配；可在全部 ${meta.count.toLocaleString()} 条馆藏中继续检索。`;
  const riverBounds=$('#river').getBoundingClientRect(),searchBounds=$('#map-search-box').getBoundingClientRect();
  mapSearchPopup.style.maxWidth=`${Math.max(110,riverBounds.right-searchBounds.left-8)}px`;
  const room=riverBounds.bottom-searchBounds.bottom-100;
  $('#map-search-results').style.maxHeight=`${Math.max(36,Math.min(300,innerHeight*.35,room))}px`;
  mapSearchPopup.hidden=false;mapSearchInput.setAttribute('aria-expanded','true');highlightMapSearch(-1);
}
function chooseMapSearch(id){
  const record=byId.get(id),switchTimeline=viewMode==='lineage'&&!graphIds.has(id);
  mapSearchInput.value=record.name;$('#map-search-clear').hidden=false;closeMapSearch();hideNearby();
  select(id);activeId=id;renderLineageFocus(id);
  if(switchTimeline){history.replaceState(null,'','#river');$('#atlas-note').textContent='此语言尚无已记录的地图关系，已在时间长河定位；缺失关系不等于没有上游。';}
}
mapSearchInput.addEventListener('input',updateMapSearch);
mapSearchInput.addEventListener('focus',()=>{if(mapSearchInput.value)updateMapSearch()});
mapSearchInput.addEventListener('keydown',event=>{
  if(event.isComposing)return;
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeMapSearch();return;}
  if(!['ArrowDown','ArrowUp','Enter'].includes(event.key))return;
  if(mapSearchPopup.hidden){if(event.key==='Enter')return;updateMapSearch();}
  if(event.key==='Enter'){if(mapSearchMatches.length){event.preventDefault();chooseMapSearch(mapSearchMatches[Math.max(0,mapSearchIndex)].id);}return;}
  event.preventDefault();if(mapSearchMatches.length)highlightMapSearch((mapSearchIndex+(event.key==='ArrowDown'?1:mapSearchIndex<0?0:-1)+mapSearchMatches.length)%mapSearchMatches.length);
});
// Keep focus on the combobox until click is delivered. On macOS/Safari a
// mouse click on a button may blur the input with relatedTarget=null.
// Closing the popup on that blur would remove the target before click.
$('#map-search-popup').addEventListener('mousedown',event=>{
  if(event.button===0&&event.target.closest('button'))event.preventDefault();
});
$('#map-search-results').addEventListener('click',event=>{const option=event.target.closest('[data-map-result]');if(option)chooseMapSearch(option.dataset.mapResult)});
$('#map-search-clear').onclick=()=>{mapSearchInput.value='';updateMapSearch();mapSearchInput.focus({preventScroll:true})};
$('#map-search-catalogue').onclick=()=>{const query=mapSearchInput.value;closeMapSearch();$('#search').value=query;$('#scope').value='all';update();$('#catalogue-view').click();$('#search').focus({preventScroll:true})};
document.addEventListener('pointerdown',event=>{if(!$('#map-search-box').contains(event.target))closeMapSearch()});
$('#map-search-box').addEventListener('focusout',event=>{if(!$('#map-search-box').contains(event.relatedTarget))closeMapSearch()});
