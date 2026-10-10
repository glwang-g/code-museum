const test=require('node:test'),assert=require('node:assert/strict');
const {parse,serialize}=require('../src/navigation-state.js');
test('shared navigation preserves language identities and relations while excluding private content',()=>{
  const state={view:'lineage',language:'cpp',layer:'ecosystem',depth:'all',relation:'c|cpp|extensionInterface',token:'private',code:'secret',stdin:'input'};
  const hash=serialize(state),restored=parse(hash);
  assert.equal(restored.language,'cpp');assert.equal(restored.relation,state.relation);assert.equal(restored.depth,'all');assert.equal(restored.layer,'ecosystem');
  assert.ok(!/private|secret|stdin|token/.test(hash));
  assert.equal(parse(serialize({view:'lab',language:'csharp',topic:'functions'})).language,'csharp');
  assert.equal(parse(serialize({view:'lab',language:'cpp',topic:'functions'})).topic,'functions');
});
test('old bookmarks and malformed views have safe defaults and unknown parameters are dropped',()=>{
  assert.equal(parse('#lab').view,'lab');assert.equal(parse('#lineage').depth,'direct');
  const invalid=parse('#missing?layer=bad&depth=bad&token=secret');
  assert.equal(serialize(invalid),'#river');
  assert.equal(parse('#lab?language=python&topic=collections').topic,'collections');
});
