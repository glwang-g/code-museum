const $=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL=value=>{try{const u=new URL(value,location.origin);return ['https:','http:'].includes(u.protocol)?u.href:'#'}catch{return '#'}};
const data=await Promise.all(['catalogue','execution-capabilities','language-exhibits','learning-paths','relationship-status'].map(async name=>{const r=await fetch('/classic/data/'+name+'.json');if(!r.ok)throw new Error('固定资料加载失败：'+name);return r.json()})).catch(error=>{document.querySelector('main').textContent=error.message;throw error});
const [catalogue,capabilities,exhibits,paths,relationships]=data;
const byId=new Map(catalogue.records.map(r=>[r.id,r])),runtimes=new Map(capabilities.languages.map(r=>[r.id,r])),exhibitById=new Map(exhibits.exhibits.map(r=>[r.id,r])),examples=new Map(window.MUSEUM_LAB_EXAMPLES.map(r=>[r.id,r]));
const allEdges=[...catalogue.edges,...catalogue.ecosystemEdges],designEdges=catalogue.edges,lessons=window.MUSEUM_LESSONS;
const marks={javascript:'JS',python:'Py',lua:'Lu',scheme:'λ',c:'C',cpp:'C++',rust:'Rs',java:'Jv',typescript:'TS','csharp':'C#',lisp:'λ',go:'Go'};
const mark=id=>marks[id]||(byId.get(id)?.name||id).slice(0,2);
const number=n=>n.toLocaleString('en-US');
const normalized=text=>String(text??'').normalize('NFKC').toLowerCase().trim();
const searchIndex=new Map(catalogue.records.map(r=>[r.id,normalized([r.name,r.id,r.aliases,r.creators].join(' '))]));
const matches=(r,query)=>normalized(query).split(/\s+/).every(q=>searchIndex.get(r.id).includes(q));
const sortedRecords=[...catalogue.records].sort((a,b)=>a.name.localeCompare(b.name,'en',{numeric:true}));
const stateLabel=r=>r.review?.status==='verified-language'?'已核实现':r.review?.status==='historical-primary-source'?'历史资料':r.language?'待核馆藏':'相关记录';
const modeLabel=id=>runtimes.get(id)?.local?'浏览器运行':runtimes.get(id)?.remote?'远端配置':'尚未接入';
const relationType=edge=>edge.type==='supersetOf'?'超集 / 扩展':edge.type==='influencedBy'?'设计影响':edge.label||'实现与生态';
let cataloguePage=0,filter='all',exploreMode='guide',allRoutes=false,view='explore',toastTimer;
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3500)}
function showDialog(id){const d=$(id);if(!d.open)d.showModal()}
function closeDialogs(){for(const d of document.querySelectorAll('dialog[open]'))d.close()}
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()}});
function navigate(next){if(location.hash==='#'+next)route();else location.hash=next}
function route(){
 const [next,language,topic]=location.hash.slice(1).split('/');view=['collection','lab'].includes(next)?next:'explore';
 for(const [id,name] of [['explore-view','explore'],['collection-view','collection'],['lab','lab']])$(id).hidden=view!==name;
 for(const a of document.querySelectorAll('[data-nav]')){if(a.dataset.nav===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')}
 closeDialogs();if(view!=='lab'&&worker)stopExecution('已离开实验台，运行已停止。');
 if(view==='lab'&&language&&byId.has(language))selectLanguage(language,topic||'default');
 if(view==='collection')renderCatalogue();
 window.scrollTo({top:0,behavior:'instant'});
}
window.addEventListener('hashchange',route);
function setExplore(mode){exploreMode=mode;for(const b of document.querySelectorAll('[data-explore]'))b.setAttribute('aria-pressed',String(b.dataset.explore===mode));for(const id of ['guide','time','relations'])$(id+'-pane').hidden=id!==mode;if(mode==='time')renderTimeline();if(mode==='relations')renderRelations();}
for(const b of document.querySelectorAll('[data-explore]'))b.onclick=()=>setExplore(b.dataset.explore);
$('start-explore').onclick=()=>setExplore('time');$('map-more').onclick=()=>{setExplore('relations');$('relation-language').value='javascript';renderRelations()};
$('theme').onclick=()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='light'?'dark':'light';rememberTheme()};
function rememberTheme(){const dark=document.documentElement.dataset.theme==='dark';$('theme').setAttribute('aria-label',dark?'切换浅色主题':'切换深色主题');try{localStorage.setItem('code-museum-modern-theme',dark?'dark':'light')}catch{}}
try{if(localStorage.getItem('code-museum-modern-theme')==='dark')document.documentElement.dataset.theme='dark'}catch{}rememberTheme();
const verifiedCount=catalogue.records.filter(r=>r.review?.status==='verified-language').length;
$('collection-facts').innerHTML=[[catalogue.meta.count,'馆藏条目'],[catalogue.meta.languages,'语言记录'],[capabilities.languages.length,'已配置执行环境'],[relationships.summary.states['excerpt-recorded'],'关系已有摘录']].map(([n,label])=>`<div><strong>${number(n)}</strong><span>${label}</span></div>`).join('')+'<p>来自固定馆藏资料 · 覆盖范围有明确说明</p>';
$('about-summary').innerHTML='<div class="about-counts">'+[[catalogue.meta.count,'固定馆藏条目'],[catalogue.meta.languages,'来源标记为语言'],[verifiedCount,'已核实现语言'],[relationships.summary.relations,'已记录关系']].map(([n,t])=>`<div><strong>${number(n)}</strong>${t}</div>`).join('')+'</div>';
$('about').onclick=()=>showDialog('about-dialog');
function renderMiniMap(){
 const points={lisp:[14,24],scheme:[47,21],self:[47,79],java:[14,79],javascript:[79,50]};
 const edges=designEdges.filter(e=>points[e.from]&&points[e.to]);
 $('mini-map').innerHTML='<svg viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="mini-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" style="fill:none;stroke:#a1b8a1;stroke-width:1"/></marker></defs>'+edges.map(e=>{const [x,y]=points[e.from],[tx,ty]=points[e.to];return `<path d="M${x*10+48},${y*5} C${(x+tx)*5},${y*5} ${(x+tx)*5},${ty*5} ${tx*10-45},${ty*5}" marker-end="url(#mini-arrow)"/>`}).join('')+'</svg>'+Object.entries(points).map(([id,[x,y]])=>`<button type="button" class="map-node ${id==='javascript'?'focus-node':''}" data-language="${id}" style="left:${x}%;top:${y}%"><small>${byId.get(id).year}</small>${escape(byId.get(id).name)}</button>`).join('');
}
renderMiniMap();
function renderRoutes(){
 $('route-grid').innerHTML=paths.routes.slice(0,allRoutes?paths.routes.length:3).map((r,i)=>`<button class="route-card" type="button" data-route="${escape(r.id)}"><span class="route-meta">策展导览 · ${r.steps.length} 个停靠点</span><span class="route-number" aria-hidden="true">0${i+1}</span><h3>${escape(r.title)}</h3><p>${escape(r.description)}</p><span class="card-arrow" aria-hidden="true">↗</span></button>`).join('');$('all-routes').textContent=allRoutes?'收起导览 ↑':'全部 '+paths.routes.length+' 条导览 ↗';
}
$('all-routes').onclick=()=>{allRoutes=!allRoutes;renderRoutes()};renderRoutes();
$('featured-grid').innerHTML=['python','javascript','c','rust'].map(id=>{const r=byId.get(id),e=exhibitById.get(id);return `<button class="language-card" type="button" data-language="${id}"><div class="language-card-head"><span class="language-mark">${mark(id)}</span><div><h3>${escape(r.name)}</h3><small>${r.year} · ${modeLabel(id)}</small></div></div><p>${escape(e?.purpose||r.creators)}</p></button>`}).join('');
function openRoute(id){
 const r=paths.routes.find(row=>row.id===id);if(!r)return;
 $('route-content').innerHTML=`<p class="eyebrow">A GUIDED WALK</p><h2 id="route-title">${escape(r.title)}</h2><p>${escape(r.description)}</p><ol class="route-steps">${r.steps.map((s,i)=>`<li><div><h3>${escape(s.title)}</h3><p>${escape(s.note)}</p></div><button type="button" data-route-action="${i}" data-route-id="${escape(id)}">打开 ↗</button></li>`).join('')}</ol>`;showDialog('route-dialog');
}
function openProof(edge){
 if(!edge)return;const from=byId.get(edge.from),to=byId.get(edge.to);
 $('detail-content').innerHTML=`<p class="eyebrow">FOLLOW THE EVIDENCE</p><div class="detail-title-row"><h2 id="detail-title">${escape(from?.name||edge.from)} → ${escape(to?.name||edge.to)}</h2></div><p class="detail-purpose">${escape(edge.label||relationType(edge))}</p><p class="relation-note">${edge.evidence?'馆内已存原文依据摘录；仍应结合完整原文核读。':'此关系目前来自来源字段，尚无馆内原文摘录。'}</p>${edge.evidence?`<div class="source-quote">${escape(edge.evidence)}</div>`:''}<div class="detail-section detail-sources"><a href="${escape(safeURL(edge.source))}" target="_blank" rel="noopener">打开关系来源 ↗</a></div><div class="detail-actions"><button class="button secondary" type="button" data-language="${escape(edge.from)}">${escape(from?.name||edge.from)} 档案</button><button class="button secondary" type="button" data-language="${escape(edge.to)}">${escape(to?.name||edge.to)} 档案</button></div>`;showDialog('detail-dialog');
}
function openComparison(step){
 const topic=lessons.topics.find(t=>t.id===step.topic),ids=[step.left,step.right];
 $('route-content').innerHTML=`<p class="eyebrow">THE SAME TASK, TWO LANGUAGES</p><h2 id="route-title">${escape(byId.get(step.left)?.name)} / ${escape(byId.get(step.right)?.name)}</h2><p>${escape(topic?.task||'同题代码对比；相似写法不表示历史继承。')}</p><div class="compare-code">${ids.map(id=>`<div><h3>${escape(byId.get(id)?.name)}</h3><pre>${escape(lessons.languages[id]?.examples[step.topic]?.code||'该主题暂无馆内示例。')}</pre><button type="button" data-lab-language="${escape(id)}" data-topic="${escape(step.topic)}">在实验台中打开 →</button></div>`).join('')}</div>`;showDialog('route-dialog');
}
function openDetail(id){
 if($('search-dialog').open)$('search-dialog').close();
 const r=byId.get(id);if(!r)return;const e=exhibitById.get(id),edges=allEdges.filter(edge=>edge.from===id||edge.to===id),sources=r.review?.sources||[];
 $('detail-content').innerHTML=`<p class="eyebrow">FROM THE COLLECTION</p><div class="detail-title-row"><span class="language-mark">${escape(mark(id))}</span><div><h2 id="detail-title">${escape(r.name)}</h2><p>${r.year||'年代待核'} · ${stateLabel(r)}</p></div></div><p class="detail-purpose">${escape(e?.purpose||r.review?.notes||'这是一条完整馆藏中的记录，详细历史与语言身份仍需继续核对。')}</p><dl class="detail-meta"><dt>创造者</dt><dd>${escape(r.creators||'来源尚未补齐')}</dd><dt>执行环境</dt><dd>${modeLabel(id)}${runtimes.get(id)?.remote?' · 本地预览未连接远端服务':''}</dd><dt>记录别名</dt><dd>${escape(r.aliases||'未记录')}</dd></dl><div class="detail-actions"><button class="button primary" data-lab-language="${escape(id)}" type="button">${examples.has(id)?'打开示例':'打开代码草稿'} →</button><button class="button secondary" type="button" data-show-relations="${escape(id)}">查看语言关系 ↗</button></div>${e?`<section class="detail-section"><h3>它为什么这样设计</h3><p>${escape(e.history)}</p></section><section class="detail-section"><h3>先理解这几件事</h3><ul>${e.rules.map(t=>'<li>'+escape(t)+'</li>').join('')}</ul></section><section class="detail-section"><h3>版本与边界</h3><p>${escape(e.boundary)}</p></section>`:''}<section class="detail-section"><h3>已记录的直接关系 <small>(${edges.length})</small></h3>${edges.length?edges.slice(0,12).map(edge=>`<div class="detail-relation"><button type="button" data-proof="${escape(edge.from+'|'+edge.to+'|'+edge.type)}">${escape(byId.get(edge.from)?.name||edge.from)} → ${escape(byId.get(edge.to)?.name||edge.to)}</button><small>${edge.evidence?'已有摘录':'来源字段'}</small></div>`).join(''):'<p>尚无记录，不表示没有上游。</p>'}${edges.length>12?'<p>更多关系可在关系谱系中查看。</p>':''}</section><section class="detail-section"><h3>回到来源</h3><div class="detail-sources">${sources.map(s=>`<a href="${escape(safeURL(s.url))}" target="_blank" rel="noopener">${escape(s.role)}资料 ↗</a>`).join('')}<a href="${escape(safeURL(r.source))}" target="_blank" rel="noopener">原始馆藏记录 ↗</a>${(e?.historySources||[]).map(s=>`<a href="${escape(safeURL(s.url))}" target="_blank" rel="noopener">${escape(s.title)} ↗</a>`).join('')}</div></section>`;
 showDialog('detail-dialog');$('detail-dialog').scrollTop=0;
}
document.addEventListener('click',event=>{
 const b=event.target.closest('[data-language],[data-route],[data-lab-language],[data-proof],[data-show-relations],[data-route-action]');if(!b)return;
 if(b.dataset.language)openDetail(b.dataset.language);
 else if(b.dataset.route)openRoute(b.dataset.route);
 else if(b.dataset.labLanguage){closeDialogs();openLab(b.dataset.labLanguage,b.dataset.topic||'default')}
 else if(b.dataset.proof)openProof(allEdges.find(e=>e.from+'|'+e.to+'|'+e.type===b.dataset.proof));
 else if(b.dataset.showRelations){closeDialogs();navigate('explore');$('relation-language').value=b.dataset.showRelations;setExplore('relations')}
 else if(b.dataset.routeAction){const step=paths.routes.find(r=>r.id===b.dataset.routeId)?.steps[Number(b.dataset.routeAction)];if(!step)return;if(step.action==='archive')openDetail(step.language);else if(step.action==='proof')openProof(allEdges.find(e=>e.from+'|'+e.to+'|'+e.type===step.key));else if(step.action==='compare')openComparison(step);else{closeDialogs();openLab(step.language,step.topic||'default')}}
});
function filteredRecords(){
 let list=sortedRecords.filter(r=>matches(r,$('catalogue-query').value));
 if(filter==='languages')list=list.filter(r=>r.language);if(filter==='reviewed')list=list.filter(r=>r.review?.status==='verified-language');if(filter==='runnable')list=list.filter(r=>runtimes.has(r.id));
 if($('catalogue-sort').value==='year')list.sort((a,b)=>(a.year||9999)-(b.year||9999)||a.name.localeCompare(b.name));return list;
}
function renderCatalogue(){
 const list=filteredRecords(),pages=Math.max(1,Math.ceil(list.length/25));cataloguePage=Math.min(cataloguePage,pages-1);
 $('catalogue-count').textContent='找到 '+number(list.length)+' 条记录';
 $('catalogue-list').innerHTML=list.slice(cataloguePage*25,cataloguePage*25+25).map(r=>`<button type="button" class="catalogue-row" data-language="${escape(r.id)}"><span class="catalogue-name"><span class="language-mark">${escape(mark(r.id))}</span><span><strong>${escape(r.name)}</strong><small>${escape(r.creators||r.aliases||r.id)}</small></span></span><span class="catalogue-year">${r.year||'—'}</span><span class="catalogue-state ${r.review?.status==='verified-language'?'verified':''}">${stateLabel(r)}</span><span class="catalogue-mode">${modeLabel(r.id)}</span><span aria-hidden="true">↗</span></button>`).join('')||'<p class="empty-state">没有找到对应记录，换一个名称或别名试试。</p>';
 $('page-number').textContent=(cataloguePage+1)+' / '+pages;$('previous-page').disabled=cataloguePage===0;$('next-page').disabled=cataloguePage>=pages-1;
}
$('catalogue-query').oninput=()=>{cataloguePage=0;renderCatalogue()};$('catalogue-sort').onchange=()=>{cataloguePage=0;renderCatalogue()};
for(const b of document.querySelectorAll('[data-filter]'))b.onclick=()=>{filter=b.dataset.filter;cataloguePage=0;for(const c of document.querySelectorAll('[data-filter]'))c.setAttribute('aria-pressed',String(c===b));renderCatalogue()};
for(const [id,offset] of [['previous-page',-1],['next-page',1]])$(id).onclick=()=>{cataloguePage+=offset;renderCatalogue();$('catalogue-list').scrollIntoView({block:'start'})};renderCatalogue();
function globalResults(){const query=$('global-query').value,list=(query?sortedRecords.filter(r=>matches(r,query)):['javascript','python','c','rust','scheme','lua'].map(id=>byId.get(id))).slice(0,8);$('global-results').innerHTML=list.map(r=>`<button type="button" class="global-result" data-language="${escape(r.id)}"><span class="language-mark">${escape(mark(r.id))}</span><strong>${escape(r.name)}</strong><small>${r.year||'年代待核'} ↗</small></button>`).join('')||'<p class="empty-state">没有匹配的馆藏记录。</p>'}
function search(){showDialog('search-dialog');globalResults();$('global-query').focus()}
$('open-search').onclick=search;$('global-query').oninput=globalResults;
$('global-query').onkeydown=event=>{if(event.key==='ArrowDown'){event.preventDefault();$('global-results').querySelector('button')?.focus()}if(event.key==='Enter')$('global-results').querySelector('button')?.click()};
$('global-results').onkeydown=event=>{if(!['ArrowDown','ArrowUp'].includes(event.key))return;event.preventDefault();const list=[...$('global-results').querySelectorAll('button')],i=list.indexOf(document.activeElement);list[(i+(event.key==='ArrowDown'?1:-1)+list.length)%list.length]?.focus()};
function renderTimeline(era='all'){
 const groups=new Map();for(const r of catalogue.records.filter(r=>r.mapEligible&&Number.isFinite(r.year)).sort((a,b)=>a.year-b.year)){const decade=r.year<1940?'早期':String(Math.floor(r.year/10)*10);if(!groups.has(decade))groups.set(decade,[]);groups.get(decade).push(r)}
 $('era-filter').innerHTML=['all',...groups.keys()].map(k=>`<button type="button" data-era="${k}" aria-pressed="${era===k}">${k==='all'?'全部年代':k==='早期'?'1940 以前':k+'s'}</button>`).join('');
 $('timeline-list').innerHTML=[...groups].filter(([k])=>era==='all'||k===era).map(([k,list])=>`<section class="era-section"><h2>${k==='早期'?'早期构想':k+'s'}</h2><div class="era-entries">${list.map(r=>`<button class="era-entry" type="button" data-language="${escape(r.id)}">${escape(r.name)}<small>${r.year}</small></button>`).join('')}</div></section>`).join('');
 for(const b of $('era-filter').querySelectorAll('button'))b.onclick=()=>renderTimeline(b.dataset.era);
}
$('relation-language').innerHTML=catalogue.records.filter(r=>r.mapEligible).sort((a,b)=>a.name.localeCompare(b.name)).map(r=>`<option value="${escape(r.id)}">${escape(r.name)}</option>`).join('');$('relation-language').value='javascript';$('relation-language').onchange=renderRelations;
function renderRelations(){
 const id=$('relation-language').value,r=byId.get(id);if(!r)return;
 const incoming=designEdges.filter(e=>e.to===id),outgoing=designEdges.filter(e=>e.from===id);
 const branches=(edges,direction)=>edges.map(e=>`<button class="relation-item" type="button" data-proof="${escape(e.from+'|'+e.to+'|'+e.type)}"><strong>${escape(byId.get(direction==='up'?e.from:e.to)?.name||e.from)} <span aria-hidden="true">↗</span></strong><small>${escape(relationType(e))} · ${e.evidence?'已有摘录':'来源字段，待核读'}</small>${e.label?'<p>'+escape(e.label)+'</p>':''}</button>`).join('')||'<p class="relation-note">尚无记录，不表示没有关联。</p>';
 $('relation-workspace').innerHTML=`<div class="relation-layout"><div><h3>已记录的设计输入 · ${incoming.length}</h3>${branches(incoming,'up')}</div><div class="relation-center"><span class="language-mark">${escape(mark(id))}</span><h2>${escape(r.name)}</h2><p>${r.year||'年代待核'} · ${stateLabel(r)}</p><button class="text-button" type="button" data-language="${escape(id)}">打开档案 ↗</button></div><div><h3>已记录的后续语言 · ${outgoing.length}</h3>${branches(outgoing,'down')}</div></div><p class="relation-note">设计影响与超集扩展分别标记；这里不混入实现/ABI/生态关系。关系记录来自固定馆藏，缺失关系不等于没有上游。更完整的分层与范围操作可打开原版图谱。</p>`;
}
// The modern layout has its own draft namespace. Original drafts are untouched.
let drafts=new Map(),labLanguage='javascript',labTopic='functions',worker=null,workerTimer=null,runSequence=0,runStarted=0;
try{const saved=JSON.parse(localStorage.getItem('code-museum-modern-drafts')||'[]');if(Array.isArray(saved))drafts=new Map(saved.filter(r=>Array.isArray(r)&&typeof r[0]==='string'&&typeof r[1]==='string'&&r[1].length<=131072).slice(-60))}catch{}
const draftKey=()=>labLanguage+':'+labTopic;
const exampleCode=()=>labTopic==='default'?examples.get(labLanguage)?.code||'':lessons.languages[labLanguage]?.examples[labTopic]?.code||'';
function saveDraft(){drafts.delete(draftKey());drafts.set(draftKey(),$('lab-code').value);while(drafts.size>60)drafts.delete(drafts.keys().next().value);try{localStorage.setItem('code-museum-modern-drafts',JSON.stringify([...drafts]));$('draft-status').textContent='草稿已保存在本机'}catch{$('draft-status').textContent='本机存储不可用，草稿暂存在当前页面'}}
function changed(){document.dispatchEvent(new CustomEvent('museum-lab-change'))}
function paint(){
 const code=$('lab-code').value,pattern=/(\/\/[^\n]*|#[^\n]*|--[^\n]*|;[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b)/g;
 const keywords=new Set('const let var function return for of in if else while true false null def print range lambda import as class end local then do define display displayln lambda begin int void public static package fn mut use struct SELECT FROM WHERE'.split(' '));
 let output='',at=0,m;while((m=pattern.exec(code))){output+=escape(code.slice(at,m.index));const t=m[0],kind=/^(\/\/|#|--|;)/.test(t)?'comment':/^["']/.test(t)?'string':/^\d/.test(t)?'number':keywords.has(t)?'keyword':null;output+=kind?`<span class="tok-${kind}">${escape(t)}</span>`:escape(t);at=pattern.lastIndex}output+=escape(code.slice(at));$('lab-highlight').innerHTML=output+'\n';
 const n=code.split('\n').length;$('line-numbers').textContent=Array.from({length:n},(_,i)=>i+1).join('\n');$('cursor-status').textContent=n+' 行 · UTF-8';
}
function feedbackTab(name,reveal=false){const output=name==='output';$('output-panel').hidden=!output;$('lab-explanation').hidden=output;$('output-tab').setAttribute('aria-selected',String(output));$('review-tab').setAttribute('aria-selected',String(!output));if(reveal&&matchMedia('(max-width:640px)').matches)document.querySelector('.result-column').scrollIntoView({block:'start',behavior:'smooth'})}
$('output-tab').onclick=()=>feedbackTab('output');$('review-tab').onclick=()=>feedbackTab('review');$('lab-explain-current').addEventListener('click',()=>feedbackTab('review',true));
for(const b of [$('output-tab'),$('review-tab')])b.onkeydown=event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'||event.key==='ArrowLeft'?$('output-tab'):$('review-tab');next.click();next.focus()}};
function outputState(state,label,text){$('execution-state').dataset.state=state;$('execution-label').textContent=label;if(text!==undefined){$('output-empty').hidden=true;$('execution-output').hidden=false;$('execution-output').textContent=text;$('execution-output').dataset.state=state}}
function clearOutput(){outputState('idle','等待运行');$('execution-time').textContent='';$('execution-output').hidden=true;$('output-empty').hidden=false}
function endWorker(){clearTimeout(workerTimer);workerTimer=null;worker?.terminate();worker=null;$('stop-code').hidden=true;$('run-code').disabled=false;runSequence++}
function stopExecution(reason='运行已停止。'){if(!worker)return;endWorker();outputState('cancelled','已停止',reason);$('execution-time').textContent=''}
function selectLanguage(id,topic='default'){
 if(!byId.has(id))return;if(worker)stopExecution('已切换语言，原运行已停止。');
 labLanguage=id;labTopic=topic==='default'||lessons.languages[id]?.examples[topic]?topic:'default';
 if(!$('lab-language').querySelector(`option[value="${CSS.escape(id)}"]`))$('lab-language').add(new Option(byId.get(id).name+' · 仅编辑',id));$('lab-language').value=id;
 $('lab-topic').innerHTML='<option value="default">馆内示例 / 自由草稿</option>'+lessons.topics.filter(t=>lessons.languages[id]?.examples[t.id]).map(t=>`<option value="${t.id}">${escape(t.name)}</option>`).join('');$('lab-topic').value=labTopic;
 $('lab-code').value=drafts.get(draftKey())??exampleCode();$('lab-file').textContent=examples.get(id)?.file||byId.get(id).name+' · 草稿';
 $('runtime-label').textContent=modeLabel(id)+(runtimes.get(id)?.local?' · 本地':'');
 const remote=!!runtimes.get(id)?.remote,local=!!runtimes.get(id)?.local;
 $('runtime-boundary').textContent=local?(id==='javascript'?'浏览器原生 JavaScript · 独立 Worker · 2 秒上限 · 不提供 DOM / Node.js':id==='python'?'Python · 固定 Pyodide · 点击运行才加载本地资源 · 执行 3 秒上限':id==='lua'?'Lua 5.4 · 固定 Wasmoon · 独立 Wasm 环境 · 执行 2 秒上限':'Scheme · 固定 BiwaScheme · 非完整 R7RS · 执行 2 秒上限'):remote?'已配置远端运行环境；此本地版式预览尚未连接远端执行服务。':'该语言尚未接入执行环境，可保留代码草稿。';
 $('execution-boundary').textContent=local?'本地代码在独立 Worker 中执行；显示真实输出，超过时间上限会停止。':remote?'远端服务尚未连接，不会生成模拟输出。':'尚未接入运行环境，不显示模拟结果。';
 $('draft-status').textContent=drafts.has(draftKey())?'已恢复这份预览的本机草稿':'馆内示例 · 修改后仅保存在本机';
 $('reset-code').disabled=!exampleCode();clearOutput();paint();changed();
}
function openLab(id,topic='default'){selectLanguage(id,topic);const hash='lab/'+encodeURIComponent(id)+'/'+encodeURIComponent(labTopic);if(location.hash!=='#'+hash){history.pushState(null,'','#'+hash)}route();$('lab-code').focus({preventScroll:true})}
$('lab-language').innerHTML=[...runtimes.keys()].sort((a,b)=>byId.get(a).name.localeCompare(byId.get(b).name)).map(id=>`<option value="${escape(id)}">${escape(byId.get(id).name)}</option>`).join('');
$('lab-language').onchange=()=>openLab($('lab-language').value);$('lab-topic').onchange=()=>openLab(labLanguage,$('lab-topic').value);$('lab-archive').onclick=event=>{event.preventDefault();openDetail(labLanguage)};
$('lab-code').addEventListener('input',()=>{if(worker)stopExecution('代码已修改，原运行已停止。');saveDraft();paint();clearOutput();changed()});
$('lab-code').addEventListener('scroll',()=>{$('lab-highlight').scrollTop=$('lab-code').scrollTop;$('lab-highlight').scrollLeft=$('lab-code').scrollLeft;$('line-numbers').scrollTop=$('lab-code').scrollTop});
$('lab-code').addEventListener('keydown',event=>{if(event.key==='Tab'){event.preventDefault();const editor=$('lab-code');editor.setRangeText('  ',editor.selectionStart,editor.selectionEnd,'end');editor.dispatchEvent(new Event('input'))}});
$('reset-code').onclick=()=>{if(worker)stopExecution();$('lab-code').value=exampleCode();saveDraft();paint();clearOutput();changed();document.querySelector('.file-menu').open=false;toast('已恢复当前馆内示例')};
$('download-code').onclick=()=>{const blob=new Blob([$('lab-code').value],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=examples.get(labLanguage)?.file||labLanguage+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);document.querySelector('.file-menu').open=false};
$('import-code').onclick=()=>{$('import-file').click();document.querySelector('.file-menu').open=false};
$('import-file').onchange=async()=>{const file=$('import-file').files[0];$('import-file').value='';if(!file)return;if(file.size>131072){toast('文件不能超过 128 KiB');return}try{const code=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());$('lab-code').value=code;$('lab-code').dispatchEvent(new Event('input'));toast('已导入代码，点击运行后执行')}catch{toast('请选择 UTF-8 文本代码文件')}};
function run(){
 feedbackTab('output',true);const id=labLanguage,code=$('lab-code').value;
 if(!runtimes.get(id)?.local){outputState('unavailable','环境未连接',runtimes.get(id)?.remote?'当前本地版式预览尚未连接远端执行服务。代码已保留，可通过下方入口打开原版实验台。':'该语言尚未接入运行环境；可以继续编辑和保存草稿。');return}
 if(worker)endWorker();runStarted=performance.now();const generation=++runSequence;
 const module=['python','scheme'].includes(id),file=id==='javascript'?'lab-worker.js':id+'-worker.js';
 $('run-code').disabled=true;$('stop-code').hidden=false;$('execution-time').textContent='';outputState('running',id==='javascript'?'正在运行':'正在准备本地环境…','');
 let active;try{active=new Worker('/classic/'+file,module?{type:'module'}:undefined)}catch(error){endWorker();outputState('error','环境加载失败',error.message);return}worker=active;
 const finish=(ok,text)=>{if(worker!==active||generation!==runSequence)return;const elapsed=performance.now()-runStarted;endWorker();outputState(ok?'ok':'error',ok?'运行完成':'执行失败',text);$('execution-time').textContent=elapsed.toFixed(0)+' ms'};
 const budget=seconds=>{clearTimeout(workerTimer);workerTimer=setTimeout(()=>finish(false,'超过 '+seconds+' 秒时间上限，已停止。本次没有继续执行。'),seconds*1000)};
 budget(id==='python'?90:id==='javascript'?2:30);
 active.onmessage=({data})=>{if(worker!==active||generation!==runSequence)return;if(data.kind==='progress')return;if(data.kind==='ready'){outputState('running','正在执行代码');budget(id==='python'?3:2);if(id==='python')active.postMessage({kind:'run',id:generation,code});return}if(data.kind==='fatal'){finish(false,data.output);return}if(data.id!==generation)return;if(typeof data.ok==='boolean')finish(data.ok,data.output)};
 active.onerror=event=>finish(false,event.message||'本地运行环境加载失败。');
 try{active.postMessage(id==='python'?{kind:'init',files:{}}:{id:generation,code,files:{}})}catch(error){finish(false,error.message)}
}
$('run-code').onclick=run;$('stop-code').onclick=()=>stopExecution();document.addEventListener('visibilitychange',()=>{if(document.hidden&&worker)stopExecution('页面进入后台，已停止运行；可重新运行。')});
window.MUSEUM_LAB={get current(){return labLanguage},get topic(){return labTopic},get code(){return $('lab-code').value}};
selectLanguage(labLanguage,labTopic);
// Reuse the current validated model client, snapshot binding and authored explanations.
await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/classic/lab-explanations.js';s.onload=resolve;s.onerror=()=>reject(new Error('讲解组件加载失败'));document.body.append(s)});
document.addEventListener('keydown',event=>{const typing=event.target.matches?.('input,textarea,select')||event.target.isContentEditable;if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();search()}else if(event.key==='/'&&!typing&&!document.querySelector('dialog[open]')){event.preventDefault();search()}else if((event.metaKey||event.ctrlKey)&&event.key==='Enter'&&view==='lab'&&!document.querySelector('dialog[open]')){event.preventDefault();run()}});
route();window.MUSEUM_MODERN={ready:true,counts:{records:catalogue.records.length,languages:catalogue.meta.languages,configured:capabilities.languages.length},openLab,openDetail,setExplore,run};
