const test = require('node:test');
const assert = require('node:assert/strict');
const { boundsAt, fitScale, scrollAxis, placeLabels } = require('../src/map-framing.js');

test('focus scale fits distant direct relatives and screen-sized selected labels', () => {
  const parts = [
    { left: 800, right: 900, top: 40, bottom: 75 },
    { left: 2200, right: 2200, top: 500, bottom: 500, fixedWidth: 160, fixedHeight: 32 }
  ];
  for (const [width, height] of [[950, 700], [1400, 750], [370, 210]]) {
    const scale = fitScale(parts, width, height);
    const b = boundsAt(parts, scale);
    assert.ok(b.right - b.left <= width - 36 + 1e-6);
    assert.ok(b.bottom - b.top <= height - 36 + 1e-6);
    assert.ok(scale <= .9);
  }
});

test('overlapping names move into free space in deterministic priority order', () => {
  const labels=Array.from({length:8},(_,i)=>({id:String(i),priority:i===0?0:i<5?1:2,left:40+i*8,right:120+i*8,top:70+i*3,bottom:98+i*3}));
  const placed=placeLabels(labels,370,270);
  assert.deepEqual(placed,placeLabels([...labels].reverse(),370,270));
  assert.ok(placed.every(p=>p.placed));
  assert.equal(placed[0].dx,0);assert.equal(placed[0].dy,0);
  for(const box of placed){assert.ok(box.left>=8&&box.top>=8&&box.right<=362&&box.bottom<=262);}
  for(let i=0;i<placed.length;i++)for(let j=i+1;j<placed.length;j++){
    const a=placed[i],b=placed[j];assert.ok(a.right+5<=b.left||b.right+5<=a.left||a.bottom+5<=b.top||b.bottom+5<=a.top);
  }
});

test('space limits defer lower priority labels instead of covering selected names', () => {
  const labels=[{id:'far',priority:2,left:0,right:100,top:0,bottom:30},{id:'selected',priority:0,left:0,right:100,top:0,bottom:30}];
  const result=placeLabels(labels,116,46);
  assert.equal(result[0].id,'selected');assert.equal(result[0].placed,true);
  assert.equal(result[1].placed,false);
});

test('nearby nodes retain readable scale and framing respects scroll boundaries', () => {
  assert.equal(fitScale([{ left: 100, right: 200, top: 40, bottom: 70 }], 950, 700), .9);
  const scroll = scrollAxis(100, 850, 950, 800, 1400);
  assert.ok(100 - scroll >= 18);
  assert.ok(850 - scroll <= 950 - 18);
  assert.equal(scrollAxis(0, 100, 950, 50, 0), 0);
  assert.equal(scrollAxis(1500, 1700, 500, 1600, 900), 900);
});

test('centered screen-sized names reserve their full left and top boundaries', () => {
  const parts = [{left:70,right:70,top:40,bottom:40,fixedLeft:-50,fixedWidth:50,fixedTop:-15,fixedHeight:15},
    {left:2200,right:2200,top:500,bottom:500,fixedWidth:80,fixedHeight:32}];
  const scale=fitScale(parts,370,210),bounds=boundsAt(parts,scale);
  assert.ok(bounds.right-bounds.left<=334+1e-6);
  assert.equal(bounds.left,70*scale-50);
});
