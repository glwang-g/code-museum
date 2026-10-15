const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {curatedContent}=require('../scripts/curated-content.cjs');
const {generateCatalogue}=require('../scripts/import-pldb.cjs'),{generateRelationshipAudit}=require('../scripts/relationship-audit.cjs');
const root=path.resolve(__dirname,'..');
test('exhibits cannot promote field-only histories and triage cannot silently outlive its warning',()=>{
 const c=generateCatalogue(root),a=generateRelationshipAudit(root,c),content=curatedContent(root,c,a);
 assert.equal(content.exhibits.exhibits.length,8);
 const altered=structuredClone(a),relation=altered.relations.find(e=>e.key===content.exhibits.exhibits[0].relation);relation.state='field-only';relation.sources=[];
 assert.throws(()=>curatedContent(root,c,altered),/matching recorded excerpt/);
 const stale=structuredClone(a);stale.warnings=stale.warnings.filter(w=>w.key!=='gofer|haskell|influencedBy');
 assert.throws(()=>curatedContent(root,c,stale),/Stale chronology/);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cm-exhibits-'));
 try{
  for(const folder of ['data','src'])fs.mkdirSync(path.join(dir,folder));
  for(const name of ['language-exhibits.json','research-triage.json'])fs.copyFileSync(path.join(root,'data',name),path.join(dir,'data',name));
  fs.copyFileSync(path.join(root,'src/learning-examples.js'),path.join(dir,'src/learning-examples.js'));
  const data=JSON.parse(fs.readFileSync(path.join(dir,'data/language-exhibits.json')));data.exhibits[0].id='missing-language';
  fs.writeFileSync(path.join(dir,'data/language-exhibits.json'),JSON.stringify(data));assert.throws(()=>curatedContent(dir,c,a),/Invalid exhibit/);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
