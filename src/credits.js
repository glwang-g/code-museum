(() => {
  const data=window.MUSEUM_CREDITS;
  const container=document.querySelector('#open-source-credits');
  if(!data||!container)return;
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const link=(href,label)=>`<a href="${escape(href)}"${href.startsWith('https://')?' target="_blank" rel="noreferrer"':''}>${escape(label)} ↗</a>`;
  const groupTab=id=>id==='remote-runtime-credits'?'runtime-credits':id;
  const entryTabs=new Map();
  const groupHTML=group=>`<section class="credit-group" aria-labelledby="${escape(group.id)}"><h3 id="${escape(group.id)}" tabindex="-1">${escape(group.title)}</h3><p>${escape(group.intro)}</p><div class="credit-grid">${group.entries.map(entry=>{entryTabs.set(entry.id,groupTab(group.id));return `<article class="credit-card" id="credit-${escape(entry.id)}" tabindex="-1"><div class="credit-heading"><h4>${escape(entry.name)}</h4><span>${escape(entry.versionLabel||entry.kind)}</span></div><p>${escape(entry.usage)}</p><dl><dt>本项目的适配</dt><dd>${escape(entry.adaptation)}</dd><dt>范围与限制</dt><dd>${escape(entry.limits)}</dd>${entry.licenseNote?`<dt>许可与版权</dt><dd>${escape(entry.licenseNote)}</dd>`:''}</dl><div class="credit-links">${[link(entry.project,'项目 / 原始资料'),entry.repository&&entry.repository!==entry.project?link(entry.repository,'源码仓库'):'',...(entry.notices||[]).map(notice=>link(notice.href,notice.label)),entry.source?link(entry.source,entry.manifest?'固定发布来源':'快照 / 引用来源'):'',entry.evidence?link(entry.evidence,'版本与证据记录'):''].filter(Boolean).join('')}</div>${entry.commit?`<p class="credit-revision">源码提交：<code>${escape(entry.commit)}</code></p>`:''}</article>`}).join('')}</div></section>`;
  const projectLinks='<p class="project-links">项目入口：<a href="https://codemuseum.freexlib.com" target="_blank" rel="noreferrer">正式网站 ↗</a> · <a href="https://github.com/glwang-g/codemuseum" target="_blank" rel="noreferrer">源码仓库 ↗</a> · <a href="https://github.com/glwang-g/codemuseum/blob/master/README.md" target="_blank" rel="noreferrer">README ↗</a></p>';
  const tabs=['runtime-credits','data-credits','reference-credits'];
  container.innerHTML=projectLinks+tabs.map(tab=>`<section class="credit-panel" id="credit-panel-${tab}" role="tabpanel" aria-labelledby="credit-tab-${tab}">${data.groups.filter(group=>groupTab(group.id)===tab).map(groupHTML).join('')}</section>`).join('');
  const buttons=[...document.querySelectorAll('[data-credit-target]')];
  const ids=buttons.map(button=>button.dataset.creditTarget);
  function activate(id,anchorId=''){
    if(!ids.includes(id))id=ids[0];
    buttons.forEach(button=>{const active=button.dataset.creditTarget===id;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
    document.querySelectorAll('.credit-panel').forEach(panel=>{panel.hidden=panel.id!=='credit-panel-'+id});
    const relationship=document.querySelector('#relationship-coverage');
    if(relationship)relationship.hidden=id!=='relationship-coverage';
    const historical=document.querySelector('.historical-sources');
    if(historical)historical.hidden=id!=='catalogue-boundaries';
    const panel=document.querySelector('#about');
    if(panel)panel.scrollTop=0;
    if(!anchorId)return;
    const target=document.getElementById(anchorId);
    if(!target||!panel)return;
    panel.scrollTo({top:panel.scrollTop+target.getBoundingClientRect().top-panel.getBoundingClientRect().top-16,behavior:'instant'});
    target.focus({preventScroll:true});
  }
  function open(id){document.querySelector('#sources-view').click();activate(id)}
  buttons.forEach((button,index)=>button.addEventListener('click',()=>open(button.dataset.creditTarget)));
  buttons.forEach(button=>button.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    const current=ids.indexOf(button.dataset.creditTarget);
    const next=event.key==='Home'?0:event.key==='End'?ids.length-1:(current+(event.key==='ArrowLeft'?-1:1)+ids.length)%ids.length;
    buttons[next].focus();activate(ids[next]);
  }));
  window.MUSEUM_CREDITS_UI={
    labelFor(language){const entry=data.groups.flatMap(group=>group.entries).find(item=>item.languages?.includes(language));return entry?`${entry.versionLabel||entry.name} · 项目与许可 ↗`:null},
    openFor(language){const entry=data.groups.flatMap(group=>group.entries).find(item=>item.languages?.includes(language));if(entry)open(entryTabs.get(entry.id)||'runtime-credits')},
    openRemoteFor(language){const entry=data.groups.flatMap(group=>group.entries).find(item=>item.runtimeIds?.includes(language));if(entry)open(entryTabs.get(entry.id)||'runtime-credits')}
  };
  activate(ids[0]);
})();
