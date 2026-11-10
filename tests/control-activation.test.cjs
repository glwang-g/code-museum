const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture(){
 const listeners=new Map(),documentListeners=new Map(),timers=new Map();let serial=0,now=100;
 const listen=(map,type,fn)=>{if(!map.has(type))map.set(type,[]);map.get(type).push(fn)};
 const emit=(type,options={})=>{const e={type,pointerType:'mouse',button:0,pointerId:1,isPrimary:true,isTrusted:true,clientX:20,clientY:20,defaultPrevented:false,...options};for(const fn of listeners.get(type)||[])fn(e);return e};
 const doc={activeElement:null,hidden:false,addEventListener:(type,fn)=>listen(documentListeners,type,fn)};
 class Element{
  constructor(tag='BUTTON',type=''){this.tagName=tag;this.type=type;this.isConnected=true;this.disabled=false;this.hidden=false;this.inert=false;this.clicks=0;this.role=null;this.value=''}
  matches(selector){if(selector.startsWith(':disabled'))return this.disabled||this.ariaDisabled;if(selector.startsWith('textarea'))return this.tagName==='TEXTAREA'||this.tagName==='INPUT';return false}
  closest(selector){if(selector==='[hidden],[inert]')return this.hidden||this.inert?this:null;if(selector==='a[href]')return this.tagName==='A'?this:null;return ['BUTTON','SUMMARY','A'].includes(this.tagName)?this:null}
  getClientRects(){return this.hidden?[]:[{}]}getAttribute(name){return name==='role'?this.role:null}
  focus(){doc.activeElement=this}
  click(){if(this.disabled)return;emit('click',{target:this,isTrusted:false});this.clicks++;this.onclick?.()}
 }
 const editor=new Element('TEXTAREA');doc.activeElement=editor;
 const context={window:{addEventListener:(type,fn)=>listen(listeners,type,fn)},document:doc,performance:{now:()=>now},setTimeout:fn=>{timers.set(++serial,fn);return serial},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/control-activation.js'),'utf8'),context);
 return {editor,doc,element:()=>new Element(),summary:()=>new Element('SUMMARY'),link:()=>new Element('A'),emit,flush(){const work=[...timers.values()];timers.clear();for(const fn of work)fn()},advance(ms){now+=ms},native(button){emit('click',{target:button});button.clicks++;button.onclick?.()},hide(){doc.hidden=true;for(const fn of documentListeners.get('visibilitychange')||[])fn()}};
}
test('missing native clicks from a focused editor recover once after release and use the latest input',()=>{
 const f=fixture(),button=f.element();let code='';button.onclick=()=>code=f.editor.value;
 f.emit('pointerup',{target:button});assert.equal(button.clicks,0);f.editor.value='committed composition';f.flush();assert.equal(button.clicks,1);assert.equal(code,'committed composition');
 f.flush();assert.equal(button.clicks,1);
});
test('a real click wins; press never activates early and a late press does not cancel missing-click recovery',()=>{
 const f=fixture(),button=f.element();f.emit('pointerdown',{target:button});assert.equal(button.clicks,0);f.emit('pointerup',{target:button});f.native(button);f.flush();assert.equal(button.clicks,1);
 f.emit('pointerup',{target:button});f.emit('pointerdown',{target:button});f.flush();assert.equal(button.clicks,2);
});
test('dragging away, onto another button or within a drag never synthesizes an activation',()=>{
 for(const kind of ['away','onto','moved','fast-after-recovery']){
  const f=fixture(),a=f.element(),b=f.element();
  if(kind==='fast-after-recovery'){f.emit('pointerup',{target:a});f.flush();assert.equal(a.clicks,1)}
  f.emit('pointerdown',{target:kind==='onto'?f.editor:a});
  if(kind==='moved'||kind==='fast-after-recovery')f.emit('pointermove',{target:b,clientX:100});
  f.emit('pointerup',{target:kind==='away'?f.editor:kind==='moved'?a:b,clientX:100});f.flush();assert.equal(b.clicks,0);assert.equal(a.clicks,kind==='fast-after-recovery'?1:0);
 }
});
test('disabled, hidden, inert and detached controls are never activated; recheck at delivery time',()=>{
 for(const state of ['disabled','hidden','inert','detached']){const f=fixture(),button=f.element();f.emit('pointerup',{target:button});if(state==='detached')button.isConnected=false;else button[state]=true;f.flush();assert.equal(button.clicks,0)}
});
test('touch, secondary buttons, cancelled pointers, keyboard transitions and background pages keep native behavior',()=>{
 for(const options of [{pointerType:'touch'},{pointerType:'pen'},{button:2},{isPrimary:false},{isTrusted:false},{defaultPrevented:true},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true}]){const f=fixture(),b=f.element();f.emit('pointerup',{target:b,...options});f.flush();assert.equal(b.clicks,0)}
 for(const cancel of ['pointercancel','contextmenu','blur','keydown','hidden']){const f=fixture(),b=f.element();f.emit('pointerup',{target:b});cancel==='hidden'?f.hide():f.emit(cancel,{target:b});f.flush();assert.equal(b.clicks,0)}
});
test('field focus loss is bounded, ordinary body releases are ignored and tab recovery stays compatible',()=>{
 const f=fixture(),b=f.element();f.doc.activeElement=b;f.emit('pointerup',{target:b});f.flush();assert.equal(b.clicks,0);
 f.emit('focusout',{target:f.editor});f.emit('pointerup',{target:b});f.flush();assert.equal(b.clicks,1);
 f.emit('focusout',{target:f.editor});f.advance(1001);f.emit('pointerup',{target:b});f.flush();assert.equal(b.clicks,1);
 const tab=f.element();tab.role='tab';f.emit('pointerup',{target:tab});f.flush();assert.equal(tab.clicks,1);assert.equal(f.doc.activeElement,tab);
});
test('source links recover missing clicks with the same native-first and modifier safeguards',()=>{
 const f=fixture(),link=f.link();f.emit('pointerup',{target:link});f.flush();assert.equal(link.clicks,1);f.emit('pointerup',{target:link,metaKey:true});f.flush();assert.equal(link.clicks,1);
 f.emit('pointerdown',{target:link});f.emit('pointerup',{target:link});f.native(link);f.flush();assert.equal(link.clicks,2);
});
