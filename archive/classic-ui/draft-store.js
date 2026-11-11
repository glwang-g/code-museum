// Drafts stay on this device. Never store execution tokens or standard input.
(() => {
  const key='code-museum:drafts:v1',drafts=new Map(),backups=new Map(),topics=new Map();
  let persistent=true,timer=null;
  const valid=value=>typeof value==='string'&&value.length<=131072;
  try {
    const data=JSON.parse(localStorage.getItem(key)||'null');
    if(data?.version===1)for(const [map,entries] of [[drafts,data.drafts],[backups,data.backups],[topics,data.topics]]){
      if(Array.isArray(entries))for(const entry of entries.slice(-80))if(Array.isArray(entry)&&valid(entry[0])&&valid(entry[1]))map.set(...entry);
    }
  } catch { persistent=false; }
  function flush(){
    clearTimeout(timer);timer=null;
    try{localStorage.setItem(key,JSON.stringify({version:1,drafts:[...drafts].slice(-80),backups:[...backups].slice(-80),topics:[...topics].slice(-80)}));persistent=true}
    catch{persistent=false}
    window.dispatchEvent(new Event('museum-draft-saved'));
  }
  function save(){clearTimeout(timer);timer=setTimeout(flush,350)}
  window.addEventListener('pagehide',flush);
  window.MUSEUM_DRAFT_STORE={drafts,backups,topics,save,flush,get persistent(){return persistent}};
})();
