const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function theme(saved=null,dark=false,blocked=false){
  const events=new Map(),listeners=new Map(),root={dataset:{}},button={attributes:{},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,v){listeners.set(k,v)}};
  const media={matches:dark,addEventListener(k,v){events.set('media-'+k,v)}};let stored=saved;
  const context={window:{matchMedia:()=>media,addEventListener(k,v){events.set('window-'+k,v)}},document:{documentElement:root,getElementById:()=>button,addEventListener(k,v){events.set(k,v)}},localStorage:{getItem(){if(blocked)throw Error('blocked');return stored},setItem(k,v){if(blocked)throw Error('blocked');stored=v}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/theme.js'),'utf8'),context);events.get('DOMContentLoaded')();
  return {root,button,click:()=>listeners.get('click')(),stored:()=>stored,system(value){media.matches=value;events.get('media-change')()},storage(value){events.get('window-storage')({key:'code-museum-theme',newValue:value})}};
}
test('theme follows system until chosen, persists a choice and updates accessible action',()=>{
  const page=theme();assert.equal(page.root.dataset.theme,'light');assert.equal(page.button.attributes['aria-label'],'切换到深色主题');
  page.system(true);assert.equal(page.root.dataset.theme,'dark');page.click();assert.equal(page.root.dataset.theme,'light');assert.equal(page.stored(),'light');
  page.system(true);assert.equal(page.root.dataset.theme,'light');page.storage('dark');assert.equal(page.root.dataset.theme,'dark');
  const restored=theme('dark',false);assert.equal(restored.root.dataset.theme,'dark');
});
test('theme still toggles if storage is unavailable and ignores invalid saved values',()=>{
  const page=theme(null,false,true);page.click();assert.equal(page.root.dataset.theme,'dark');page.system(false);assert.equal(page.root.dataset.theme,'dark');
  assert.equal(theme('invalid',true).root.dataset.theme,'dark');
});
