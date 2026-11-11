// Reading-first exploration, backed by the same collection and relationship audit.
(()=>{
 const $=id=>document.getElementById(id),escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const data=window.MUSEUM_DATA,audit=window.MUSEUM_RELATIONSHIP_AUDIT,model=window.MUSEUM_EXPLORE_STATE;
 const records=new Map(data.records.map(r=>[r.id,r])),proofs=new Map(audit.relations.map(e=>[e.key,e]));
 let presentation='browse',language='',era='all',relation='',lastRender='';
 const view=()=>document.querySelector('.museum-tabs .active')?.id==='lineage-view'?'lineage':'river';
 const active=()=>['timeline-view','lineage-view'].includes(document.querySelector('.museum-tabs .active')?.id);
 const labels={'excerpt-recorded':'关系说明与原文摘录已存','field-only':'来源字段，关系待核','citation-only':'原文摘录待补','needs-direct-evidence':'直接设计依据待补'};
 const typeLabel=e=>({influencedBy:'设计影响',supersetOf:'超集 / 扩展',successorOf:'后继',implementationOf:'具体实现',compatibleWith:'语法兼容',extensionInterface:'扩展接口',hostRuntime:'宿主运行时',interop:'互操作'})[e.type]||e.type;
 const panel=document.createElement('section');panel.id='explore-panel';panel.className='explore-panel';panel.hidden=true;panel.setAttribute('role','tabpanel');
 panel.innerHTML='<header class="explore-heading"><div><p class="eyebrow" id="explore-kicker"></p><h2 id="explore-title"></h2><p id="explore-description"></p></div><div class="explore-modes" role="group" aria-label="展示方式"><button id="explore-browse" type="button" aria-pressed="true"></button><button id="explore-map" type="button" aria-pressed="false">完整图谱 ↗</button></div></header><div id="explore-content"></div><div id="explore-full-map"></div>';
 const map=$('river');map.before(panel);$('explore-full-map').append(map);map.setAttribute('role','region');
 function state(){return {presentation,language,era,relation}}
 function navigate(changes){const current=window.MUSEUM_NAV.state();location.hash=window.MUSEUM_ROUTE.serialize({...current,...changes}).slice(1)}
 function openView(target,id){navigate({view:target,presentation:'browse',language:id??(target==='lineage'?language||'javascript':''),relation:'',depth:'direct',layer:'design'})}
 function openLanguage(id){if(records.has(id))openView('lineage',id)}
 function openRelation(key){const edge=proofs.get(key);if(edge)navigate({view:'lineage',presentation:'browse',language:[edge.from,edge.to].includes(language)?language:edge.to,relation:key,layer:edge.layer,depth:'direct'})}
 function openArchive(id){navigate({view:'river',presentation:'map',language:id,relation:'',layer:'design',depth:'direct'})}
 function restore(s){
  presentation=s.presentation;era=model.timeline(data.records,s.era).era;language=records.has(s.language)?s.language:s.view==='lineage'?'javascript':'';relation=proofs.has(s.relation)?s.relation:'';
  if(presentation==='browse'&&relation){const edge=proofs.get(relation);if(![edge.from,edge.to].includes(language))language=edge.to;if(relationLayer!==edge.layer)setRelationLayer(edge.layer)}
 }
 const read=id=>`<button type="button" class="text-button" data-explore-read="${escape(id)}">进入阅读 →</button>`;
 function renderTimeline(){
  const result=model.timeline(data.records,era);era=result.era;
  return `<div class="explore-coverage"><span>按来源年代排列 · ${result.total} 个有线索地图节点</span><a href="#catalogue">检索全部 ${data.meta.count.toLocaleString()} 条馆藏 →</a></div>${language?`<div class="chronology-selection">当前语言：${escape(records.get(language).name)} ${read(language)}<button class="text-button" type="button" data-explore-language="${escape(language)}">查看关系 →</button></div>`:''}<div id="explore-eras" class="era-filter" role="group" aria-label="筛选年代">${['all',...result.eras].map(key=>`<button type="button" data-explore-era="${key}" aria-pressed="${key===era}">${key==='all'?'全部年代':key==='early'?'1940 以前':key+'s'}</button>`).join('')}</div><div class="chronology-list">${result.groups.map(([key,rows])=>`<section class="era-section"><h3>${key==='early'?'早期构想':key+'s'}<small>${rows.length} 条</small></h3><div class="era-entries">${rows.map(r=>`<button type="button" class="era-entry${language===r.id?' selected':''}" data-explore-read="${escape(r.id)}"><span>${escape(r.name)}</span><small>${r.year}</small></button>`).join('')}</div></section>`).join('')}</div><details class="chronology-background"><summary>计算史背景事件 · 与语言节点分别呈现</summary><p>这些是人物与机器背景，不表示现代语言的直接派生关系。</p><ul>${events.map(e=>`<li><span>${e.year}</span><a href="${escape(e.url)}" target="_blank" rel="noopener">${escape(e.name)} ↗</a></li>`).join('')}</ul></details>`;
 }
 function cards(edges,direction){return edges.map(edge=>{const id=direction==='up'?edge.from:edge.to,r=records.get(id);return `<article class="reading-relation" data-relation-key="${escape(edge.key)}"><button class="relation-language-link" type="button" data-explore-language="${escape(id)}">${escape(r.name)} <span aria-hidden="true">↗</span></button><p class="relation-type">${escape(typeLabel(edge))}</p><p class="relation-state" data-state="${edge.state}">${escape(labels[edge.state]||edge.state)}</p>${edge.label?`<p class="relation-claim">${escape(edge.label)}</p>`:''}<div class="relation-card-actions"><button type="button" data-explore-proof="${escape(edge.key)}">查看依据</button><a href="${escape(edge.source)}" target="_blank" rel="noopener">引用来源 ↗</a></div></article>`}).join('')||'<p class="relation-empty">此快照尚无记录，不表示没有历史关联。</p>'}
 function renderRelations(){
  if(!records.has(language))language='javascript';const r=records.get(language),groups=model.relations(audit.relations,language,relationLayer),design=relationLayer==='design';
  const ids=new Set(data.records.filter(r=>r.mapEligible).map(r=>r.id));for(const e of audit.relations){ids.add(e.from);ids.add(e.to)}ids.add(language);
  const options=[...ids].map(id=>records.get(id)).sort((a,b)=>a.name.localeCompare(b.name));
  return `<div class="relation-reading-toolbar"><label>观察语言 <select id="explore-language">${options.map(r=>`<option value="${escape(r.id)}"${r.id===language?' selected':''}>${escape(r.name)}</option>`).join('')}</select></label><div class="explore-layers" role="group" aria-label="关系层"><button type="button" data-explore-layer="design" aria-pressed="${design}">设计脉络</button><button type="button" data-explore-layer="ecosystem" aria-pressed="${!design}">实现与生态</button></div><a href="#catalogue">检索完整馆藏 →</a></div><div class="relation-reading-layout"><section class="relation-column" aria-label="${design?'已记录的设计输入':'关联的实现与平台'}"><h3>${design?'已记录的设计输入':'关联的实现与平台'}<small>${groups.incoming.length}</small></h3><div class="relation-card-list" tabindex="0">${cards(groups.incoming,'up')}</div></section><section class="relation-reading-center"><p class="eyebrow">${design?'LANGUAGE & DESIGN':'IMPLEMENTATION & ECOSYSTEM'}</p><h3>${escape(r.name)}</h3><p>${r.year||'年代待核'} · ${r.review?.status==='verified-language'?'已核语法与实现':r.review?.status==='historical-primary-source'?'已有历史一手资料':'馆藏记录，仍需核对'}</p><p>${escape(r.creators||'创造者尚待核对')}</p>${read(language)}<a class="text-button" href="${escape(r.source)}" target="_blank" rel="noopener">馆藏来源 ↗</a></section><section class="relation-column" aria-label="${design?'已记录的后续语言':'关联的后续实现与使用方'}"><h3>${design?'已记录的后续语言':'关联的后续实现与使用方'}<small>${groups.outgoing.length}</small></h3><div class="relation-card-list" tabindex="0">${cards(groups.outgoing,'down')}</div></section></div><p class="explore-boundary">${design?'设计影响、超集扩展与后继分别标记；缺失关系不等于没有上游。':'这里描述实现、平台或互操作，不表示语言继承。'}本页显示直接关系，层级、方向与全景探索可切换“完整图谱”。</p><section id="explore-proof" class="explore-proof" aria-label="关系依据"${relation?'':' hidden'}>${relation?proofContent():''}</section>`;
 }
 function proofContent(){return '<button id="explore-proof-close" type="button">收起依据 ×</button>'+window.MUSEUM_RELATIONS_UI.renderProof(relation)}
 function sync(){
  if(!active())return;const current=view(),lineage=current==='lineage';panel.setAttribute('aria-labelledby',lineage?'lineage-view':'timeline-view');
  $('explore-kicker').textContent=lineage?'NO LANGUAGE IS AN ISLAND':'A HISTORY OF IDEAS';$('explore-title').textContent=lineage?'关系谱系':'时间长河';
  $('explore-description').textContent=lineage?'从一门语言看已记录的设计输入与后续，每一步都能回到出处。':'按馆藏来源年代展开阅读。年代不表示影响关系，完整馆藏始终可以检索。';
  $('explore-browse').textContent=lineage?'关系阅读':'年代索引';$('explore-browse').setAttribute('aria-pressed',String(presentation==='browse'));$('explore-map').setAttribute('aria-pressed',String(presentation==='map'));
  $('explore-content').hidden=presentation==='map';$('explore-full-map').hidden=presentation!=='map';
  const signature=[current,presentation,language,era,relation,relationLayer].join(':');if(presentation==='map'||signature===lastRender)return;lastRender=signature;
  const eraFocus=document.activeElement?.closest('#explore-eras'),languageFocus=document.activeElement?.id==='explore-language';$('explore-content').innerHTML=lineage?renderRelations():renderTimeline();
  if(eraFocus)$('explore-eras')?.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
  if($('explore-language')){$('explore-language').onchange=()=>openLanguage($('explore-language').value);if(languageFocus)$('explore-language').focus({preventScroll:true})}
 }
 function openProof(key){
  if(!active()||presentation!=='browse'||view()!=='lineage'||!proofs.has(key))return false;
  relation=key;const edge=proofs.get(key);if(![edge.from,edge.to].includes(language))language=edge.to;if(relationLayer!==edge.layer)setRelationLayer(edge.layer);lastRender='';sync();
  const heading=$('explore-proof').querySelector('h2');heading.tabIndex=-1;heading.focus({preventScroll:true});$('explore-proof').scrollIntoView({block:'start'});window.MUSEUM_NAV?.save();return true;
 }
 $('explore-browse').onclick=()=>navigate({view:view(),presentation:'browse',relation:'',language:window.MUSEUM_NAV.state().language||language,depth:'direct'});
 $('explore-map').onclick=()=>navigate({view:view(),presentation:'map',relation:''});
 $('timeline-view').onclick=()=>openView('river');$('lineage-view').onclick=()=>openView('lineage');
 panel.addEventListener('click',event=>{
  const target=event.target.closest('button');if(!target)return;
  if(target.dataset.exploreRead){window.MUSEUM_GALLERY.openReading(target.dataset.exploreRead);return}
  if(target.dataset.exploreLanguage){openLanguage(target.dataset.exploreLanguage);return}
  if(target.dataset.exploreEra){navigate({view:'river',presentation:'browse',era:target.dataset.exploreEra,relation:''});return}
  if(target.dataset.exploreLayer){navigate({view:'lineage',presentation:'browse',layer:target.dataset.exploreLayer,relation:''});return}
  if(target.dataset.exploreProof){openProof(target.dataset.exploreProof);return}
  if(target.dataset.relationEndpoint){openLanguage(target.dataset.relationEndpoint);return}
  if(target.id==='explore-proof-close')navigate({view:'lineage',presentation:'browse',relation:''});
 });
 document.addEventListener('museum-view-change',sync);
 window.MUSEUM_EXPLORE={state,restore,openView,openLanguage,openRelation,openArchive,openProof};
})();
