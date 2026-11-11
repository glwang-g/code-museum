const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../src/learning-examples.js'),'utf8'),sandbox);
const lessons=sandbox.window.MUSEUM_LESSONS;
const {topicFor,comparisonFor}=require('../src/learning-context.js');
test('same-task comparison retains a previous partner and validates language and topic coverage',()=>{
 assert.deepEqual(comparisonFor(lessons,'javascript','loops',{left:'ruby',right:'javascript'}),{left:'javascript',right:'ruby',topic:'loops'});
 assert.deepEqual(comparisonFor(lessons,'c','collections'),{left:'c',right:'cpp',topic:'collections'});
 assert.equal(comparisonFor(lessons,'bcpl','loops'),null);
 assert.equal(topicFor(lessons,'javascript','invented'),'functions');
 assert.equal(topicFor(lessons,'javascript','default'),'default');
 assert.equal(comparisonFor(lessons,'javascript','default').topic,'functions');
 assert.equal(topicFor(lessons,'bcpl','loops'),'default');
 assert.notEqual(comparisonFor(lessons,'python','functions',{left:'python',right:'python'}).right,'python');
});
test('a partial lesson set falls back to a supported topic without inventing a partner',()=>{
 const partial={topics:[{id:'loops'}],languages:{one:{examples:{loops:{code:'example'}}}}};
 assert.equal(topicFor(partial,'one','functions'),'loops');
 assert.equal(comparisonFor(partial,'one','loops'),null);
});
