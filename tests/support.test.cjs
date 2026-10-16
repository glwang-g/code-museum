const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('voluntary support is a dismissible dialog with a tracked public code asset',()=>{
  const js=fs.readFileSync(path.join(root,'src/navigation.js'),'utf8');
  assert.match(js,/id='support-open'/);
  assert.match(js,/id='support-dialog'/);
  assert.match(js,/assets\/support\/coffee-appreciation-code\.jpg/);
  assert.match(js,/完全自愿，所有内容仍免费开放/);
  assert.ok(fs.statSync(path.join(root,'public/assets/support/coffee-appreciation-code.jpg')).size>10000);
  assert.match(js,/supportDialog\.showModal\(\)/);
  assert.match(js,/event\.target===supportDialog/);
  assert.match(js,/supportDialog\.addEventListener\('close',\(\)=>supportButton\.focus\(\)\)/);
});
