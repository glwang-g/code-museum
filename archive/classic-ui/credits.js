(() => {
  const data=window.MUSEUM_CREDITS,searcher=window.MUSEUM_CREDIT_SEARCH,container=document.querySelector('#open-source-credits');
  if(!data||!container||!searcher)return;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const link=(href,label)=>`<a href="${escape(href)}"${href.startsWith('https://')?' target="_blank" rel="noreferrer"':''}>${escape(label)} ↗</a>`;
  const categories={'runtime-credits':'语言运行环境','data-credits':'馆藏数据','reference-credits':'榜单参考','relationship-coverage':'关系核对','catalogue-boundaries':'历史依据与边界','project-info':'项目与支持'};
  const categoryFor=id=>id==='remote-runtime-credits'?'runtime-credits':id;
  const names=new Map((window.MUSEUM_DATA?.records||[]).map(row=>[row.id,row.name]));
  const entries=[],byEntry=new Map();let indexed=[],shown=[],selected='',active='';
  const special=[['relationship-coverage','关系证据核对','relationship-coverage'],['catalogue-boundaries','历史依据与馆藏边界','credit-panel-catalogue-boundaries']].map(([id,name,nodeId])=>({id,name,category:id,node:document.getElementById(nodeId)}));
  container.innerHTML=`<div class="credits-workspace"><aside class="credits-directory" aria-label="出处目录"><label for="credit-search">查找条目</label><div class="credit-search-row"><input id="credit-search" type="search" maxlength="120" placeholder="名称、语言、版本、用途、许可" autocomplete="off"><button id="credit-search-clear" type="button" aria-label="清空出处搜索" hidden>清空</button></div><label class="credit-category-label" for="credit-category">分类<select id="credit-category"><option value="all">全部分类</option>${Object.entries(categories).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></label><p id="credit-result-count" role="status" aria-live="polite"></p><div id="credit-list" class="credit-list" role="listbox" aria-label="出处条目，使用上下方向键选择" tabindex="0"></div></aside><section id="credit-detail" class="credits-detail" aria-label="条目详情" tabindex="0"><div id="credit-empty" hidden><h3>没有匹配的条目</h3><p>可以尝试名称、语言或版本，或清除筛选。</p><button id="credit-reset-filters" type="button">清除筛选</button></div></section></div>`;
  const get=id=>document.getElementById(id),input=get('credit-search'),category=get('credit-category'),list=get('credit-list'),detail=get('credit-detail'),empty=get('credit-empty'),clear=get('credit-search-clear');
  function add(row){
    if(!row.node||entries.some(entry=>entry.id===row.id))return;
    if(!row.node.id)row.node.id='credit-'+row.id;
    row.node.hidden=true;row.node.classList.add('credit-detail-entry');detail.append(row.node);entries.push(row);
  }
  for(const group of data.groups)for(const entry of group.entries){
    const node=document.createElement('article');node.className='credit-card';node.id='credit-'+entry.id;node.tabIndex=-1;
    node.innerHTML=`<p class="credit-context">${escape(group.title)} · ${escape(group.intro)}</p><div class="credit-heading"><h4 id="credit-title-${escape(entry.id)}">${escape(entry.name)}</h4><span>${escape(entry.versionLabel||entry.kind||'')}</span></div><p>${escape(entry.usage)}</p><dl>${entry.adaptation?`<dt>本项目的适配</dt><dd>${escape(entry.adaptation)}</dd>`:''}<dt>范围与限制</dt><dd>${escape(entry.limits)}</dd>${entry.licenseNote?`<dt>许可与版权</dt><dd>${escape(entry.licenseNote)}</dd>`:''}</dl><div class="credit-links">${[link(entry.project,'项目 / 原始资料'),entry.repository&&entry.repository!==entry.project?link(entry.repository,'源码仓库'):'',...(entry.notices||[]).map(notice=>link(notice.href,notice.label)),entry.source?link(entry.source,entry.manifest?'固定发布来源':'快照 / 引用来源'):'',entry.evidence?link(entry.evidence,'版本与证据记录'):''].filter(Boolean).join('')}</div>${entry.commit?`<p class="credit-revision">源码提交：<code>${escape(entry.commit)}</code></p>`:''}`;
    const languages=[...(entry.languages||[]),...(entry.runtimeIds||[])];
    add({id:entry.id,name:entry.name,category:categoryFor(group.id),version:entry.versionLabel||entry.kind||'',node,searchText:[group.title,entry.id,entry.versionLabel,entry.version,entry.kind,entry.usage,entry.adaptation,entry.limits,entry.licenseNote,JSON.stringify(entry.license||''),...(entry.notices||[]).map(n=>n.label),...languages,...languages.map(id=>names.get(id)||'')].filter(Boolean).join(' ')});
    byEntry.set(entry.id,entry);
  }
  for(const row of special){if(row.node){row.node.removeAttribute('role');row.node.removeAttribute('aria-labelledby');add({...row,version:'说明与核对记录',searchText:row.node.textContent+' '+row.name})}}
  const project=document.createElement('article');project.className='credit-card';project.id='credit-project-info';project.innerHTML='<div class="credit-heading"><h4>项目与版本</h4></div><p>本网站由源码与固定资料构建，版本记录位于页面标题旁。完整馆藏入口、关系依据及运行边界分别保留。</p><p class="project-links">项目入口：<a href="https://codemuseum.freexlib.com" target="_blank" rel="noreferrer">正式网站 ↗</a> · <a href="https://github.com/glwang-g/code-museum" target="_blank" rel="noreferrer">源码仓库 ↗</a> · <a href="https://github.com/glwang-g/code-museum/blob/master/README.md" target="_blank" rel="noreferrer">README ↗</a></p>';
  add({id:'project-info',name:'项目与版本',category:'project-info',version:'网站、源码与README',node:project,searchText:project.textContent+' Code Museum GitHub README 版本'});
  function show(id,focus=false){
    const row=entries.find(entry=>entry.id===id),changed=active!==id;selected=row?.id||'';active=selected;detail.dataset.selected=selected;
    for(const entry of entries)entry.node.hidden=entry.id!==selected;
    empty.hidden=!!row;
    for(const button of list.querySelectorAll('[role="option"]'))button.setAttribute('aria-selected',String(button.dataset.creditId===selected));
    const option=selected?get('credit-option-'+selected):null;
    if(option)list.setAttribute('aria-activedescendant',option.id);else list.removeAttribute('aria-activedescendant');
    const heading=row?.node.querySelector('h3,h4');if(heading){if(!heading.id)heading.id='credit-title-'+selected;detail.setAttribute('aria-labelledby',heading.id)}else detail.removeAttribute('aria-labelledby');
    if(changed)detail.scrollTop=0;
    if(focus){option?.scrollIntoView({block:'nearest'});detail.focus({preventScroll:true})}
  }
  function render(){
    shown=searcher.search(indexed,input.value,category.value);clear.hidden=!input.value;
    get('credit-result-count').textContent='显示 '+shown.length+' / '+entries.length+' 项';
    list.replaceChildren(...shown.map(row=>{const button=document.createElement('button');button.type='button';button.className='credit-option';button.id='credit-option-'+row.id;button.dataset.creditId=row.id;button.setAttribute('role','option');button.tabIndex=-1;const name=document.createElement('span'),meta=document.createElement('span');name.className='credit-option-name';name.textContent=row.name;meta.className='credit-option-meta';meta.textContent=categories[row.category]+(row.version?' · '+row.version:'');button.append(name,meta);return button}));
    show(shown.some(row=>row.id===selected)?selected:shown[0]?.id||'');
    if(!shown.length){const p=document.createElement('p');p.className='credit-list-empty';p.textContent='没有匹配条目';list.append(p)}
  }
  input.addEventListener('input',()=>{list.scrollTop=0;render()});category.addEventListener('change',()=>{list.scrollTop=0;render()});
  clear.addEventListener('click',()=>{input.value='';render();input.focus()});
  get('credit-reset-filters').addEventListener('click',()=>{input.value='';category.value='all';render();input.focus()});
  list.addEventListener('click',event=>{const option=event.target.closest('[data-credit-id]');if(option){show(option.dataset.creditId);list.focus({preventScroll:true})}});
  list.addEventListener('keydown',event=>{
    if(event.key==='Enter'){event.preventDefault();detail.focus({preventScroll:true});return}
    if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key)||!shown.length)return;
    event.preventDefault();const index=shown.findIndex(row=>row.id===selected),next=event.key==='Home'?0:event.key==='End'?shown.length-1:Math.max(0,Math.min(shown.length-1,index+(event.key==='ArrowUp'?-1:1)));
    show(shown[next].id);get('credit-option-'+selected)?.scrollIntoView({block:'nearest'});
  });
  function open(id,anchorId=''){
    document.querySelector('#sources-view').click();input.value='';category.value=categories[categoryFor(id)]?categoryFor(id):'all';
    const anchor=anchorId?document.getElementById(anchorId):null;
    const row=anchor?entries.find(entry=>entry.node===anchor||entry.node.contains(anchor)):entries.find(entry=>entry.id===id);
    if(row){category.value=anchor?'all':row.category;selected=row.id}render();if(row)show(row.id,true);else if(selected)show(selected,true);
  }
  window.MUSEUM_CREDITS_UI={
    open,
    registerSection(id,name,node,keywords=''){add({id,name,node,category:'project-info',version:'项目说明',searchText:name+' '+node.textContent+' '+keywords});indexed=searcher.index(entries);render()},
    labelFor(language){const entry=[...byEntry.values()].find(item=>item.languages?.includes(language));return entry?`${entry.versionLabel||entry.name} · 项目与许可 ↗`:null},
    openFor(language){const entry=[...byEntry.values()].find(item=>item.languages?.includes(language));if(entry)open('runtime-credits','credit-'+entry.id)},
    openRemoteFor(language){const entry=[...byEntry.values()].find(item=>item.runtimeIds?.includes(language));if(entry)open('runtime-credits','credit-'+entry.id)}
  };
  indexed=searcher.index(entries);render();
})();
