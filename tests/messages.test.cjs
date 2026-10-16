const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'src/messages.js'),'utf8');
const html=fs.readFileSync(path.join(root,'src/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'src/museum.css'),'utf8');
const themes=fs.readFileSync(path.join(root,'src/themes.css'),'utf8');
test('guest book posts to the same-origin endpoint and reuses one anonymous visitor id',()=>{
  assert.match(html,/<script src="messages\.js" defer>/);
  assert.match(js,/const API = '\/api\/messages'/);
  assert.match(js,/credentials: 'same-origin'/);
  assert.match(js,/visitorId: visitorId\(\), eventId/);
  const key=/const STORAGE = '([^']+)'/.exec(js)[1];
  assert.match(fs.readFileSync(path.join(root,'src/analytics.js'),'utf8'),new RegExp(`'${key}'`));
});
test('guest book keeps an idempotent event id and shows the server note',()=>{
  assert.match(js,/eventId = crypto\.randomUUID\(\)/);
  assert.match(js,/data\.note \|\| '留言已发布/);
  assert.match(js,/COOLDOWN = 20/);
});
test('guest book renders messages as text and never invents entries',()=>{
  assert.equal((js.match(/innerHTML\s*=\s*(?=[^'\s])/g)||[]).length,0);
  assert.match(js,/text\.textContent = item\.body/);
  assert.match(js,/author\.textContent = item\.author/);
  assert.match(js,/留言服务未接入：本地预览或后端不可用时，这里不会显示真实留言。/);
  assert.match(js,/还没有留言，欢迎写下第一条。/);
  assert.match(js,/不记录 IP、邮箱、账号或原始匿名标识/);
  assert.match(js,/匿名标识哈希/);
  assert.match(js,/如已配置通知服务/);
});
test('guest book dialog is dismissible and returns focus to its trigger',()=>{
  assert.match(js,/id = 'messages-open'/);
  assert.match(js,/id = 'messages-dialog'/);
  assert.match(js,/dialog\.showModal\(\)/);
  assert.match(js,/event\.target === dialog/);
  assert.match(js,/trigger\.focus\(\)/);
});
test('guest book cooldown survives closing the dialog so the client agrees with the server limit',()=>{
  const close=/dialog\.addEventListener\('close',[\s\S]*?\n  \}\);/.exec(js)[0];
  assert.doesNotMatch(close,/cooldownUntil\s*=/);
  assert.doesNotMatch(close,/clearInterval\(cooldownTimer\)/);
});
test('guest book styling keeps the restrained support palette in both themes',()=>{
  assert.match(css,/\.guest-trigger:hover,\.guest-trigger:focus-visible\{border-color:#806437;background:#172a31\}/);
  assert.match(css,/\.guest-dialog\{/);
  assert.match(css,/\.guest-log li\{/);
  assert.match(themes,/:root\[data-theme="light"\] \.guest-trigger:is\(:hover,:focus-visible\)\{background:#f2ece0/);
});
test('every script tag in the shell is closed so the deferred files actually run',()=>{
  const tokens=html.match(/<script\b[^>]*>|<\/script>/g)||[];
  let open=false;
  for(const token of tokens){
    if(token==='</script>'){assert.equal(open,true,'a closing script tag has no matching opening tag');open=false;}
    else{assert.equal(open,false,'a script tag opens before the previous one is closed');open=true;}
  }
  assert.equal(open,false,'a script tag is left unclosed');
  assert.match(html,/<script src="visit-counts\.js" defer><\/script><script src="messages\.js" defer>/);
});
test('guest book resolves the header badge from its trigger, not from inside the dialog',()=>{
  assert.doesNotMatch(js,/\$\('guest-badge'\)/);
  assert.match(js,/badge = trigger\.querySelector\('#guest-badge'\)/);
});
