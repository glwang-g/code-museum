const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('provenance categories are real tabs and render one panel at a time',()=>{
  const html=fs.readFileSync(path.join(root,'src/index.html'),'utf8');
  const js=fs.readFileSync(path.join(root,'src/credits.js'),'utf8');
  const nav=html.match(/<nav class="credits-nav"[\s\S]*?<\/nav>/)?.[0]||'';
  assert.match(nav,/role="tablist"/);
  assert.equal((nav.match(/role="tab"/g)||[]).length,5);
  assert.equal((nav.match(/aria-selected="true"/g)||[]).length,1);
  assert.match(js,/class="credit-panel"/);
  assert.match(js,/panel\.hidden=panel\.id!=='credit-panel-'\+id/);
});
