const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function learningPaths(root,catalogue,audit){
 const data=JSON.parse(fs.readFileSync(path.join(root,'data/learning-paths.json')));
 if(data.schemaVersion!==1||!Array.isArray(data.routes)||!data.routes.length)throw new Error('Invalid learning paths');
 const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'src/learning-examples.js'),'utf8'),context);
 const lessons=context.window.MUSEUM_LESSONS,ids=new Set(catalogue.records.map(r=>r.id)),topics=new Set(lessons.topics.map(t=>t.id)),routes=new Set();
 const text=v=>typeof v==='string'&&v.trim().length>0;
 for(const route of data.routes){
  if(!/^[a-z][a-z0-9-]{0,39}$/.test(route.id)||routes.has(route.id)||!text(route.title)||!text(route.description)||!Array.isArray(route.steps)||!route.steps.length||route.steps.length>10)throw new Error('Invalid learning route');
  routes.add(route.id);
  for(const step of route.steps){
   if(!text(step.title)||!text(step.note)||!['archive','proof','compare','lesson'].includes(step.action))throw new Error('Invalid learning step');
   if(![step.observe,step.change,step.expected].every(text))throw new Error('Learning step requires observation, task and expected result');
   if(step.check&&(step.action!=='lesson'||!['javascript','scheme'].includes(step.language)||!text(step.check.output)))throw new Error('Output checks require an explicitly supported local exercise');
   if(step.action==='archive'&&!ids.has(step.language))throw new Error('Unknown learning language');
   if(step.action==='proof'&&!audit.relations.some(e=>e.key===step.key&&e.state==='excerpt-recorded'&&e.sources.length))throw new Error('Learning relationship requires reviewed excerpts');
   if(['compare','lesson'].includes(step.action)){
    const languages=step.action==='compare'?[step.left,step.right]:[step.language];
    if(!topics.has(step.topic)||languages.some(id=>!ids.has(id)||!lessons.languages[id]?.examples[step.topic]))throw new Error('Missing learning example');
   }
  }
 }
 return data;
}
module.exports={learningPaths};
