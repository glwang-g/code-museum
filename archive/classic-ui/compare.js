(() => {
  const $=id=>document.getElementById(id),data=window.MUSEUM_LESSONS;
  const records=new Map(window.MUSEUM_DATA.records.map(r=>[r.id,r]));
  const audit=window.MUSEUM_RELATIONSHIP_AUDIT.relations;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stateNames={'field-only':'来源字段，关系待核','citation-only':'有引用，缺匹配摘录','excerpt-recorded':'论证与引用摘录已存','needs-direct-evidence':'直接设计依据待补'};
  const typeNames={supersetOf:'超集扩展',successorOf:'后继',influencedBy:'设计影响',implementationOf:'语言实现',compatibleWith:'语法兼容',extensionInterface:'扩展接口',hostRuntime:'宿主运行时',interop:'互操作'};
  function relation(edge){
    return `<article class="compare-relation"><strong>${esc(records.get(edge.from)?.name||edge.from)} → ${esc(records.get(edge.to)?.name||edge.to)}</strong><span>${esc(edge.label||typeNames[edge.type]||'影响')} · ${esc(edge.layer==='ecosystem'?'实现与生态':'设计脉络')} · ${esc(stateNames[edge.state]||edge.state)}</span><p>${esc(edge.evidence||'当前仅记录来源字段，历史论证仍待核实。')}</p><button type="button" data-compare-proof="${esc(edge.key)}">查看关系依据 ↗</button></article>`;
  }
  function column(id){
    const record=records.get(id),entry=data.languages[id],topic=$('compare-topic').value,example=entry.examples[topic];
    const upstream=audit.filter(e=>e.to===id&&e.layer==='design'),downstream=audit.filter(e=>e.from===id&&e.layer==='design');
    return `<article class="compare-language" data-compare-language="${id}"><div class="compare-language-heading"><h3>${esc(record.name)}</h3><span class="compare-runtime">${esc(entry.runtime)}</span></div><dl class="compare-facts"><div><dt>来源年代</dt><dd>${esc(record.year||'未记载')} · 具体事件口径见档案</dd></div><div><dt>创造者</dt><dd>${esc(record.creators||'来源未记载')}</dd></div><div><dt>设计取向</dt><dd>${esc(entry.goal)} <a href="${esc(entry.source)}" target="_blank" rel="noreferrer">语言资料 ↗</a></dd></div><div><dt>示例语法</dt><dd>${esc(entry.version)}</dd></div></dl><div class="compare-code-heading"><strong>${esc(data.topics.find(t=>t.id===topic).name)}</strong><button type="button" data-compare-lab="${id}">${window.MUSEUM_LAB.entry(id).label+' · 打开实验台 ↗'}</button></div><pre class="compare-code" tabindex="0" aria-label="${esc(record.name)}示例">${window.MUSEUM_LAB.formatCode(example.code,id)}</pre><p class="compare-code-note">${esc(example.note)} 进入实验台会保留该主题已有草稿。</p><details class="compare-neighbours"><summary>设计上游 ${upstream.length} · 下游 ${downstream.length}</summary><p>以下为当前馆藏已记录关系，包含待核记录。</p>${[...upstream,...downstream].map(relation).join('')||'<p>尚无记录，仍需研究。</p>'}</details><button type="button" data-compare-archive="${id}">查看语言档案与来源 ↗</button></article>`;
  }
  function render(){
    const left=$('compare-left').value,right=$('compare-right').value;
    const pair=left+','+right;$('compare-preset').value=[...$('compare-preset').options].some(o=>o.value===pair)?pair:'';
    $('compare-task').textContent=data.topics.find(t=>t.id===$('compare-topic').value).task;
    $('compare-columns').innerHTML=column(left)+column(right);
    const between=audit.filter(e=>(e.from===left&&e.to===right)||(e.from===right&&e.to===left));
    $('compare-relations').innerHTML=left===right?'<p>两侧是同一门语言，可以切换一侧进行对比。</p>':between.map(relation).join('')||'<p>当前数据尚未记录这两门语言之间的直接关系；可展开各自上游、下游或查看档案继续探索。</p>';
    for(const b of document.querySelectorAll('[data-compare-proof]'))b.onclick=()=>window.MUSEUM_RELATIONS_UI.open(b.dataset.compareProof);
    for(const b of document.querySelectorAll('[data-compare-lab]'))b.onclick=()=>window.MUSEUM_LAB.openLesson(b.dataset.compareLab,$('compare-topic').value);
    for(const b of document.querySelectorAll('[data-compare-archive]'))b.onclick=()=>window.MUSEUM_RELATIONS_UI.openLanguage(b.dataset.compareArchive);
  }
  const options=Object.keys(data.languages).map(id=>`<option value="${id}">${esc(records.get(id).name)}</option>`).join('');
  $('compare-left').innerHTML=options;$('compare-right').innerHTML=options;
  $('compare-topic').innerHTML=data.topics.map(t=>`<option value="${t.id}">${t.name}</option>`).join('');
  $('compare-left').value='c';$('compare-right').value='cpp';
  for(const id of ['compare-left','compare-right','compare-topic'])$(id).onchange=render;
  $('compare-preset').onchange=()=>{const [left,right]=$('compare-preset').value.split(',');if(!left||!right)return;$('compare-left').value=left;$('compare-right').value=right;render()};
  $('compare-swap').onclick=()=>{const left=$('compare-left').value;$('compare-left').value=$('compare-right').value;$('compare-right').value=left;render()};
  document.addEventListener('museum-execution-change',render);
  window.MUSEUM_COMPARE={open(left,right,topic){if(!data.languages[left]||!data.languages[right]||!data.topics.some(t=>t.id===topic))return;$('compare-left').value=left;$('compare-right').value=right;$('compare-topic').value=topic;render();$('compare-view').click()}};
  render();
})();
