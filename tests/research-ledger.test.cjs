const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('research ledger stays synchronized with relationship audit',()=>{
  const ledger=JSON.parse(fs.readFileSync(path.join(root,'data/audit/relationship-research-ledger.json'),'utf8'));
  const status=JSON.parse(fs.readFileSync(path.join(root,'data/audit/relationship-status.json'),'utf8'));
  const keys=new Set(status.relations.map(relation=>relation.key));
  const ids=new Set();
  for(const entry of ledger.entries){
    assert.ok(entry.id&&entry.status&&entry.note,'Every ledger entry needs id, status and note');
    assert.equal(ids.has(entry.id),false,'Duplicate ledger ID: '+entry.id);ids.add(entry.id);
    if(entry.status!=='verified')assert.ok(entry.reopenWhen,'Closed/blocked research needs reopenWhen: '+entry.id);
    if(entry.status==='verified'&&keys.has(entry.id)){
      const relation=status.relations.find(item=>item.key===entry.id);
      assert.notEqual(relation.state,'field-only','Verified ledger entry is still field-only: '+entry.id);
      assert.notEqual(relation.state,'citation-only','Verified ledger entry lacks a read excerpt: '+entry.id);
    }
  }
});
