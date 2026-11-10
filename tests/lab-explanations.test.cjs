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
function page(){
  class Element{
    constructor(){this.children=[];this.dataset={};this.attrs={};this.listeners={};this.hidden=false;this.value='';this.textContent='';this.classList={toggle:(key,value)=>{this.attrs[key]=value}}}
    append(...nodes){this.children.push(...nodes)}replaceChildren(...nodes){this.children=nodes}setAttribute(key,value){this.attrs[key]=value}addEventListener(key,fn){this.listeners[key]=fn}click(){this.listeners.click?.()}focus(){this.focused=true}scrollIntoView(){this.scrolledIntoView=true}setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end}dispatchEvent(e){this.listeners[e.type]?.(e)}
  }
  const elements=new Map(),events={};const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};
  const data=labExplanations(root),example=data.entries.find(row=>row.language==='python'&&row.topic==='default');
  const lab={current:'python',topic:'default',code:example.code};get('lab-code').value=example.code;
  const context={window:{MUSEUM_LAB:lab,MUSEUM_LAB_EXPLANATIONS:data},document:{getElementById:get,createElement:()=>new Element(),addEventListener:(type,fn)=>events[type]=fn},getComputedStyle:()=>({lineHeight:'20.8px'}),Event:class{constructor(type){this.type=type}}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'src/lab-explanations.js'),'utf8'),context);
  return {lab,get,data,change:()=>events['museum-lab-change'](),text(node){return [node.textContent,...node.children.map(n=>this.text(n))].join(' ')}};
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
