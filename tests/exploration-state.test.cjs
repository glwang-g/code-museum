const test=require('node:test'),assert=require('node:assert/strict');
const {neighborhood,feedback}=require('../src/exploration-state.js');
test('bounded directional traversal handles branches and cycles',()=>{
 const edges=[{from:'a',to:'b'},{from:'b',to:'c'},{from:'c',to:'a'},{from:'b',to:'d'},{from:'x',to:'a'}];
 assert.deepEqual([...neighborhood(edges,'b','down',1).nodes].sort(),['b','c','d']);
 assert.deepEqual([...neighborhood(edges,'b','up',2).nodes].sort(),['a','b','c','x']);
 assert.equal(neighborhood(edges,'b','both',20).nodes.size,5);
});
test('exercise comparison only accepts completed real results and distinguishes errors',()=>{
 assert.equal(feedback('81\r\n','ok','81').status,'matched');
 assert.equal(feedback('49','ok','81').status,'different');
 assert.equal(feedback('81','error','81').status,'error');
 assert.equal(feedback('81','','81').status,'pending');
});
