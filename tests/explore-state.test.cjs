const test=require('node:test'),assert=require('node:assert/strict');
const {timeline,relations}=require('../src/explore-state.js');
test('chronology covers all dated map records, groups early dates explicitly and never invents undated entries',()=>{
 const records=[{id:'b',name:'B',year:1970,mapEligible:true},{id:'a',name:'A',year:1830,mapEligible:true},{id:'c',name:'C',year:null,mapEligible:true},{id:'d',name:'D',year:1990,mapEligible:false}];
 const all=timeline(records);assert.equal(all.total,2);assert.deepEqual(all.eras,['early','1970']);assert.equal(timeline(records,'early').groups[0][1][0].id,'a');assert.equal(timeline(records,'invented').era,'all');
});
test('relation reading preserves direction, evidence state and ecosystem separation even outside the full map',()=>{
 const rows=[{from:'a',to:'b',layer:'design',state:'field-only',mapVisible:false},{from:'b',to:'c',layer:'design',state:'excerpt-recorded'},{from:'a',to:'b',layer:'ecosystem',type:'hostRuntime'}];
 const design=relations(rows,'b');assert.equal(design.incoming.length,1);assert.equal(design.outgoing.length,1);assert.equal(design.incoming[0].state,'field-only');assert.equal(relations(rows,'b','ecosystem').incoming[0].type,'hostRuntime');assert.deepEqual(relations(rows,'orphan'),{incoming:[],outgoing:[]});
});
