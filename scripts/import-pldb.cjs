const fs=require('fs');
const crypto=require('crypto');
const raw=fs.readFileSync(process.argv[2]);
const input=JSON.parse(raw);
const records=input.map(r=>({id:r.id,name:r.name,year:Number(r.appeared)||null,language:!!r.isLanguage,tags:r.tags||'',creators:r.creators||'',aliases:r.githubLanguage_aliases||'',website:r.website||'',wiki:r.wikipedia||'',source:'https://github.com/breck7/pldb/blob/main/concepts/'+r.id+'.scroll',influencedBy:(r.influencedBy||'').split(' ').filter(Boolean),supersetOf:(r.supersetOf||'').split(' ').filter(Boolean)})).sort((a,b)=>a.name.localeCompare(b.name));
const ids=new Set(records.map(r=>r.id));const edges=[];const unresolved=[];
for(const r of records)for(const field of ['influencedBy','supersetOf'])for(const id of r[field]){const e={from:id,to:r.id,type:field,source:r.source};(ids.has(id)?edges:unresolved).push(e)}
const data={meta:{source:'https://pldb.io/pldb.json',license:'Public domain (PLDB)',retrieved:new Date().toISOString(),sha256:crypto.createHash('sha256').update(raw).digest('hex'),count:records.length,languages:records.filter(r=>r.language).length,edgeCount:edges.length,unresolved:unresolved.length},records,edges};
fs.mkdirSync('dist/data',{recursive:true});fs.writeFileSync('dist/data/catalogue.js','window.MUSEUM_DATA='+JSON.stringify(data)+';');
fs.writeFileSync('dist/data/provenance.json',JSON.stringify({meta:data.meta,unresolved},null,2));
console.log(JSON.stringify(data.meta));
