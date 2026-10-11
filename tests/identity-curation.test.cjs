const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('curated false aliases are explicit and do not rewrite the raw snapshot',()=>{
  const curation=JSON.parse(fs.readFileSync(path.join(root,'data/audit/alias-curation.json'),'utf8'));
  const records=JSON.parse(fs.readFileSync(path.join(root,'data/raw/pldb.json'),'utf8'));
  const byId=new Map(records.map(record=>[record.id,record]));
  assert.equal(new Set(curation.map(item=>item.id)).size,curation.length);
  for(const [id,alias] of Object.entries({perl:'cperl',ruby:'jruby','common-lisp':'lisp','visual-basic.net':'visual basic'})){
    assert.ok(curation.some(item=>item.id===id&&item.exclude.includes(alias)),`${id} must exclude ${alias}`);
    assert.ok(String(byId.get(id)?.githubLanguage_aliases||'').includes(alias),`raw snapshot must retain ${alias}`);
    assert.ok(curation.find(item=>item.id===id&&item.exclude.includes(alias)).source.startsWith('https://'));
  }
});
