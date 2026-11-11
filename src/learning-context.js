(function(root){
  const preferred={javascript:'python',python:'javascript',lua:'scheme',scheme:'lua',ruby:'python',c:'cpp',cpp:'c',java:'csharp',csharp:'java',rust:'go',go:'rust'};
  function topicFor(lessons,language,requested){
    const entry=lessons.languages[language];if(!entry)return 'default';
    if(requested==='default')return 'default';
    const valid=id=>lessons.topics.some(t=>t.id===id)&&!!entry.examples[id];
    return valid(requested)?requested:valid('functions')?'functions':lessons.topics.find(t=>valid(t.id))?.id||'default';
  }
  function comparisonFor(lessons,language,requested,pair={}){
    if(!lessons.languages[language])return null;
    const has=id=>id!==language&&!!lessons.languages[id];
    const other=pair.left===language&&has(pair.right)?pair.right:pair.right===language&&has(pair.left)?pair.left:preferred[language];
    const right=has(other)?other:Object.keys(lessons.languages).find(has);
    return right?{left:language,right,topic:topicFor(lessons,language,requested==='default'?undefined:requested)}:null;
  }
  const api={topicFor,comparisonFor};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MUSEUM_TASK=api;
})(typeof window!=='undefined'?window:globalThis);
