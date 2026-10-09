(() => {
  const data=window.MUSEUM_CREDITS;
  const container=document.querySelector('#open-source-credits');
  if(!data||!container)return;
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const link=(href,label)=>`<a href="${escape(href)}"${href.startsWith('https://')?' target="_blank" rel="noreferrer"':''}>${escape(label)} ↗</a>`;
  const entries=data.groups.flatMap(group=>group.entries);
  container.innerHTML=data.groups.map(group=>`<section class="credit-group" aria-labelledby="${escape(group.id)}"><h3 id="${escape(group.id)}" tabindex="-1">${escape(group.title)}</h3><p>${escape(group.intro)}</p><div class="credit-grid">${group.entries.map(entry=>`<article class="credit-card" id="credit-${escape(entry.id)}" tabindex="-1"><div class="credit-heading"><h4>${escape(entry.name)}</h4><span>${escape(entry.versionLabel||entry.kind)}</span></div><p>${escape(entry.usage)}</p><dl><dt>本项目的适配</dt><dd>${escape(entry.adaptation)}</dd><dt>范围与限制</dt><dd>${escape(entry.limits)}</dd>${entry.licenseNote?`<dt>许可与版权</dt><dd>${escape(entry.licenseNote)}</dd>`:''}</dl><div class="credit-links">${[link(entry.project,'项目 / 原始资料'),entry.repository&&entry.repository!==entry.project?link(entry.repository,'源码仓库'):'',...(entry.notices||[]).map(notice=>link(notice.href,notice.label)),entry.source?link(entry.source,entry.manifest?'固定发布来源':'快照 / 引用来源'):'',entry.evidence?link(entry.evidence,'版本与证据记录'):''].filter(Boolean).join('')}</div>${entry.commit?`<p class="credit-revision">源码提交：<code>${escape(entry.commit)}</code></p>`:''}</article>`).join('')}</div></section>`).join('');
  function open(id){
    document.querySelector('#sources-view').click();
    const target=document.getElementById(id),panel=document.querySelector('#about');
    if(!target)return;
    panel.scrollTo({top:panel.scrollTop+target.getBoundingClientRect().top-panel.getBoundingClientRect().top-16,behavior:'instant'});
    target.focus({preventScroll:true});
  }
  document.querySelectorAll('[data-credit-target]').forEach(button=>button.addEventListener('click',()=>open(button.dataset.creditTarget)));
  window.MUSEUM_CREDITS_UI={
    labelFor(language){const entry=entries.find(entry=>entry.languages?.includes(language));return entry?`${entry.versionLabel||entry.name} · 项目与许可 ↗`:null},
    openFor(language){const entry=entries.find(entry=>entry.languages?.includes(language));if(entry)open(`credit-${entry.id}`)},
    openRemoteFor(language){const entry=entries.find(entry=>entry.runtimeIds?.includes(language));if(entry)open(`credit-${entry.id}`)}
  };
})();
