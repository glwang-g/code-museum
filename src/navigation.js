(()=>{
  const route=window.MUSEUM_ROUTE,$=id=>document.getElementById(id);
  const tabs={'timeline-view':'river','lineage-view':'lineage','catalogue-view':'catalogue','lab-view':'lab','compare-view':'compare','sources-view':'about'};
  let restoring=false,scheduled=false,archive='',last='';
  function state(){
    const view=tabs[document.querySelector('.museum-tabs .active')?.id]||'river';
    return {view,language:view==='lab'?window.MUSEUM_LAB.current:['river','lineage'].includes(view)?activeId||archive:archive,layer:relationLayer,depth:relationScope,direction:relationDirection,levels:relationLevels,relation:inspectedRelation||'',topic:view==='lab'?window.MUSEUM_LAB.topic:$('compare-topic').value,left:$('compare-left').value,right:$('compare-right').value};
  }
  function save(){
    if(restoring||scheduled)return;scheduled=true;
    queueMicrotask(()=>{scheduled=false;if(restoring)return;const hash=route.serialize(state());if(hash===last)return;history.pushState(null,'',hash);last=hash;});
  }
  const originalSelect=select;select=function(id){const result=originalSelect(id);if(byId.has(id))archive=id;save();return result};
  for(const name of ['activateTab','setRelationLayer','setRelationScope','openRelationship']){
    const original=window[name];window[name]=function(...args){const result=original(...args);save();return result};
  }
  const originalOverview=restoreMapOverview;restoreMapOverview=function(){originalOverview();archive='';save()};
  window.MUSEUM_RELATIONS_UI.open=openRelationship;
  const originalClose=$('close').onclick;$('close').onclick=()=>{originalClose();if($('river').hidden)archive='';inspectedRelation=null;save()};
  function restore(){
    const s=route.parse(location.hash);restoring=true;
    try{
      archive='';restoreMapOverview();relationDirection=s.direction;relationLevels=s.levels;setRelationScope(s.depth);setRelationLayer(s.layer);
      if(s.view==='river'||s.view==='lineage'){
        setView(s.view==='lineage'?'lineage':'timeline');
        if(byId.has(s.language)){select(s.language);activeId=mapLanguageIds.has(s.language)?s.language:null;if(activeId)renderLineageFocus(activeId)}
        if(relationAudit.has(s.relation))openRelationship(s.relation);
      }else if(s.view==='lab'){
        // Show while the tab is hidden; restoring a link must not run a draft.
        const language=byId.has(s.language)?s.language:'javascript';
        window.MUSEUM_LAB.restore(language,s.topic);
        activateTab('lab-view');window.MUSEUM_LAB.stop();
      }else if(s.view==='compare'){
        const data=window.MUSEUM_LESSONS;
        const left=data.languages[s.left]?s.left:'c',right=data.languages[s.right]?s.right:'cpp';
        window.MUSEUM_COMPARE.open(left,right,data.topics.some(t=>t.id===s.topic)?s.topic:'functions');
      }else{
        activateTab(s.view==='about'?'sources-view':'catalogue-view');
        if(s.view==='catalogue'&&byId.has(s.language))select(s.language);
        if(s.view==='catalogue'&&relationAudit.has(s.relation))openRelationship(s.relation);
      }
      last=route.serialize(state());history.replaceState(null,'',last);
    }finally{restoring=false}
  }
  window.addEventListener('popstate',restore);window.addEventListener('hashchange',()=>{if(location.hash!==last)restore()});
  document.addEventListener('museum-lab-change',save);
  document.addEventListener('change',event=>{if(event.target.closest('#compare'))save()});
  $('compare-swap').addEventListener('click',save);
  let shareFeedbackTimer=0;
  function closeShareFeedback(){
    if(shareFeedbackTimer)clearTimeout(shareFeedbackTimer);
    shareFeedbackTimer=0;$('share-feedback').hidden=true;$('share-page').setAttribute('aria-expanded','false');
  }
  function showShareFeedback(message,shareUrl='',hold=2200){
    $('share-status').textContent=message;
    $('share-url').hidden=!shareUrl;$('share-url').value=shareUrl;
    $('share-feedback').hidden=false;$('share-page').setAttribute('aria-expanded','true');
    if(shareUrl){$('share-url').focus();$('share-url').select()}
    if(shareFeedbackTimer)clearTimeout(shareFeedbackTimer);
    shareFeedbackTimer=setTimeout(closeShareFeedback,hold);
  }
  $('share-page').onclick=async event=>{
    event.stopPropagation();
    const hash=route.serialize(state()),url=new URL(location.href);url.hash=hash;
    url.search=''; // Share navigation only, never incidental query parameters.
    try{await navigator.clipboard.writeText(url.href);showShareFeedback('已复制当前页面链接')}
    catch{showShareFeedback('复制此链接即可分享当前页面：',url.href,7000)}
  };
  document.addEventListener('click',event=>{if(!event.target.closest('.share-control'))closeShareFeedback()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeShareFeedback()});
  // Support is deliberately separate from exploration: it opens only on request,
  // does not report payments, and does not gate any museum content.
  const supportButton=document.createElement('button');
  supportButton.id='support-open';supportButton.className='support-trigger';supportButton.type='button';
  supportButton.setAttribute('aria-haspopup','dialog');supportButton.setAttribute('aria-label','请作者喝杯咖啡');supportButton.innerHTML='<span aria-hidden="true">☕</span> 请作者喝杯咖啡';
  document.querySelector('.header-tools .share-control').before(supportButton);
  const supportDialog=document.createElement('dialog');
  supportDialog.id='support-dialog';supportDialog.className='support-dialog';supportDialog.setAttribute('aria-labelledby','support-title');
  supportDialog.innerHTML='<button class="support-close" type="button" aria-label="关闭赞赏码">关闭 ×</button><div class="support-dialog-content"><img src="assets/support/coffee-appreciation-code.jpg" width="1152" height="1152" alt="微信赞赏码：心有戚戚焉，与君共饮。"><div><p class="eyebrow">VOLUNTARY SUPPORT</p><h2 id="support-title">请作者喝杯咖啡</h2><p>如果这座博物馆对你有一点帮助，欢迎扫码赞赏。</p><p class="support-boundary">完全自愿，所有内容仍免费开放；赞赏不购买功能，也不影响馆藏、研究或历史结论。</p></div></div>';
  document.body.append(supportDialog);
  const closeSupport=()=>supportDialog.close();
  supportButton.onclick=()=>{if(!supportDialog.open)supportDialog.showModal()};
  supportDialog.querySelector('.support-close').onclick=closeSupport;
  supportDialog.addEventListener('click',event=>{if(event.target===supportDialog)closeSupport()});
  supportDialog.addEventListener('close',()=>supportButton.focus());
  const supportCard=document.createElement('section');
  supportCard.className='project-support';supportCard.setAttribute('aria-labelledby','project-support-title');
  supportCard.innerHTML='<div><h3 id="project-support-title">支持这座博物馆</h3><p>如果它对你有一点帮助，欢迎请作者喝杯咖啡。完全自愿，所有内容仍免费开放。</p></div><button type="button" aria-haspopup="dialog">查看微信赞赏码</button>';
  document.querySelector('.provenance-intro').after(supportCard);
  supportCard.querySelector('button').onclick=()=>{if(!supportDialog.open)supportDialog.showModal()};
  const info=window.MUSEUM_BUILD_INFO;
  $('build-version').textContent='内容版本 '+info.contentSha256.slice(0,12)+' · '+(location.hostname==='codemuseum.freexlib.com'?'正式站':'本地 / 预览')+' · 版本由源码与固定数据生成。';
  window.MUSEUM_NAV={restore,state,save};
  restore();
})();
