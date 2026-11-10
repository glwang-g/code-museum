const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {normalize,index,search}=require('../src/credits-search.js'),{generateCredits}=require('../scripts/credits.cjs');
const rows=[{id:'py',name:'Python',category:'runtime',searchText:'CPython 3.12 MIT 解释器'},{id:'wasm',name:'Pyodide',category:'runtime',searchText:'Python 3.12 浏览器 WebAssembly MPL'},{id:'lua',name:'Lua',category:'runtime',searchText:'Wasmoon Lua 5.4.5 MIT'},{id:'data',name:'PLDB',category:'data',searchText:'馆藏 数据 CC0'}];
test('credit search normalizes case and full width, keeps language punctuation and combines partial fields',()=>{
 const data=index(rows);assert.equal(normalize(' ＰＹＴＨＯＮ / C++ / C# '),'python c++ c#');
 assert.deepEqual(search(data,'ＰＹＴＨＯＮ 3.12').map(r=>r.id),['py','wasm']);
 assert.deepEqual(search(data,'Lua 5.4').map(r=>r.id),['lua']);assert.deepEqual(search(data,'馆藏 CC0').map(r=>r.id),['data']);
 assert.deepEqual(search(data,'Python 5.4'),[]);assert.deepEqual(search(data,'definitelymissing'),[]);
});
test('credit fuzzy search tolerates short English mistakes, ranks exact names and filters categories',()=>{
 const data=index(rows);assert.ok(search(data,'pythn').some(r=>r.id==='py'));assert.equal(search(data,'python')[0].id,'py');
 assert.deepEqual(search(data,'','data').map(r=>r.id),['data']);assert.deepEqual(search(data,'python','data'),[]);
 assert.deepEqual(search(data,'').map(r=>r.id),rows.map(r=>r.id));assert.equal(rows[0].title,undefined);
});
test('credit search retains the complete fixed source inventory and version/license fields',()=>{
 const {credits}=generateCredits(path.resolve(__dirname,'..'));
 const entries=credits.groups.flatMap(group=>group.entries.map(entry=>({id:entry.id,name:entry.name,category:group.id==='remote-runtime-credits'?'runtime-credits':group.id,searchText:[entry.versionLabel,entry.licenseNote,entry.usage,...(entry.languages||[]),...(entry.runtimeIds||[])].join(' ')})));
 const indexed=index(entries);assert.equal(search(indexed,'').length,entries.length);assert.ok(search(indexed,'pythn').some(r=>r.id==='pyodide'));assert.ok(search(indexed,'GPL').length>0);
 assert.equal(search(indexed,'','runtime-credits').length,credits.groups.filter(g=>g.id.includes('runtime')).reduce((n,g)=>n+g.entries.length,0));
});
