(()=>{
  const viewport=document.getElementById('viewport');
  let gesture=null,suppressUntil=0;
  const pointers=new Set();
  viewport.addEventListener('pointerdown',event=>{
    suppressUntil=0;
    pointers.add(event.pointerId);
    if(pointers.size>1){if(gesture)gesture.moved=true;return}
    if(event.button!==0)return;
    gesture={id:event.pointerId,x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop,moved:false,pan:event.pointerType==='mouse'&&!event.target.closest('button,.relation-control')};
  });
  window.addEventListener('pointermove',event=>{
    if(!gesture||event.pointerId!==gesture.id)return;
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
    if(Math.hypot(dx,dy)>7)gesture.moved=true;
    if(gesture.moved&&gesture.pan){viewport.scrollLeft=gesture.left-dx;viewport.scrollTop=gesture.top-dy;viewport.classList.add('panning')}
  });
  const end=event=>{
    pointers.delete(event.pointerId);
    if(!gesture||event.pointerId!==gesture.id)return;
    if(gesture.moved||event.type==='pointercancel')suppressUntil=performance.now()+500;
    gesture=null;viewport.classList.remove('panning');
  };
  window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);
  // Capture on document before proximity selection; keyboard-generated clicks remain valid.
  const suppress=event=>event.detail!==0&&event.target.closest('#viewport')&&performance.now()<suppressUntil;
  window.MUSEUM_MAP_INTERACTION={suppress};
  document.addEventListener('click',event=>{
    if(suppress(event)){event.preventDefault();event.stopImmediatePropagation()}
  },true);
  viewport.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&activeId){event.preventDefault();restoreMapOverview()}
  });
})();
