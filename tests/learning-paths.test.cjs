const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {learningPaths}=require('../scripts/learning-paths.cjs'),{generateCatalogue}=require('../scripts/import-pldb.cjs'),{generateRelationshipAudit}=require('../scripts/relationship-audit.cjs');
const root=path.resolve(__dirname,'..');
test('learning paths use valid archives, examples and specifically recorded relationship excerpts',()=>{
 const c=generateCatalogue(root),a=generateRelationshipAudit(root,c),p=learningPaths(root,c,a);assert.equal(p.routes.length,3);assert.equal(p.routes.reduce((n,r)=>n+r.steps.length,0),16);
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cm-paths-'));
 try{
  fs.mkdirSync(path.join(temp,'data'));fs.mkdirSync(path.join(temp,'src'));fs.copyFileSync(path.join(root,'src/learning-examples.js'),path.join(temp,'src/learning-examples.js'));
  const file=path.join(temp,'data/learning-paths.json');
  const altered=structuredClone(p),key=altered.routes[0].steps[1].key;fs.writeFileSync(file,JSON.stringify(altered));
  const fieldOnly=structuredClone(a);Object.assign(fieldOnly.relations.find(r=>r.key===key),{state:'field-only',sources:[]});assert.throws(()=>learningPaths(temp,c,fieldOnly),/reviewed excerpts/);
  const withoutExcerpt=structuredClone(a);withoutExcerpt.relations.find(r=>r.key===key).sources=[];assert.throws(()=>learningPaths(temp,c,withoutExcerpt),/reviewed excerpts/);
  altered.routes[0].steps[1].key=p.routes[0].steps[1].key;altered.routes[0].steps[4].topic='invented';fs.writeFileSync(file,JSON.stringify(altered));assert.throws(()=>learningPaths(temp,c,a),/Missing learning example/);
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
