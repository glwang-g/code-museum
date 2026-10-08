(()=>{
  const report=window.MUSEUM_RELATIONSHIP_AUDIT,section=document.querySelector('#relationship-coverage');
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const names=new Map(window.MUSEUM_DATA.records.map(r=>[r.id,r.name]));
  const notes={
    'assembly-language':'汇编是类别总称，需按指令集与方言研究，不能统一连成高级语言祖先。',
    dart:'已查官方规范源码；编译到 JavaScript/Wasm 不足以证明设计影响，继续寻找设计者原文。',
    xslt:'规范说明 XPath 表达式与执行语义；引用 DSSSL 本身不足以证明设计继承。',
    zig:'已存 C ABI 互操作依据，在生态层可见；尚未补足设计影响论证。'
  };
  section.innerHTML=`<h3>常显语言关系核对</h3><p>${report.summary.labels} 个常显标签已逐项盘点 · ${report.summary.relations} 条设计与生态关系 · ${report.summary.mapDesignGaps} 个常显标签暂无设计层地图内连线。</p><p>盘点检查的是当前记录与证据缺口。原文摘录已存不等于史料论证全部成立，也不代表关系已经找全。</p><details id="relationship-label-review"><summary>查看逐语言上游、下游及待核清单</summary><label class="relationship-filter">筛选 <select id="relationship-review-filter"><option value="all">全部常显语言</option><option value="pending">仍需复核或补关系</option><option value="gaps">暂无设计层地图连线</option></select></label><div id="relationship-label-rows"></div></details><details><summary>年代与环路检查：${report.warnings.length} 项待核</summary><ul>${report.warnings.map(w=>`<li>${escape(w.kind==='chronology'?w.key.split('|').slice(0,2).map(id=>names.get(id)).join(' → ')+`：${w.fromYear} → ${w.toYear}；需区分首次出现与后来特性引入。`:'设计关系环路：'+w.ids.map(id=>names.get(id)).join(' → '))}</li>`).join('')}</ul></details><p><a href="data/relationship-status.json">下载逐语言与逐关系记录 ↗</a> · <a href="data/audit-reviews.json">原文摘录与审查记录 ↗</a></p>`;
  const rows=section.querySelector('#relationship-label-rows'),filter=section.querySelector('#relationship-review-filter');
  function render(){
    const shown=report.labels.filter(r=>filter.value==='gaps'?!r.mapLinks:filter.value==='pending'?r.state!=='excerpts-recorded':true);
    rows.innerHTML=shown.map(r=>`<article class="relationship-review-row"><button type="button" data-review-language="${escape(r.id)}">${escape(r.name)} ↗</button><p>设计上游 ${r.upstream.length} · 下游 ${r.downstream.length} · 生态 ${r.ecology.length} · 地图内设计线 ${r.mapLinks}</p><p>${r.state==='excerpts-recorded'?'现有设计关系摘录已存，覆盖仍需持续核对':r.state==='no-design-link'?'未收录设计关系；不表示没有历史上游':`字段待核 ${r.fieldOnly} · 引用缺摘录 ${r.citationOnly} · 直接依据待补 ${r.needsDirectEvidence}`}</p>${notes[r.id]?`<p>${escape(notes[r.id])}</p>`:''}</article>`).join('');
  }
  filter.onchange=render;render();
  rows.addEventListener('click',event=>{const button=event.target.closest('[data-review-language]');if(button)window.MUSEUM_RELATIONS_UI.openLanguage(button.dataset.reviewLanguage)});
})();
