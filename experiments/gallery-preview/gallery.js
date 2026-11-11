// Share the validated core interactions; alternative A's files are never rewritten.
await import('/shared/modern.js');
const $=id=>document.getElementById(id),escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Presentation-only labels for B. Request validation, cache and disabled state stay
// owned by the shared client; both the action and its destination reflect that state.
const checkAction=$('lab-explain-current'),reviewTab=$('review-tab');
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
const safeURL=value=>{try{const u=new URL(value,location.origin);return ['http:','https:'].includes(u.protocol)?u.href:'#'}catch{return '#'}};
const [catalogue,exhibits,paths,capabilities]=await Promise.all(['catalogue','language-exhibits','learning-paths','execution-capabilities'].map(async name=>{const r=await fetch('/classic/data/'+name+'.json');if(!r.ok)throw new Error('展览资料加载失败');return r.json()}));
const byId=new Map(catalogue.records.map(r=>[r.id,r])),exhibitById=new Map(exhibits.exhibits.map(e=>[e.id,e])),examples=new Map(window.MUSEUM_LAB_EXAMPLES.map(e=>[e.id,e])),runtimes=new Map(capabilities.languages.map(r=>[r.id,r]));
const scenes=[
 {route:'c-lineage',label:'LANGUAGE & LINEAGE',title:'一个字母，<br>怎样长出新的分支？',ids:['bcpl','b','c','cpp'],selected:'c'},
 {route:'function-expressions',label:'FUNCTIONS AS VALUES',title:'把函数当作值，<br>会发生什么？',ids:['lisp','scheme','lua','javascript'],selected:'javascript'},
 {route:'python-rust-go',label:'ONE IDEA, MANY EXPRESSIONS',title:'同一个想法，<br>可以有多少种写法？',ids:['python','go','rust'],selected:'python'}
];
let sceneIndex=0,selected='c',readingId=null;
function codeFor(id){return exhibitById.get(id)?.code||window.MUSEUM_LESSONS.languages[id]?.examples.functions?.code||examples.get(id)?.code||''}
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
function openReading(id){if(!byId.has(id))return;location.hash='read/'+encodeURIComponent(id)}
function sendToLab(id){
 const topic=window.MUSEUM_LESSONS.languages[id]?.examples.functions?'functions':'default';window.MUSEUM_MODERN.openLab(id,topic);
 const code=codeFor(id);if(code){$('lab-code').value=code;$('lab-code').dispatchEvent(new Event('input',{bubbles:true}))}
 syncReading();$('lab-code').focus({preventScroll:true});
}
$('read-exhibit').onclick=()=>openReading(selected);$('try-exhibit').onclick=()=>sendToLab(selected);
const orderedReading=exhibits.exhibits.map(e=>e.id);
function renderReading(id){
 const r=byId.get(id),e=exhibitById.get(id),runtime=runtimes.get(id),code=codeFor(id),relation=e?.relation?catalogue.edges.find(edge=>[edge.from,edge.to,edge.type].join('|')===e.relation):null;
 const status=r.review?.status==='verified-language'?'已核实现':r.review?.status==='historical-primary-source'?'已有历史一手资料':'馆藏记录，仍需核对';
 const sources=[...(e?.historySources||[]),...(r.review?.sources||[]).map(s=>({title:s.role+'资料',url:s.url})),{title:'原始馆藏记录',url:r.source}];
 const unique=[...new Map(sources.filter(s=>s.url).map(s=>[s.url,s])).values()];
 $('reading-breadcrumb').textContent=r.name+' / 阅读';
 $('reading-content').innerHTML=`<header class="reading-heading"><div><p class="eyebrow">THE READING ROOM / ${escape(r.name.toUpperCase())}</p><h1 id="reading-title" tabindex="-1">${escape(e?.title||r.name+'的馆藏档案')}</h1><p class="reading-subtitle">${escape(e?.purpose||r.review?.notes||'从固定馆藏记录开始，核对这门语言的身份、来源与实现。')}</p></div><div class="reading-year">${r.year||'—'}<small>馆藏来源年代<br>${escape(r.name)} · ${status}</small></div></header><div class="reading-layout"><article class="reading-article"><section><h2><span>01</span>设计的来处</h2><p>${escape(e?.history||r.review?.notes||'这件展品尚无馆内编辑策展的历史介绍。以下记录与链接来自固定馆藏，不据此补写未经核实的设计故事。')}</p>${relation?`<div class="reading-evidence"><p>${escape(relation.evidence||'该关系来自来源字段，尚无馆内原文摘录。')}</p><a class="reading-full-link" href="${escape(safeURL(relation.source))}" target="_blank" rel="noopener">回到关系来源 ↗</a></div>`:''}<p class="reading-source-note">来源年代不等于当前实现版本；已存依据也不表示历史关系已全部找齐。</p></section>${e?`<section><h2><span>02</span>理解它的几条规则</h2><ul>${e.rules.map(rule=>'<li>'+escape(rule)+'</li>').join('')}</ul></section>`:''}<section><h2><span>03</span>把设计，放进一小段代码</h2>${code?`<div class="reading-code"><div><span>${escape(r.name)} · 馆内原创示例</span><span>NOT EXECUTED</span></div><pre>${escape(code)}</pre><button type="button" data-reading-lab="${escape(id)}">把这段代码送到实验台 <span aria-hidden="true">→</span></button></div>`:'<p>暂时没有经审核的代码示例，可先核读资料。</p>'}<p class="reading-source-note">此处只展示源码，没有预先填入运行结果；进入实验台后点击运行。</p></section><section><h2><span>04</span>版本与阅读边界</h2><p>${escape(e?.boundary||r.review?.notes||'当前记录仍需进一步核读；请以各资料明确的语言、实现和版本范围为准。')}</p></section><section><h2><span>05</span>每一步，都能回到出处</h2><ul class="reading-links">${unique.map(s=>`<li><a href="${escape(safeURL(s.url))}" target="_blank" rel="noopener">${escape(s.title)}<span aria-hidden="true">↗</span></a></li>`).join('')}</ul></section></article><aside class="reading-side"><div class="reading-side-inner"><div class="reading-specimen-card"><p class="eyebrow">SPECIMEN / LANGUAGE</p><strong>${escape(r.name)}</strong><dl><dt>年代</dt><dd>${r.year||'待核'}</dd><dt>创造者</dt><dd>${escape(r.creators||'来源尚未补齐')}</dd><dt>状态</dt><dd>${status}</dd><dt>执行</dt><dd>${runtime?.local?'浏览器本地':runtime?.remote?'远端已配置；本预览未连接':'尚未接入'}</dd></dl><button class="button primary" type="button" data-reading-lab="${escape(id)}">${code?'动手试一试':'打开草稿'} <span aria-hidden="true">→</span></button></div><p class="reading-side-note">阅读资料不会自动执行代码，也不会调用大模型。可以先理解设计，再进入实验。</p><button class="text-button" type="button" data-reading-relations="${escape(id)}">查看已记录的设计关系 ↗</button><a class="reading-full-link" href="/classic/#about" target="_blank" rel="noopener">完整出处与许可 ↗</a></div></aside></div>`;
 $('reading-title').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});
}
function syncReading(){
 const [view,id]=location.hash.slice(1).split('/'),reading=view==='read'&&byId.has(id);
 $('reading-view').hidden=!reading;document.body.classList.toggle('reading',reading);
 if(reading){for(const key of ['explore-view','collection-view','lab'])$(key).hidden=true;if(readingId!==id){readingId=id;renderReading(id)}}
 else readingId=null;
 if(view!=='lab'&&document.body.classList.contains('focus-lab'))setFocus(false);
}
$('reading-next').onclick=()=>{const i=orderedReading.indexOf(readingId);openReading(orderedReading[(i+1)%orderedReading.length])};
window.addEventListener('hashchange',syncReading);document.addEventListener('museum-lab-change',()=>queueMicrotask(syncReading));
document.addEventListener('click',event=>{
 const lab=event.target.closest('[data-reading-lab]');if(lab){sendToLab(lab.dataset.readingLab);return}
 const relations=event.target.closest('[data-reading-relations]');if(relations){const select=$('relation-language');if([...select.options].some(o=>o.value===relations.dataset.readingRelations))select.value=relations.dataset.readingRelations;location.hash='explore';window.MUSEUM_MODERN.setExplore('relations');return}
 const lang=event.target.closest('[data-language]');if(lang&&$('detail-dialog').open){const actions=document.querySelector('#detail-content .detail-actions');if(actions&&!actions.querySelector('.reading-full-link')){const a=document.createElement('a');a.className='reading-full-link';a.href='#read/'+encodeURIComponent(lang.dataset.language);a.textContent='进入完整阅读页 →';actions.after(a)}}
});
// A language selection goes straight to reading; proof dialogs remain available.
document.addEventListener('click',event=>{const b=event.target.closest('[data-language]');if(!b||!b.closest('#featured-grid,#catalogue-list,#global-results,#timeline-list'))return;event.preventDefault();event.stopImmediatePropagation();for(const d of document.querySelectorAll('dialog[open]'))d.close();openReading(b.dataset.language)},true);
function setFocus(on){document.body.classList.toggle('focus-lab',on);$('focus-lab').setAttribute('aria-pressed',String(on));$('focus-lab').textContent=on?'退出专注 ×':'专注模式 ⤢'}
$('focus-lab').onclick=()=>{setFocus(!document.body.classList.contains('focus-lab'));document.querySelector('.file-menu').open=false};document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]'))setFocus(false)});
renderExhibition();syncReading();window.MUSEUM_GALLERY={ready:true,setScene,openReading,get selected(){return selected},get scene(){return sceneIndex}};
