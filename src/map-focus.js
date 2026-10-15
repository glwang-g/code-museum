// Viewport geometry owns no catalogue, navigation or archive state.
(function(root){
function createFocusController({document, getState, activeMapEdges, positions, frame, resetFocusLabels,
  setFrame, getScale, minimumZoom, placeFocusLabels, later=setTimeout, clear=clearTimeout}){
 const $=selector=>document.querySelector(selector);
 let timer=null;
 function cancel(){if(timer!==null)clear(timer);timer=null}
function focus(id){
  cancel();
  const {activeId,relationScope,visibleMap}=getState();
  if(id==null||activeId!==id||!visibleMap)return;
  resetFocusLabels();
  const currentEdges=activeMapEdges();
  const visible=new Set([...document.querySelectorAll('#docks .dock')].map(n=>n.dataset.id));
  const direct=new Set([id]);
  for(const edge of currentEdges){
    if(edge.from===id&&visible.has(edge.to))direct.add(edge.to);
    if(edge.to===id&&visible.has(edge.from))direct.add(edge.from);
  }
  if(relationScope==='levels')document.querySelectorAll('#docks .dock.related').forEach(node=>direct.add(node.dataset.id));
  if(direct.size){
    const viewport=$('#viewport'),parts=[];
    const number=value=>parseFloat(value)||0;
    for(const nodeId of direct){
      const node=document.querySelector(`#docks .dock[data-id="${document.defaultView.CSS.escape(nodeId)}"]`),point=positions.get(nodeId);
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
    setFrame(parts,frame.fitScale(parts,viewport.clientWidth,viewport.clientHeight,Math.max(.9,minimumZoom())));
    const zoomScale=getScale();
    const bounds=frame.boundsAt(parts,zoomScale),world=$('#world').getBoundingClientRect(),view=viewport.getBoundingClientRect();
    const originX=world.left-view.left+viewport.scrollLeft,originY=world.top-view.top+viewport.scrollTop;
    const point=positions.get(id);
    const left=frame.scrollAxis(originX+bounds.left,originX+bounds.right,viewport.clientWidth,originX+point.x*zoomScale,viewport.scrollWidth-viewport.clientWidth);
    const top=frame.scrollAxis(originY+bounds.top,originY+bounds.bottom,viewport.clientHeight,originY+point.y*zoomScale,viewport.scrollHeight-viewport.clientHeight,18,.5);
    placeFocusLabels(direct,originX,originY,left,top);
    viewport.scrollTo({left,top,behavior:document.defaultView.matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
  }
}
 function schedule(id){
  cancel();
  if(id==null)return;
  timer=later(()=>{timer=null;const state=getState();if(state.mode==='focus'&&state.activeId===id&&state.visibleMap)focus(id)},60);
 }
 return {focus,schedule,cancel};
}
if(typeof module==='object'&&module.exports)module.exports={createFocusController};
else root.MUSEUM_MAP_FOCUS={createFocusController};
})(typeof window==='object'?window:globalThis);
