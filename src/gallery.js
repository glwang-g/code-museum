// The complete museum keeps its validated controllers; this layer owns layout and reading.
(()=>{
const $=id=>document.getElementById(id),escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL=value=>{try{const u=new URL(value,location.origin);return ['http:','https:'].includes(u.protocol)?u.href:'#'}catch{return '#'}};
const catalogue=window.MUSEUM_DATA,exhibits=window.MUSEUM_EXHIBITS,paths=window.MUSEUM_LEARNING_PATHS;
const byId=new Map(catalogue.records.map(r=>[r.id,r])),exhibitById=new Map(exhibits.exhibits.map(e=>[e.id,e])),examples=new Map(window.MUSEUM_LAB_EXAMPLES.map(e=>[e.id,e]));
const runtimes=new Map(window.MUSEUM_LAB_EXAMPLES.map(e=>[e.id,{local:['javascript','python','lua','scheme'].includes(e.id),remote:!['javascript','lua','scheme'].includes(e.id)}]));
const scenes=[
 {route:'c-lineage',label:'LANGUAGE & LINEAGE',title:'一个字母，<br>怎样长出新的分支？',ids:['bcpl','b','c','cpp'],selected:'c'},
 {route:'function-expressions',label:'FUNCTIONS AS VALUES',title:'把函数当作值，<br>会发生什么？',ids:['lisp','scheme','lua','javascript'],selected:'javascript'},
 {route:'python-rust-go',label:'ONE IDEA, MANY EXPRESSIONS',title:'同一个想法，<br>可以有多少种写法？',ids:['python','go','rust'],selected:'python'}
];
let sceneIndex=0,selected='c',readingId=null,readingTopic='functions',readingKey=null;
function codeFor(id,topic){return window.MUSEUM_LESSONS.languages[id]?.examples[topic]?.code||exhibitById.get(id)?.code||window.MUSEUM_LESSONS.languages[id]?.examples.functions?.code||examples.get(id)?.code||''}
function glyph(id){return {javascript:'JS',python:'Py',scheme:'λ',lisp:'λ',cpp:'C++',bcpl:'B',rust:'Rs',lua:'Lu',go:'Go'}[id]||byId.get(id).name}
function renderExhibition(){
 const scene=scenes[sceneIndex],r=byId.get(selected),route=paths.routes.find(p=>p.id===scene.route),code=codeFor(selected);
 $('exhibit-kicker').textContent='EXHIBITION 0'+(sceneIndex+1)+' / '+scene.label;$('exhibit-title').innerHTML=scene.title;$('exhibit-description').textContent=route.description;
 $('specimen-glyph').textContent=glyph(selected);$('specimen-label').textContent=r.name+' · 馆内原创示例';$('specimen-code').textContent=code||'这件展品暂无经审核的代码示例。';
 $('specimen-code').parentElement.querySelector('p').textContent='现代语言示例，非历史源码 · 点击后才运行';
 $('exhibit-index').style.gridTemplateColumns='repeat('+scene.ids.length+',minmax(0,1fr))';
 $('exhibit-index').innerHTML=scene.ids.map(id=>{const r=byId.get(id);return `<button type="button" data-exhibit="${id}" aria-pressed="${id===selected}"><strong>${r.year||'—'}</strong><span>${escape(r.name)}</span></button>`}).join('');
 $('exhibit-position').textContent=String(scene.ids.indexOf(selected)+1).padStart(2,'0')+' — '+String(scene.ids.length).padStart(2,'0');
 $('try-exhibit').disabled=!code;
 for(const b of document.querySelectorAll('[data-scene]'))b.setAttribute('aria-pressed',String(Number(b.dataset.scene)===sceneIndex));
}
function setScene(index){sceneIndex=index;selected=scenes[index].selected;renderExhibition()}
for(const b of document.querySelectorAll('[data-scene]'))b.onclick=()=>setScene(Number(b.dataset.scene));
$('exhibit-index').onclick=event=>{const b=event.target.closest('[data-exhibit]');if(!b)return;selected=b.dataset.exhibit;renderExhibition()};
function taskTopic(id,requested){
 const state=window.MUSEUM_NAV.state();
 const context=requested??((['read','lab'].includes(state.view)&&state.language===id||state.view==='compare'&&[state.left,state.right].includes(id))?state.topic:'functions');
 return window.MUSEUM_TASK.topicFor(window.MUSEUM_LESSONS,id,context);
}
function openReading(id,topic){if(!byId.has(id))return;location.hash=window.MUSEUM_ROUTE.serialize({view:'read',language:id,topic:taskTopic(id,topic)}).slice(1)}
function sendToLab(id,requested,loadExample=false,exampleCode){
 const topic=taskTopic(id,requested),code=exampleCode??codeFor(id,topic);
 window.MUSEUM_LAB.restore(id,topic);$('lab-view').click();
 if(loadExample&&code&&window.MUSEUM_LAB.code!==code){window.MUSEUM_LAB.importCode(code);$('lab-file-feedback').textContent='已载入这段阅读示例；原草稿可在“代码工具”中撤销替换。';$('lab-file-feedback').hidden=false}
 $('lab-code').focus({preventScroll:true});
}
function openTaskComparison(id,topic){
 const state=window.MUSEUM_NAV.state(),pair=window.MUSEUM_TASK.comparisonFor(window.MUSEUM_LESSONS,id,topic,state);
 if(pair)window.MUSEUM_COMPARE.open(pair.left,pair.right,pair.topic);else window.activateTab('compare-view');
}
function openCurrentComparison(){const state=window.MUSEUM_NAV.state();if(['read','lab'].includes(state.view))openTaskComparison(state.language,state.topic);else window.activateTab('compare-view')}
$('read-exhibit').onclick=()=>openReading(selected);$('try-exhibit').onclick=()=>sendToLab(selected,'functions',true,codeFor(selected));
const orderedReading=exhibits.exhibits.map(e=>e.id);
function renderReading(id,topic,preservePosition=false){
 const scrollY=window.scrollY;
 const r=byId.get(id),e=exhibitById.get(id),runtime=runtimes.get(id),code=codeFor(id,topic),relation=e?.relation?catalogue.edges.find(edge=>[edge.from,edge.to,edge.type].join('|')===e.relation):null;
 const status=r.review?.status==='verified-language'?'已核实现':r.review?.status==='historical-primary-source'?'已有历史一手资料':'馆藏记录，仍需核对';
 const sources=[...(e?.historySources||[]),...(r.review?.sources||[]).map(s=>({title:s.role+'资料',url:s.url})),{title:'原始馆藏记录',url:r.source}];
 const unique=[...new Map(sources.filter(s=>s.url).map(s=>[s.url,s])).values()];
 const lesson=window.MUSEUM_LESSONS.languages[id],task=window.MUSEUM_LESSONS.topics.find(t=>t.id===topic);
 const picker=lesson?`<div class="reading-task-tools"><label>同题练习 <select id="reading-topic" aria-label="阅读中的练习主题"><option value="default"${topic==='default'?' selected':''}>馆内示例 / 自由草稿</option>${window.MUSEUM_LESSONS.topics.filter(t=>lesson.examples[t.id]).map(t=>`<option value="${escape(t.id)}"${t.id===topic?' selected':''}>${escape(t.name)}</option>`).join('')}</select></label><p>${escape(task?.task||'自由草稿保留在实验室；此处展示馆内示例')} · 语言与题目会带入对比和实验室。</p></div>`:'';
 const compareAction=lesson?`<button class="button secondary" type="button" data-reading-compare="${escape(id)}">${topic==='default'?'选择馆内任务对比':'对比同一个任务'} →</button>`:'<p class="reading-source-note">这门语言暂无同题对比教材。</p>';
 $('reading-breadcrumb').textContent=r.name+' / 阅读';
 $('reading-content').innerHTML=`<header class="reading-heading"><div><p class="eyebrow">THE READING ROOM / ${escape(r.name.toUpperCase())}</p><h1 id="reading-title" tabindex="-1">${escape(e?.title||r.name+'的馆藏档案')}</h1><p class="reading-subtitle">${escape(e?.purpose||r.review?.notes||'从固定馆藏记录开始，核对这门语言的身份、来源与实现。')}</p></div><div class="reading-year">${r.year||'—'}<small>馆藏来源年代<br>${escape(r.name)} · ${status}</small></div></header><div class="reading-layout"><article class="reading-article">${window.MUSEUM_RESEARCH_NOTES.render('language:'+id)}<section><h2><span>01</span>设计的来处</h2><p>${escape(e?.history||r.review?.notes||'这件展品尚无馆内编辑策展的历史介绍。以下记录与链接来自固定馆藏，不据此补写未经核实的设计故事。')}</p>${relation?`<div class="reading-evidence"><p>${escape(relation.evidence||'该关系来自来源字段，尚无馆内原文摘录。')}</p><a class="reading-full-link" href="${escape(safeURL(relation.source))}" target="_blank" rel="noopener">回到关系来源 ↗</a></div>`:''}<p class="reading-source-note">来源年代不等于当前实现版本；已存依据也不表示历史关系已全部找齐。</p></section>${e?`<section><h2><span>02</span>理解它的几条规则</h2><ul>${e.rules.map(rule=>'<li>'+escape(rule)+'</li>').join('')}</ul></section>`:''}<section id="reading-example"><h2><span>03</span>把设计，放进一小段代码</h2>${picker}${code?`<div class="reading-code"><div><span>${escape(r.name)} · 馆内原创示例</span><span>NOT EXECUTED</span></div><pre>${escape(code)}</pre><button type="button" data-reading-lab="${escape(id)}" data-reading-import="true">把这段示例带入实验室 <span aria-hidden="true">→</span></button></div>`:'<p>暂时没有经审核的代码示例，可先核读资料。</p>'}<p class="reading-source-note">此处只展示源码，没有预先填入运行结果；进入实验台后点击运行。</p></section><section><h2><span>04</span>版本与阅读边界</h2><p>${escape(e?.boundary||r.review?.notes||'当前记录仍需进一步核读；请以各资料明确的语言、实现和版本范围为准。')}</p></section><section><h2><span>05</span>每一步，都能回到出处</h2><ul class="reading-links">${unique.map(s=>`<li><a href="${escape(safeURL(s.url))}" target="_blank" rel="noopener">${escape(s.title)}<span aria-hidden="true">↗</span></a></li>`).join('')}</ul></section></article><aside class="reading-side"><div class="reading-side-inner"><div class="reading-specimen-card"><p class="eyebrow">SPECIMEN / LANGUAGE</p><strong>${escape(r.name)}</strong><dl><dt>年代</dt><dd>${r.year||'待核'}</dd><dt>创造者</dt><dd>${escape(r.creators||'来源尚未补齐')}</dd><dt>状态</dt><dd>${status}</dd><dt>执行</dt><dd>${runtime?.local?'浏览器本地':runtime?.remote?'已接入远端 · 需服务可用':'尚未接入'}</dd></dl><button class="button primary" type="button" data-reading-lab="${escape(id)}">${code?'继续这个任务':'打开草稿'} <span aria-hidden="true">→</span></button>${compareAction}</div><p class="reading-side-note">阅读资料不会自动执行代码，也不会调用大模型。可以先理解设计，再进入实验。</p><button class="text-button" type="button" data-reading-archive="${escape(id)}">查看完整馆藏档案 ↗</button><button class="text-button" type="button" data-reading-relations="${escape(id)}">查看已记录的设计关系 ↗</button><a class="reading-full-link" href="#about" target="_blank" rel="noopener">完整出处与许可 ↗</a></div></aside></div>`;
 if($('reading-topic'))$('reading-topic').onchange=()=>openReading(id,$('reading-topic').value);
 if(preservePosition){$('reading-topic')?.focus({preventScroll:true});window.scrollTo({top:scrollY,behavior:'instant'})}else{$('reading-title').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'})}
}

function syncView(){
 const s=window.MUSEUM_NAV.state(),reading=s.view==='read';
 syncTabStop();
 for(const a of document.querySelectorAll('[data-main-nav]')){const on=a.dataset.mainNav===(s.view==='lab'?'lab':s.view==='catalogue'?'catalogue':'gallery');if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')}
 if(reading){const id=byId.has(s.language)?s.language:'javascript',topic=taskTopic(id,s.topic),key=id+':'+topic;if(readingKey!==key){const same=readingId===id;readingId=id;readingTopic=topic;readingKey=key;renderReading(id,topic,same)}}else{readingId=null;readingKey=null}
 if(s.view==='guides')renderGuides();
 if(s.view!=='lab')setFocus(false);
}
function syncTabStop(){const tabs=[...document.querySelectorAll('.museum-tabs [role=tab]')],visible=tabs.filter(tab=>!tab.hidden&&tab.getClientRects().length),target=visible.find(tab=>tab.classList.contains('active'))||visible[0];for(const tab of tabs)tab.tabIndex=tab===target?0:-1}
$('compare-view').onclick=openCurrentComparison;$('guides-view').onclick=()=>window.activateTab('guides-view');
for(const a of document.querySelectorAll('[data-main-nav="lab"],.site-footer a[href="#compare"],.site-footer a[href="#guides"]'))a.onclick=event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();if(a.dataset.mainNav==='lab')$('lab-view').click();else if(a.getAttribute('href')==='#guides')$('guides-view').click();else openCurrentComparison()};
const readCurrent=document.createElement('button');readCurrent.type='button';readCurrent.id='gallery-lab-read';readCurrent.className='text-button';readCurrent.textContent='了解这门语言 ↗';const labContext=document.createElement('div');labContext.className='lab-context-actions';const compareCurrent=document.createElement('button');compareCurrent.type='button';compareCurrent.id='gallery-lab-compare';compareCurrent.className='text-button';labContext.append(readCurrent,compareCurrent);document.querySelector('.lab-header').append(labContext);readCurrent.onclick=()=>openReading(window.MUSEUM_LAB.current,window.MUSEUM_LAB.topic);compareCurrent.onclick=openCurrentComparison;const syncTaskActions=()=>{const supported=!!window.MUSEUM_LESSONS.languages[window.MUSEUM_LAB.current];const free=window.MUSEUM_LAB.topic==='default';compareCurrent.textContent=supported?(free?'浏览同题教材 ↗':'对比同一个任务 ↗'):'浏览已有对比 ↗';compareCurrent.title=supported?(free?'按馆内预设任务比较；自由草稿继续保存在本机':'携带当前语言和题目进入对比'):'这门语言暂无同题教材，可浏览已有语言对比'};document.addEventListener('museum-lab-change',syncTaskActions);syncTaskActions();
$('gallery-view').onclick=()=>window.activateTab('gallery-view');$('reading-view').onclick=()=>window.activateTab('reading-view');
for(const b of document.querySelectorAll('[data-explore]'))b.onclick=()=>{const mode=b.dataset.explore;$(mode==='time'?'timeline-view':mode==='relations'?'lineage-view':'gallery-view').click()};
$('reading-next').onclick=()=>{const i=orderedReading.indexOf(readingId);openReading(orderedReading[(i+1)%orderedReading.length])};
function renderGuides(){
 const active=window.MUSEUM_GUIDE.state;
 $('guide-directory').innerHTML=paths.routes.map(r=>{const continuing=active?.route===r.id;return `<article class="guide-card"><p class="eyebrow">${r.steps.length} 个步骤${continuing?' · 已到第 '+(active.index+1)+' 步':''}</p><h3>${escape(r.title)}</h3><p>${escape(r.description)}</p><details><summary>查看这条路线</summary><ol>${r.steps.map(step=>`<li>${escape(step.title)}</li>`).join('')}</ol></details><button type="button" data-directory-guide="${escape(r.id)}">${continuing?'继续导览':'开始导览'} →</button>${continuing?`<button type="button" class="text-button" data-restart-guide="${escape(r.id)}">从头开始</button>`:''}</article>`}).join('');
}
$('route-grid').innerHTML=paths.routes.map((r,i)=>`<button type="button" class="route-card" data-gallery-route="${escape(r.id)}"><span class="route-meta">策展导览 · ${r.steps.length} 个停靠点</span><span class="route-number">0${i+1}</span><h3>${escape(r.title)}</h3><p>${escape(r.description)}</p><span class="card-arrow">↗</span></button>`).join('');
$('all-routes').textContent='全部 '+paths.routes.length+' 条导览 ↗';$('all-routes').onclick=()=>{$('guides-view').click()};
$('featured-grid').innerHTML=['python','javascript','c','rust'].map(id=>`<button type="button" class="language-card" data-gallery-read="${id}"><strong>${escape(byId.get(id).name)}</strong><small>${byId.get(id).year}</small><p>${escape(exhibitById.get(id)?.purpose||byId.get(id).creators)}</p></button>`).join('');
$('collection-facts').innerHTML=[[catalogue.meta.count,'馆藏条目'],[catalogue.meta.languages,'语言记录'],[runtimes.size,'已接入执行环境']].map(([n,label])=>`<div><strong>${n.toLocaleString('en-US')}</strong><span>${label}</span></div>`).join('')+'<p>固定馆藏快照 · 覆盖范围有明确说明</p>';
document.addEventListener('click',event=>{
 const read=event.target.closest('[data-gallery-read]');if(read){openReading(read.dataset.galleryRead);return}
 const route=event.target.closest('[data-gallery-route]');if(route){window.MUSEUM_GUIDE.start(route.dataset.galleryRoute);return}
 const lab=event.target.closest('[data-reading-lab]');if(lab){sendToLab(lab.dataset.readingLab,readingTopic,lab.dataset.readingImport==='true');return}
 const compare=event.target.closest('[data-reading-compare]');if(compare){openTaskComparison(compare.dataset.readingCompare,readingTopic);return}
 const guide=event.target.closest('[data-directory-guide],[data-restart-guide]');if(guide){const id=guide.dataset.directoryGuide||guide.dataset.restartGuide;if(guide.dataset.directoryGuide&&window.MUSEUM_GUIDE.state?.route===id)window.MUSEUM_GUIDE.open();else window.MUSEUM_GUIDE.start(id);return}
 const archive=event.target.closest('[data-reading-archive]');if(archive){window.MUSEUM_RELATIONS_UI.openLanguage(archive.dataset.readingArchive);return}
 const relations=event.target.closest('[data-reading-relations]');if(relations)window.MUSEUM_EXPLORE.openLanguage(relations.dataset.readingRelations)
});
// Full catalogue selections open the full reading page; map selections retain their evidence panel.
document.addEventListener('click',event=>{const record=event.target.closest('#list .record[data-id]');if(!record)return;event.preventDefault();event.stopImmediatePropagation();openReading(record.dataset.id)},true);
// Keep the existing model client's request validation, disabled state and snapshot cache.
const editor=$('lab-code'),body=document.querySelector('.lab-body'),results=document.createElement('div');results.className='gallery-results';
results.innerHTML='<div class="gallery-feedback-tabs" role="tablist" aria-label="实验反馈"><button id="gallery-output-tab" type="button" role="tab" aria-selected="true" aria-controls="gallery-output">运行结果</button><button id="gallery-review-tab" type="button" role="tab" aria-selected="false" aria-controls="lab-explanation">检查与讲解</button></div>';
const output=document.querySelector('.lab-output');output.id='gallery-output';output.setAttribute('role','tabpanel');output.setAttribute('aria-labelledby','gallery-output-tab');
body.append(results);results.append(output,$('lab-explanation'));
function feedbackTab(name,reveal=false){const review=name==='review';output.hidden=review;$('lab-explanation').hidden=!review;$('gallery-output-tab').setAttribute('aria-selected',String(!review));$('gallery-review-tab').setAttribute('aria-selected',String(review));if(reveal&&matchMedia('(max-width:650px)').matches)results.scrollIntoView({block:'start',behavior:'smooth'})}
$('gallery-output-tab').onclick=()=>feedbackTab('output');$('gallery-review-tab').onclick=()=>feedbackTab('review');
for(const b of [$('gallery-output-tab'),$('gallery-review-tab')])b.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=$(['ArrowLeft','Home'].includes(event.key)?'gallery-output-tab':'gallery-review-tab');next.click();next.focus()}});
const toolbar=document.querySelector('.lab-study-toolbar'),actions=document.querySelector('.lab-run-actions');
toolbar.prepend($('lab-language').closest('label'));actions.prepend($('lab-explain-current'));toolbar.append(actions);
$('lab-run').addEventListener('click',()=>feedbackTab('output',true));$('lab-explain-current').addEventListener('click',()=>feedbackTab('review',true));
$('lab-explanation-toggle').hidden=true;$('lab-explanation').setAttribute('role','tabpanel');$('lab-explanation').setAttribute('aria-labelledby','gallery-review-tab');
const settings=document.createElement('details');settings.className='gallery-run-settings';settings.innerHTML='<summary>执行位置与程序输入 <span>按需展开</span></summary>';document.querySelector('.lab-toolbar').append(settings);settings.append($('lab-execution-controls'),document.querySelector('.lab-environment-row'));
const editorFooter=document.createElement('div');editorFooter.className='gallery-editor-footer';editorFooter.innerHTML='<span id="gallery-cursor-status"></span>';document.querySelector('.lab-editor').append(settings,editorFooter);editorFooter.prepend($('lab-draft-status'));settings.append($('lab-topic-note'),$('lab-status'),$('lab-runtime-credit'));results.insertBefore($('lab-runtime-state'),output);
$('lab-file-tools').querySelector('summary').textContent='代码工具';document.querySelector('.lab-file-menu').append($('lab-reset'));
const focus=document.createElement('button');focus.type='button';focus.id='gallery-focus';focus.textContent='专注模式';focus.setAttribute('aria-pressed','false');document.querySelector('.lab-file-menu').append(focus);
function setFocus(on){document.body.classList.toggle('focus-lab',on);focus.setAttribute('aria-pressed',String(on));focus.textContent=on?'退出专注':'专注模式'}
focus.onclick=()=>{setFocus(!document.body.classList.contains('focus-lab'));$('lab-file-tools').open=false};
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]'))setFocus(false)});
const numbers=document.createElement('pre');numbers.id='gallery-line-numbers';numbers.setAttribute('aria-hidden','true');document.querySelector('.code-edit').prepend(numbers);
const syncLines=()=>{$('gallery-cursor-status').textContent=editor.value.split('\n').length+' 行 · UTF-8';numbers.textContent=Array.from({length:editor.value.split('\n').length},(_,i)=>i+1).join('\n');numbers.scrollTop=editor.scrollTop};
let lastLabSelection=window.MUSEUM_LAB.current+':'+window.MUSEUM_LAB.topic;
editor.addEventListener('input',syncLines);editor.addEventListener('scroll',syncLines);document.addEventListener('museum-lab-change',()=>{syncLines();const selection=window.MUSEUM_LAB.current+':'+window.MUSEUM_LAB.topic;if(selection!==lastLabSelection)feedbackTab('output');lastLabSelection=selection});syncLines();feedbackTab('output');
// Presentation-only labels for B. Request validation, cache and disabled state stay
// owned by the shared client; both the action and its destination reflect that state.
const checkAction=$('lab-explain-current'),reviewTab=$('gallery-review-tab');
const checkLabels=new Map([
 ['检查并讲解当前代码',{label:'检查代码',state:'idle',hint:'检查当前代码，在右侧查看讲解或改进建议。'}],
 ['正在检查…',{label:'检查中…',state:'checking',hint:'正在检查当前代码，结果会显示在“检查与讲解”中。'}],
 ['等待上次检查…',{label:'请稍候…',state:'waiting',hint:'上一份代码仍在检查中；当前代码尚未检查。'}],
 ['本次检查已就绪',{label:'已检查',state:'ready',hint:'当前代码已有检查结果，可在“检查与讲解”页签查看。'}]
]);
function syncCheckLabel(){
 const next=checkLabels.get(checkAction.textContent);if(!next)return;
 checkAction.textContent=next.label;checkAction.title=next.hint;checkAction.dataset.checkState=next.state;checkAction.setAttribute('aria-busy',String(next.state==='checking'));
 reviewTab.dataset.checking=String(next.state==='checking');reviewTab.setAttribute('aria-label',next.state==='checking'?'检查与讲解，正在检查':next.state==='waiting'?'检查与讲解，等待上次检查':next.state==='ready'?'检查与讲解，已有检查结果':'检查与讲解');
}
new MutationObserver(syncCheckLabel).observe(checkAction,{childList:true,subtree:true,characterData:true});syncCheckLabel();
const checkTips=new Map([
 ['当前代码与馆内示例不同，原讲解已暂停。点击“检查并讲解当前代码”，可检查问题并获得讲解或纠错建议。','当前代码与馆内示例不同，原讲解已暂停。点击“检查代码”，可获得讲解或纠错建议。'],
 ['这门语言尚无对应的馆内示例讲解，可点击“检查并讲解当前代码”分析编辑器中的内容。','这门语言尚无对应的馆内示例讲解，可点击“检查代码”分析编辑器中的内容。']
]);
function syncCheckTip(){if(!['modified','unavailable'].includes($('lab-explanation').dataset.state))return;const p=$('lab-explanation-content').firstElementChild,text=checkTips.get(p?.textContent);if(text)p.textContent=text}
new MutationObserver(syncCheckTip).observe($('lab-explanation-content'),{childList:true});syncCheckTip();

