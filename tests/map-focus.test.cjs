const test=require('node:test'),assert=require('node:assert/strict');
const {createFocusController}=require('../src/map-focus.js');
function fixture(){
 let sequence=0,frames=0;
 const tasks=new Map(),state={activeId:'x',relationScope:'direct',visibleMap:true,mode:'focus'};
 const node={dataset:{id:'x'},offsetWidth:20,offsetHeight:10,classList:{contains:()=>false}};
 const viewport={clientWidth:800,clientHeight:600,scrollWidth:800,scrollHeight:600,scrollLeft:0,scrollTop:0,getBoundingClientRect:()=>({left:0,top:0}),scrollTo:()=>{}};
 const document={defaultView:{CSS:{escape:id=>id},matchMedia:()=>({matches:true})},querySelectorAll:()=>[node],querySelector:s=>s==='#viewport'||s==='#world'?viewport:node};
 const controller=createFocusController({document,getState:()=>state,activeMapEdges:()=>[],positions:new Map([['x',{x:100,y:100}]]),frame:{fitScale:()=>1,boundsAt:()=>({left:90,right:110,top:95,bottom:105}),scrollAxis:()=>0},resetFocusLabels:()=>{},setFrame:()=>frames++,getScale:()=>1,minimumZoom:()=>.1,placeFocusLabels:()=>{},later:fn=>{tasks.set(++sequence,fn);return sequence},clear:id=>tasks.delete(id)});
 return {controller,state,tasks,viewport,get frames(){return frames},flush(){const callbacks=[...tasks.values()];tasks.clear();callbacks.forEach(fn=>fn())}};
}
test('viewport changes coalesce and synchronous selection cancels pending geometry',()=>{
 const f=fixture();for(let i=0;i<5;i++)f.controller.schedule('x');assert.equal(f.tasks.size,1);f.flush();assert.equal(f.frames,1);
 f.controller.schedule('x');f.controller.focus('x');assert.equal(f.tasks.size,0);f.flush();assert.equal(f.frames,2);
});
test('resize delivery after a completed focus does no duplicate work, while a new size reframes',()=>{
 const f=fixture();f.controller.focus('x');f.controller.schedule('x');f.flush();assert.equal(f.frames,1);
 f.viewport.clientWidth=600;f.controller.schedule('x');f.flush();assert.equal(f.frames,2);
});
test('stale geometry cannot undo manual zoom, navigate to an old selection, or reopen a hidden map',()=>{
 for(const change of [{mode:'custom'},{mode:'fit'},{activeId:'y'},{visibleMap:false}]){
  const f=fixture();f.controller.schedule('x');Object.assign(f.state,change);f.flush();assert.equal(f.frames,0);
 }
 const f=fixture();f.controller.schedule('x');f.controller.cancel();f.flush();assert.equal(f.frames,0);
});
