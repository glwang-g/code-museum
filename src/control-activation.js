(() => {
  // macOS Safari can deliver a tap's release without a usable press/click while
  // an editable field owns the input context. Native clicks always take priority.
  const selector='button,summary,a[href],input[type="button"],input[type="submit"],input[type="reset"]';
  let pending=null,timer=0,press=null,lastInputLoss=-Infinity,lastOrphan=null;
  const editable=element=>!!element&&(element.isContentEditable||element.matches?.('textarea,input[type="text"],input[type="search"],input[type="email"],input[type="url"],input[type="tel"],input[type="password"],input[type="number"],input:not([type])'));
  const control=target=>target?.closest?.(selector)||null;
  const visible=element=>element?.isConnected&&!element.matches(':disabled,[aria-disabled="true"]')&&!element.closest('[hidden],[inert]')&&element.getClientRects().length>0;
  const cancel=()=>{clearTimeout(timer);timer=0;pending=null};
  const reset=()=>{cancel();press=null;lastOrphan=null;lastInputLoss=-Infinity};
  window.addEventListener('focusout',event=>{if(editable(event.target))lastInputLoss=performance.now()},true);
  window.addEventListener('focusin',event=>{if(editable(event.target)){press=null;lastOrphan=null}},true);
  window.addEventListener('click',event=>{cancel();press=null;if(event.isTrusted)lastOrphan=null},true);
  window.addEventListener('pointerdown',event=>{
    if(event.pointerType!=='mouse'||event.button!==0||event.isTrusted===false)return;
    if(event.ctrlKey||event.metaKey||event.altKey||event.shiftKey){cancel();press=null;return}
    const target=control(event.target),now=performance.now();
    // A late press belongs to the release we are already recovering, not a drag.
    if(pending&&lastOrphan&&lastOrphan.target===target&&lastOrphan.id===event.pointerId&&now-lastOrphan.at<100){press=null;return}
    cancel();press={target,id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
  },true);
  window.addEventListener('pointermove',event=>{
    if(press&&event.pointerId===press.id&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>7)press.moved=true;
  },true);
  window.addEventListener('pointerup',event=>{
    if(event.pointerType!=='mouse'||event.button!==0||event.isPrimary===false||event.isTrusted===false)return;
    if(event.ctrlKey||event.metaKey||event.altKey||event.shiftKey){cancel();press=null;return}
    const previous=press,target=control(event.target);press=null;cancel();
    if(event.defaultPrevented||!visible(target))return;
    if(previous&&(previous.id!==event.pointerId||previous.target!==target||previous.moved))return;
    if(target.tagName==='SUMMARY'&&event.target.closest('a[href]'))return;
    const fromField=editable(document.activeElement)||performance.now()-lastInputLoss<1000;
    if(!fromField&&target.getAttribute('role')!=='tab')return;
    if(!previous)lastOrphan={target,id:event.pointerId,at:performance.now()};
    pending=target;
    timer=setTimeout(()=>{
      const candidate=pending;cancel();press=null;
      if(!visible(candidate)||document.hidden)return;
      // Autocomplete, reset and dialog handlers keep their own focus behavior.
      if(candidate.getAttribute('role')==='tab')candidate.focus({preventScroll:true});
      candidate.click();
      if(!editable(document.activeElement))lastInputLoss=-Infinity;
    },0);
  });
  window.addEventListener('pointercancel',reset,true);
  window.addEventListener('contextmenu',reset,true);
  window.addEventListener('blur',reset);
  window.addEventListener('keydown',cancel,true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)reset()});
})();
