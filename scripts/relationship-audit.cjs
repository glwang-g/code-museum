const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {webURL}=(()=>({webURL:value=>{try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password}catch{return false}}}))();
const key=e=>[e.from,e.to,e.type].join('|');
const ecological=new Set(['implementationOf','compatibleWith','extensionInterface','hostRuntime','interop']);
const types=new Set(['influencedBy','supersetOf','successorOf',...ecological]);
const text=value=>typeof value==='string'&&!!value.trim();

function auditRelationships(catalogue,reviews,overrides=[],ecosystem=[],decisions=[]){
  const ids=new Map(catalogue.records.map(r=>[r.id,r]));
  const validate=(list,name)=>{
    const seen=new Set();
    for(const e of list){
      if(!ids.has(e.from)||!ids.has(e.to)||e.from===e.to)throw new Error(`${name}: invalid relationship endpoint ${key(e)}`);
      if(!types.has(e.type)||!webURL(e.source))throw new Error(`${name}: invalid relationship type/source ${key(e)}`);
      if(seen.has(key(e)))throw new Error(`${name}: duplicate relationship ${key(e)}`);
      if(e.evidence!==undefined&&!text(e.evidence))throw new Error(`${name}: empty relationship explanation ${key(e)}`);
      seen.add(key(e));
    }
  };
  // Validate raw overrides before normalization can hide duplicate entries.
  validate(overrides,'overrides');validate(ecosystem,'ecosystem');
  const all=[...catalogue.edges,...catalogue.ecosystemEdges];validate(all,'catalogue');
  const decisionMap=new Map();
  for(const d of decisions){
    if(decisionMap.has(d.key)||!all.some(e=>key(e)===d.key)||!text(d.note)||!['needs-direct-evidence','supported'].includes(d.state))throw new Error('Invalid relationship review decision: '+d.key);
    decisionMap.set(d.key,d);
  }
  const sourceRows=reviews.reviews.flatMap(r=>r.sources.filter(s=>s.reviewed).map(s=>({...s,reviewId:r.id})));
  const warnings=[];
  const relations=all.map(e=>{
    const matches=sourceRows.filter(s=>s.url===e.source||s.finalUrl===e.source);
    const sources=[...new Map(matches.map(s=>[s.decodedBodySha256,s])).values()];
    const decision=decisionMap.get(key(e));
    const cited=text(e.evidence),hashes=new Set(sources.map(s=>s.decodedBodySha256));
    if(e.sourceSha256&&!/^[a-f0-9]{64}$/.test(e.sourceSha256))throw new Error('Invalid relationship source hash: '+key(e));
    const state=decision?.state==='needs-direct-evidence'?'needs-direct-evidence':!cited?'field-only':sources.length?'excerpt-recorded':'citation-only';
    const issues=[];
    if(!cited)issues.push('缺少关系论证');
    if(cited&&!sources.length)issues.push('缺少已阅读原文摘录');
    if(e.sourceSha256&&sources.length&&!hashes.has(e.sourceSha256))issues.push('引用哈希与已存摘录版本不同');
    const from=ids.get(e.from),to=ids.get(e.to),layer=ecological.has(e.type)?'ecosystem':'design';
    if(layer==='design'&&from.year&&to.year&&from.year>to.year){issues.push('上游馆藏年代晚于下游，需核对版本或事件');warnings.push({kind:'chronology',key:key(e),fromYear:from.year,toYear:to.year});}
    if(decision?.state==='needs-direct-evidence')issues.push(decision.note);
    return {...e,key:key(e),layer,state,issues,reviewNote:decision?.note||'',mapVisible:!!(from.mapEligible&&to.mapEligible&&from.year&&to.year),sources:sources.map(s=>({url:s.url,finalUrl:s.finalUrl,title:s.title,excerpt:s.excerpt,checkedAt:s.checkedAt,sha256:s.decodedBodySha256,hashScope:s.hashScope||'decoded response body',reviewId:s.reviewId}))};
  });
  // Cycles are review leads, not proof that a historical claim is false.
  const adj=new Map(),color=new Map(),stack=[];
  for(const e of relations.filter(e=>e.layer==='design')){if(!adj.has(e.from))adj.set(e.from,[]);adj.get(e.from).push(e.to);}
  function visit(id){color.set(id,1);stack.push(id);for(const to of adj.get(id)||[]){if(color.get(to)===1)warnings.push({kind:'cycle',ids:[...stack.slice(stack.indexOf(to)),to]});else if(!color.get(to))visit(to)}stack.pop();color.set(id,2);}
  for(const id of adj.keys())if(!color.get(id))visit(id);
  const labels=catalogue.meta.mapLabelIds.map(id=>{
    const r=ids.get(id),links=relations.filter(e=>e.from===id||e.to===id),design=links.filter(e=>e.layer==='design'),visible=design.filter(e=>e.mapVisible);
    return {id,name:r.name,year:r.year,languageStatus:r.review?.status||'unreviewed',upstream:design.filter(e=>e.to===id).map(e=>e.key),downstream:design.filter(e=>e.from===id).map(e=>e.key),ecology:links.filter(e=>e.layer==='ecosystem').map(e=>e.key),mapLinks:visible.length,fieldOnly:design.filter(e=>e.state==='field-only').length,citationOnly:design.filter(e=>e.state==='citation-only').length,needsDirectEvidence:design.filter(e=>e.state==='needs-direct-evidence').length,excerptRecorded:design.filter(e=>e.state==='excerpt-recorded').length,state:!design.length?'no-design-link':design.some(e=>e.state!=='excerpt-recorded')?'needs-review':'excerpts-recorded'};
  });
  const counts={};for(const e of relations)counts[e.state]=(counts[e.state]||0)+1;
  return {schemaVersion:1,scope:'全量关系结构检查与常显标签逐项盘点；摘录已存不等于史料论证或关系覆盖全部核实。缺线不表示没有上游。',summary:{labels:labels.length,relations:relations.length,mapDesignGaps:labels.filter(r=>!r.mapLinks).length,states:counts,warnings:warnings.length},labels,relations,warnings};
}
function generateRelationshipAudit(root,catalogue){
  const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
  const report=auditRelationships(catalogue,read('data/audit/reviews.json'),read('data/relationship-overrides.json'),read('data/ecosystem-relations.json'),read('data/audit/relationship-decisions.json'));
  report.inputHashes=Object.fromEntries(['data/raw/pldb.json','data/audit/reviews.json','data/relationship-overrides.json','data/ecosystem-relations.json','data/audit/relationship-decisions.json','data/audit/label-selection.json'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
  return report;
}
if(require.main===module){
  const root=path.resolve(__dirname,'..'),{generateCatalogue}=require('./import-pldb.cjs');
  const report=generateRelationshipAudit(root,generateCatalogue(root));
  fs.writeFileSync(path.join(root,'data/audit/relationship-status.json'),JSON.stringify(report,null,2)+'\n');
  const states={'no-design-link':'未收录设计关系','needs-review':'仍需复核','excerpts-recorded':'现有关系摘录已存'};
  const rows=report.labels.map(r=>`| ${r.name.replace(/\|/g,'\\|')} | ${r.upstream.length} | ${r.downstream.length} | ${r.ecology.length} | ${r.fieldOnly} | ${r.citationOnly} | ${r.needsDirectEvidence} | ${states[r.state]} |`);
  fs.writeFileSync(path.join(root,'docs/audit/RELATIONSHIP_STATUS.md'),`# 常显语言关系与证据盘点\n\n由 \`npm run relations:audit\` 离线生成。${report.scope}\n\n- 常显标签：${report.summary.labels}；全量关系：${report.summary.relations}（含生态层）。\n- 常显设计层地图连线缺口：${report.summary.mapDesignGaps}；年代/环路警告：${report.summary.warnings}。\n- 证据状态：${JSON.stringify(report.summary.states)}。\n\n上游/下游包含地图外档案关系。引用缺摘录与直接依据待补单独列出；不以有连线代替关系完备性。\n\n| 语言 | 上游 | 下游 | 生态 | 字段待核 | 引用缺摘录 | 直接依据待补 | 状态 |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |\n${rows.join('\n')}\n\n完整逐边记录、警告与输入哈希见 [JSON](../../data/audit/relationship-status.json)。\n`);
  console.log(JSON.stringify(report.summary));
}
module.exports={auditRelationships,generateRelationshipAudit,key};
