(() => {
  const key='code-museum-theme',root=document.documentElement;
  const media=window.matchMedia?.('(prefers-color-scheme: dark)');
  let preference=null;
  try{const saved=localStorage.getItem(key);if(saved==='light'||saved==='dark')preference=saved}catch{}
  function apply(theme){
    root.dataset.theme=theme;
    const button=document.getElementById('theme-toggle');if(!button)return;
    const target=theme==='light'?'深色':'亮色';
    button.textContent=(theme==='light'?'☾ ':'☀ ')+target;
    button.setAttribute('aria-label','切换到'+target+'主题');
    button.title='当前'+(theme==='light'?'亮色':'深色')+'主题；切换到'+target;
  }
  const system=()=>media?.matches?'dark':'light';
  apply(preference||system());
  document.addEventListener('DOMContentLoaded',()=>{
    apply(root.dataset.theme);
    document.getElementById('theme-toggle').addEventListener('click',()=>{
      preference=root.dataset.theme==='light'?'dark':'light';
      try{localStorage.setItem(key,preference)}catch{}
      apply(preference);
    });
  });
  media?.addEventListener?.('change',()=>{if(!preference)apply(system())});
  window.addEventListener('storage',event=>{
    if(event.key!==key&&event.key!==null)return;
    preference=event.newValue==='light'||event.newValue==='dark'?event.newValue:null;
    apply(preference||system());
  });
})();
