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
test('exhibition and reading links round-trip language IDs without including draft or model input',()=>{
  assert.equal(serialize({view:'gallery'}),'#gallery');
  for(const language of ['cpp','visual-basic.net','f-sharp']){
    const hash=serialize({view:'read',language,topic:'loops',code:'private draft',stdin:'private input',intent:'private intent'});
    assert.equal(parse(hash).view,'read');assert.equal(parse(hash).language,language);
    assert.equal(parse(hash).topic,'loops');
    assert.ok(!/private|stdin|intent|code/.test(hash));
  }
});
test('guide overview and legacy reading bookmarks remain shareable',()=>{
 assert.equal(serialize({view:'guides',code:'private draft'}),'#guides');
 assert.equal(parse('#read?language=javascript').topic,'default');
 assert.equal(parse('#guides').view,'guides');
});
test('reading exploration and complete maps share public context while legacy rich links retain maps',()=>{
 assert.equal(parse('#river').presentation,'browse');assert.equal(parse('#lineage?language=javascript').presentation,'browse');
 assert.equal(parse('#lineage?language=c&depth=levels&levels=2').presentation,'map');
 assert.equal(parse('#lineage?layer=ecosystem').presentation,'map');
 for(const presentation of ['browse','map']){
  const state={view:'lineage',language:'cpp',presentation,layer:'ecosystem',relation:'c|cpp|extensionInterface',code:'private-code',stdin:'private-input'};
  const hash=serialize(state),restored=parse(hash);assert.equal(restored.presentation,presentation);assert.equal(restored.layer,'ecosystem');assert.equal(restored.relation,state.relation);assert.ok(!/private|stdin|code/.test(hash));
 }
 assert.equal(parse(serialize({view:'river',presentation:'browse',era:'1990'})).era,'1990');assert.equal(parse('#river?era=bad').era,'all');
});
