const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {labExplanations}=require('../scripts/lab-explanations.cjs');
const root=path.resolve(__dirname,'..');
test('authored explanations cover all exact museum and topic programs and reject stale code or line ranges',t=>{
  const data=labExplanations(root);assert.equal(data.entries.filter(r=>r.topic==='default').length,59);assert.equal(data.entries.length,114);
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'museum-explanation-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  fs.mkdirSync(path.join(directory,'src'));fs.mkdirSync(path.join(directory,'data'));
  for(const file of ['lab-examples.js','learning-examples.js'])fs.copyFileSync(path.join(root,'src',file),path.join(directory,'src',file));
  const original=JSON.parse(fs.readFileSync(path.join(root,'data/lab-explanations.json'))),filename=path.join(directory,'data/lab-explanations.json');
  const write=value=>fs.writeFileSync(filename,JSON.stringify(value));write(original);assert.equal(labExplanations(directory).entries.length,114);
  for(const change of [d=>d.entries[0].codeSha256='0'.repeat(64),d=>d.entries[0].steps[0].to=10000,d=>d.entries.pop(),d=>d.entries.push(d.entries[0])]){const changed=structuredClone(original);change(changed);write(changed);assert.throws(()=>labExplanations(directory))}
  write(original);fs.appendFileSync(path.join(directory,'src/lab-examples.js'),'\nwindow.MUSEUM_LAB_EXAMPLES[0].code += "changed";');assert.throws(()=>labExplanations(directory),/Stale/);
  const entry=id=>data.entries.find(r=>r.language===id&&r.topic==='default');
  assert.match(entry('sed').stdin,/待替换/);assert.match(entry('awk').stdin,/不读取输入行/);assert.match(entry('sql').stdin,/不使用独立标准输入/);assert.match(entry('xslt').stdin,/XML/);
});
function page(fetch=()=>{throw new Error('Unexpected model call')}){
  class Element{
    constructor(){this.children=[];this.dataset={};this.attrs={};this.listeners={};this.hidden=false;this.value='';this.textContent='';this.classList={toggle:(key,value)=>{this.attrs[key]=value}}}
    append(...nodes){this.children.push(...nodes)}replaceChildren(...nodes){this.children=nodes}setAttribute(key,value){this.attrs[key]=value}addEventListener(key,fn){this.listeners[key]=fn}click(){if(!this.disabled)return this.listeners.click?.()}focus(){this.focused=true}scrollIntoView(){this.scrolledIntoView=true}setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end}dispatchEvent(e){this.listeners[e.type]?.(e)}
  }
  const elements=new Map(),events={},copied=[];const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};
  const data=labExplanations(root),example=data.entries.find(row=>row.language==='python'&&row.topic==='default');
  const lab={current:'python',topic:'default',code:example.code};get('lab-code').value=example.code;
  const context={fetch,AbortController,TextEncoder,setTimeout,clearTimeout,window:{MUSEUM_LAB:lab,MUSEUM_LAB_EXPLANATIONS:data,navigator:{clipboard:{writeText:async text=>copied.push(text)}}},document:{getElementById:get,createElement:()=>new Element(),addEventListener:(type,fn)=>events[type]=fn},getComputedStyle:()=>({lineHeight:'20.8px'}),Event:class{constructor(type){this.type=type}}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'src/lab-explanations.js'),'utf8'),context);
  return {lab,get,data,copied,change:()=>events['museum-lab-change'](),text(node){return [node.textContent,...node.children.map(n=>this.text(n))].join(' ')}};
}
test('explanation line navigation never edits or executes code and edited drafts stop matching',()=>{
  const p=page(),panel=p.get('lab-explanation'),body=p.get('lab-explanation-content');assert.equal(panel.dataset.state,'matched');
  const list=body.children.find(n=>n.className==='lab-explanation-steps'),button=list.children[1].children[0],before=p.lab.code;
  button.click();assert.equal(p.get('lab-code').value,before);assert.equal(p.get('lab-code').selectionStart,before.indexOf('for name'));assert.equal(button.attrs['aria-pressed'],'true');
  p.lab.code=before+'# edit';p.change();assert.equal(panel.dataset.state,'modified');assert.match(p.text(body),/原讲解已暂停/);assert.ok(!body.children.some(n=>n.className==='lab-explanation-steps'));
  p.lab.code=before;p.change();assert.equal(panel.dataset.state,'matched');
  p.lab.current='python';p.lab.topic='loops';p.lab.code=p.data.entries.find(r=>r.language==='python'&&r.topic==='loops').code;p.change();assert.match(p.text(body),/不包含 11/);
  p.lab.current='unreviewed';p.change();assert.equal(panel.dataset.state,'unavailable');assert.match(p.text(body),/尚无对应/);
});
test('visitors can hide and restore the explanation without losing their draft',()=>{
  const p=page(),toggle=p.get('lab-explanation-toggle'),before=p.lab.code;toggle.click();assert.equal(p.get('lab-explanation').hidden,true);assert.equal(toggle.attrs['aria-expanded'],'false');toggle.click();assert.equal(p.get('lab-explanation').hidden,false);assert.equal(p.lab.code,before);
});
const result={overview:'计算总数',stdin:'不读取标准输入。',steps:[{from:1,to:1,title:'<script>不是HTML</script>',detail:'这一行输出计算结果。'}],review:{verdict:'ok',summary:'未发现明显问题。',intent:'输出计算结果。',issues:[]},correction:null};
const response=(explanation=result,status=200)=>({ok:status===200,text:async()=>JSON.stringify(status===200?{explanation,model:'deepseek-flash',cached:false}:{error:'当前讲解请求比较多，请稍后重试。'})});
test('AI explanation calls only on click, merges clicks, binds exact snapshots and reuses prior code',async()=>{
 let calls=0,finish,request;const p=page((url,options)=>{calls++;assert.equal(url,'/api/explanations');request=JSON.parse(options.body);return new Promise(r=>finish=r)}),button=p.get('lab-explain-current');
 p.lab.code='print(1 + 2)';p.change();p.get('lab-explanation-toggle').click();p.get('lab-explanation-toggle').click();assert.equal(calls,0);
 const waiting=button.click();button.click();assert.equal(calls,1);assert.deepEqual(request,{language:'python',code:'print(1 + 2)',intent:''});assert.equal(button.disabled,true);
 p.lab.code='print(7)';p.change();finish(response());await waiting;assert.equal(p.get('lab-explanation').dataset.state,'modified');assert.doesNotMatch(p.text(p.get('lab-explanation-content')),/计算总数/);
 p.lab.code='print(1 + 2)';p.get('lab-code').value=p.lab.code;p.change();assert.equal(p.get('lab-explanation').dataset.state,'ai');assert.equal(button.disabled,true);button.click();assert.equal(calls,1);
 assert.match(p.text(p.get('lab-explanation-content')),/<script>不是HTML<\/script>/);const line=p.get('lab-explanation-content').children.find(n=>n.className==='lab-explanation-steps').children[0].children[0];line.click();assert.equal(p.get('lab-code').selectionStart,0);
 p.lab.current='javascript';p.change();assert.notEqual(p.get('lab-explanation').dataset.state,'ai');assert.equal(calls,1);
});
test('model failures do not retry automatically; malformed line ranges and oversized sources are rejected',async()=>{
 let calls=0;const p=page(async()=>{calls++;return calls===1?response(null,429):calls===2?response({...result,steps:[{...result.steps[0],to:10000}]}):response()}),button=p.get('lab-explain-current');
 p.lab.code='print(1)';p.change();await button.click();assert.equal(calls,1);assert.match(p.get('lab-explanation-status').textContent,/当前讲解请求比较多/);p.change();assert.equal(calls,1);
 await button.click();assert.equal(calls,2);assert.match(p.get('lab-explanation-status').textContent,/结果不完整/);assert.notEqual(p.get('lab-explanation').dataset.state,'ai');await button.click();assert.equal(calls,3);assert.equal(p.get('lab-explanation').dataset.state,'ai');
 p.lab.code='x'.repeat(24577);p.change();assert.equal(button.disabled,true);button.click();assert.equal(calls,3);
});
test('issues show minimal corrected code without changing the editor; uncertain intent offers no candidate',async()=>{
 const code='total = 0\nfor value in [2, 3, 5]:\n    total += vale\nprint(total)',fixed=code.replace('+= vale','+= value');
 const problem={...result,steps:[],review:{verdict:'issues',summary:'循环中使用了错误变量名。',intent:'对列表求和并输出。',issues:[{from:3,to:3,title:'变量名错误',detail:'vale没有定义。',suggestion:'使用value，保留求和逻辑。',replacement:'    total += value'}]},correction:fixed};
 let calls=0;const p=page(async()=>{calls++;return response(problem)});p.lab.code=code;p.get('lab-code').value=code;p.get('lab-code-intent').value='对列表求和';p.change();
 await p.get('lab-explain-current').click();assert.equal(p.get('lab-explanation').dataset.state,'issues');assert.equal(p.get('lab-code').value,code);assert.equal(p.lab.code,code);
 const body=p.get('lab-explanation-content');assert.match(p.text(body),/改进建议：使用value/);assert.match(p.text(body),/建议修正版（未运行）/);assert.match(p.text(body),/total \+= value/);
 const list=body.children.find(n=>n.className==='lab-explanation-steps lab-review-issues');list.children[0].children[0].click();assert.equal(p.get('lab-code').value.slice(p.get('lab-code').selectionStart,p.get('lab-code').selectionEnd),'    total += vale');assert.equal(calls,1);
 const copy=body.children.find(n=>n.className==='lab-review-correction').children.find(n=>n.textContent==='复制建议代码');await copy.click();assert.deepEqual(p.copied,[fixed]);assert.equal(p.lab.code,code);
 p.get('lab-code-intent').value='改为求积';p.get('lab-code-intent').dispatchEvent({type:'input'});assert.equal(p.get('lab-explanation').dataset.state,'modified');assert.equal(p.get('lab-explain-current').disabled,false);assert.equal(calls,1);
 await copy.click();assert.equal(p.copied.length,1,'Stale correction cannot be copied for a new intent');
 p.get('lab-code-intent').value='对列表求和';p.get('lab-code-intent').dispatchEvent({type:'input'});assert.equal(p.get('lab-explanation').dataset.state,'issues');assert.equal(calls,1);
 const unclear={...result,steps:[],review:{verdict:'uncertain',summary:'折扣可能表示比率或金额，需要确认。',intent:'折扣含义尚不明确。',issues:[]},correction:null};
 const q=page(async()=>response(unclear));q.lab.code='discount(price)';q.change();await q.get('lab-explain-current').click();assert.equal(q.get('lab-explanation').dataset.state,'uncertain');assert.match(q.text(q.get('lab-explanation-content')),/需要确认预期/);assert.doesNotMatch(q.text(q.get('lab-explanation-content')),/建议修正版/);
});
test('expected behavior is language scoped and edits during a request cannot reuse a different intent',async()=>{
 let finish,calls=0;const p=page(()=>{calls++;return new Promise(r=>finish=r)}),intent=p.get('lab-code-intent');
 p.lab.code='print(1)';intent.value='输出1';p.change();const waiting=p.get('lab-explain-current').click();intent.value='输出2';intent.dispatchEvent({type:'input'});finish(response());await waiting;assert.notEqual(p.get('lab-explanation').dataset.state,'ai');
 p.lab.current='javascript';p.change();assert.equal(intent.value,'');intent.value='输出JS';intent.dispatchEvent({type:'input'});p.lab.current='python';p.change();assert.equal(intent.value,'输出2');intent.value='输出1';intent.dispatchEvent({type:'input'});assert.equal(p.get('lab-explanation').dataset.state,'ai');assert.equal(calls,1);
});
