const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {generateCredits}=require('../scripts/credits.cjs');
const root=path.resolve(__dirname,'..');
test('Credits identify actual runtimes and derive versions from pinned manifests',()=>{
  const {credits,linguistLicense}=generateCredits(root);
  const entries=credits.groups.flatMap(group=>group.entries),find=id=>entries.find(entry=>entry.id===id);
  assert.equal(find('pyodide').version,JSON.parse(fs.readFileSync(path.join(root,'public/assets/pyodide/manifest.json'))).version);
  assert.equal(find('wasmoon').versionLabel,'Wasmoon 1.16.0 · Lua 5.4.5');
  assert.equal(find('biwascheme').version,'0.8.3');assert.match(find('biwascheme').usage,/非 WebAssembly/);
  assert.equal(find('pldb').retrieved.slice(0,10),'2026-09-23');
  assert.equal(find('linguist').commit,'76f88c6d3c22f8560d22d29854f24d9607f9edde');
  assert.equal(find('tiobe').versionLabel,'榜单 · 2026-09');assert.equal(find('tiobe').languages,undefined);
  assert.match(linguistLicense.toString(),/Copyright \(c\) 2017 GitHub/);
  assert.deepEqual(entries.filter(entry=>!entry.runtimeIds).flatMap(entry=>entry.languages||[]),['javascript','python','lua','scheme']);
  assert.equal(find('remote-rust').versionLabel,JSON.parse(fs.readFileSync(path.join(root,'server/runtime-images.json'))).runtimes.find(r=>r.id==='rust').version);
});
test('Runtime credit notices and provenance artifacts are local source inputs',()=>{
  const {credits}=generateCredits(root);
  for(const entry of credits.groups.flatMap(group=>group.entries)){
    if(!entry.manifest)continue;
    assert.ok(fs.existsSync(path.join(root,'public',entry.evidence)));
    for(const notice of entry.notices||[])assert.ok(fs.existsSync(path.join(root,'public',notice.href)));
    assert.match(entry.source,/^https:\/\//);
  }
});
