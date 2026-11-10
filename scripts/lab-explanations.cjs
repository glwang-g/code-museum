const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
function labExplanations(root){
  const context={window:{}};
  for(const file of ['lab-examples.js','learning-examples.js'])vm.runInNewContext(fs.readFileSync(path.join(root,'src',file),'utf8'),context,{timeout:1000});
  const samples=new Map(context.window.MUSEUM_LAB_EXAMPLES.map(row=>[row.id+':default',row.code]));
  for(const [id,language] of Object.entries(context.window.MUSEUM_LESSONS.languages))for(const [topic,row] of Object.entries(language.examples))samples.set(id+':'+topic,row.code);
  const data=JSON.parse(fs.readFileSync(path.join(root,'data/lab-explanations.json'),'utf8')),seen=new Set();
  if(data.schemaVersion!==1||!Array.isArray(data.entries))throw new Error('Invalid lab explanation data');
  const entries=data.entries.map(row=>{
    const key=row.language+':'+row.topic,code=samples.get(key);
    if(seen.has(key)||typeof code!=='string'||crypto.createHash('sha256').update(code).digest('hex')!==row.codeSha256)throw new Error('Stale or duplicate lab explanation: '+key);
    seen.add(key);
    if(![row.overview,row.stdin].every(v=>typeof v==='string'&&v.trim()&&v.length<=1000)||!Array.isArray(row.steps)||row.steps.length<2||row.steps.length>8)throw new Error('Incomplete lab explanation: '+key);
    const count=code.trimEnd().split('\n').length;
    for(const step of row.steps){
      if(!Number.isInteger(step.from)||!Number.isInteger(step.to)||step.from<1||step.to<step.from||step.to>count||![step.title,step.detail].every(v=>typeof v==='string'&&v.trim()&&v.length<=1000))throw new Error('Invalid explanation line range or text: '+key);
    }
    return {...row,code};
  });
  if(seen.size!==samples.size)throw new Error('Missing lab explanation for a museum example');
  return {schemaVersion:1,scope:data.scope,entries};
}
module.exports={labExplanations};
