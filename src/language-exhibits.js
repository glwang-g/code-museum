(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const exhibits=new Map(window.MUSEUM_EXHIBITS.exhibits.map(e=>[e.id,e]));
 window.MUSEUM_EXHIBIT_UI={
  render(id){
   const e=exhibits.get(id);if(!e)return '';
   return `<section class="language-exhibit"><h3>语言展品 · ${esc(e.title)}</h3><p>${esc(e.purpose)}</p><details class="archive-section"><summary>设计背景与核心规则</summary><p>${esc(e.history)}</p><button type="button" data-exhibit-proof="${esc(e.relation)}">阅读设计依据 ↗</button><ul>${e.rules.map(rule=>`<li>${esc(rule)}</li>`).join('')}</ul><p>${esc(e.boundary)}</p>${e.historySources.map(s=>`<p><a href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(s.title)} ↗</a></p>`).join('')}</details><details class="archive-section"><summary>读一段代码 · ${esc(e.version)}</summary><pre tabindex="0" aria-label="${esc(e.version)} 原创函数示例"><code>${esc(e.code)}</code></pre><p>${esc(e.exercise)}</p><button type="button" data-exhibit-lesson="${esc(e.id)}" data-topic="${esc(e.topic)}">在实验台改写 ↗</button><p><a href="${esc(e.syntaxSource)}" target="_blank" rel="noreferrer">语法参考 ↗</a></p></details>${id==='javascript'?'<button type="button" data-exhibit-guide="javascript-first-program">开始：从变量到列表 ↗</button>':''}</section>`;
  },
  bind(container){
   for(const b of container.querySelectorAll('[data-exhibit-proof]'))b.onclick=()=>window.MUSEUM_RELATIONS_UI.open(b.dataset.exhibitProof);
   for(const b of container.querySelectorAll('[data-exhibit-lesson]'))b.onclick=()=>window.MUSEUM_LAB.openLesson(b.dataset.exhibitLesson,b.dataset.topic);
   for(const b of container.querySelectorAll('[data-exhibit-guide]'))b.onclick=()=>window.MUSEUM_GUIDE.start(b.dataset.exhibitGuide);
  }
 };
 const notes=new Map(window.MUSEUM_RESEARCH_TRIAGE.items.map(e=>[e.key,e]));
 window.MUSEUM_RESEARCH_NOTES={render(key){
  const e=notes.get(key);if(!e)return '';
  return `<aside class="research-note" data-research-key="${esc(key)}"><h4>${esc(e.title)}</h4><p>${esc(e.note)}</p><p>下一步：${esc(e.nextStep)}</p><small>固定证据分诊；不表示已补齐历史关系。</small></aside>`;
 }};
})();
