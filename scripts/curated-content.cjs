const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function curatedContent(root,catalogue,audit){
 const read=name=>JSON.parse(fs.readFileSync(path.join(root,'data',name),'utf8'));
 const exhibits=read('language-exhibits.json'),triage=read('research-triage.json');
 const context={window:{}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'src/learning-examples.js'),'utf8'),context);
 const lessons=context.window.MUSEUM_LESSONS;
 const ids=new Set(catalogue.records.map(r=>r.id)),seen=new Set();
 const text=v=>typeof v==='string'&&v.trim().length>0;
 if(exhibits.schemaVersion!==1||!Array.isArray(exhibits.exhibits)||!exhibits.exhibits.length)throw new Error('Invalid exhibits');
 for(const item of exhibits.exhibits){
  const lesson=lessons.languages[item.id],relation=audit.relations.find(e=>e.key===item.relation);
  if(!ids.has(item.id)||seen.has(item.id)||!['title','purpose','history','boundary','exercise','comment'].every(k=>text(item[k]))||!Array.isArray(item.rules)||!item.rules.length||!item.rules.every(text)||!lesson?.examples[item.topic])throw new Error('Invalid exhibit: '+item.id);
  if(!relation||![relation.from,relation.to].includes(item.id)||relation.state!=='excerpt-recorded'||!relation.sources.length)throw new Error('Exhibit history requires a matching recorded excerpt: '+item.id);
  seen.add(item.id);
  item.code=item.comment+'\n'+lesson.examples[item.topic].code;
  item.version=lesson.version;item.syntaxSource=lesson.source;
  item.historySources=relation.sources.map(({title,url})=>({title,url}));
 }
 if(triage.schemaVersion!==1||!Array.isArray(triage.items))throw new Error('Invalid research triage');
 const keys=new Set();
 for(const item of triage.items){
  const relation=audit.relations.find(e=>e.key===item.key);
  if(keys.has(item.key)||!['title','note','nextStep'].every(k=>text(item[k]))||!['scoped','needs-primary-source','blocked-endpoint','needs-specific-identity'].includes(item.status))throw new Error('Invalid research triage item');
  if(item.key.startsWith('language:')){
   const id=item.key.slice(9);
   if(!audit.labels.some(r=>r.id===id&&!r.mapLinks))throw new Error('Stale research gap: '+id);
   const ledgerId=id==='assembly-language'?'assembly|design-layer-gap':id+'|design-layer-gap';
   // Ledger entries are read from the fixed input, not inferred from absent edges.
   const input=read('audit/relationship-research-ledger.json').entries.find(e=>e.id===ledgerId);
   if(!input)throw new Error('Missing research ledger gap: '+id);
   item.ledger={id:input.id,status:input.status,batch:input.batch};
  }else{
   if(!relation||!audit.warnings.some(w=>w.key===item.key))throw new Error('Stale chronology triage: '+item.key);
   if(item.status==='scoped'&&(relation.state!=='excerpt-recorded'||!relation.sources.length))throw new Error('Scoped chronology requires recorded evidence');
   item.sources=relation.sources.map(({title,url})=>({title,url}));
  }
  keys.add(item.key);
 }
 return {exhibits,triage};
}
module.exports={curatedContent};