const theme=$('theme-toggle');document.querySelector('.header-actions').insertBefore(theme,document.querySelector('.site-tools'));
const dialog=document.createElement('dialog');dialog.className='gallery-search';dialog.id='gallery-search';dialog.setAttribute('aria-labelledby','gallery-search-title');dialog.innerHTML='<form method="dialog"><button aria-label="关闭搜索">关闭 ×</button></form><h2 id="gallery-search-title">想了解哪一门语言？</h2><input id="gallery-query" type="search" aria-label="搜索完整馆藏" placeholder="名称、别名、创造者…"><div id="gallery-search-results"></div><a href="#catalogue">浏览完整馆藏 →</a>';document.body.append(dialog);
const fold=value=>String(value||'').normalize('NFKC').toLowerCase(),index=catalogue.records.map(r=>({r,text:fold([r.id,r.name,r.aliases,r.creators].join(' '))}));
$('gallery-query').oninput=()=>{const q=fold($('gallery-query').value).trim(),words=q.split(/\s+/);$('gallery-search-results').innerHTML=q?index.filter(v=>words.every(w=>v.text.includes(w))).slice(0,10).map(({r})=>`<button type="button" data-gallery-read="${escape(r.id)}">${escape(r.name)}<small>${r.year||'年代待核'} · ${escape(r.creators||'来源待核')}</small></button>`).join('')||'<p>没有匹配条目。</p>':'<p>检索全部 '+catalogue.meta.count.toLocaleString()+' 条馆藏记录。</p>'};
$('gallery-search-open').onclick=()=>{dialog.showModal();$('gallery-query').oninput();$('gallery-query').focus()};dialog.addEventListener('click',event=>{if(event.target.closest('[data-gallery-read],a'))dialog.close()});
document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();$('gallery-search-open').click()}});
let lastPlace='';document.addEventListener('museum-view-change',()=>{const s=window.MUSEUM_NAV.state(),place=s.view+':'+s.language,same=place===lastPlace;syncView();if(!same)window.scrollTo({top:0,behavior:'instant'});lastPlace=place});
const syncInsets=()=>{const root=document.documentElement;root.style.setProperty('--site-header-height',document.querySelector('.site-header').getBoundingClientRect().height+'px');root.style.setProperty('--study-nav-height',document.querySelector('.museum-tabs').getBoundingClientRect().height+'px');syncTabStop()};const insets=new ResizeObserver(syncInsets);insets.observe(document.querySelector('.site-header'));insets.observe(document.querySelector('.museum-tabs'));syncInsets();
window.addEventListener('load',()=>window.scrollTo({top:0,behavior:'instant'}));renderExhibition();syncView();
window.MUSEUM_GALLERY={ready:true,openReading,openLab:sendToLab,openComparison:openTaskComparison,setScene,feedbackTab,get readingTopic(){return readingTopic}};
})();
