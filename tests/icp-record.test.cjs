const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('the public site exposes the shared ICP filing record and authority link',()=>{
  const html=fs.readFileSync(path.join(root,'src/index.html'),'utf8');
  const css=fs.readFileSync(path.join(root,'src/museum.css'),'utf8');
  assert.match(html,/京ICP备2026031619号-1/);
  assert.match(html,/href="https:\/\/beian\.miit\.gov\.cn\/"/);
  assert.match(css,/\.icp-record\{position:fixed/);
});
