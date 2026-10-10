(function(root){
  const views=new Set(['river','lineage','catalogue','lab','compare','about']);
  function parse(hash){
    const [view,query='']=String(hash).replace(/^#/,'').split('?');
    const p=new URLSearchParams(query);
    return {view:views.has(view)?view:'river',language:p.get('language')||'',layer:p.get('layer')==='ecosystem'?'ecosystem':'design',depth:['all','levels'].includes(p.get('depth'))?p.get('depth'):'direct',direction:['up','down'].includes(p.get('direction'))?p.get('direction'):'both',levels:[1,2,3].includes(Number(p.get('levels')))?Number(p.get('levels')):1,relation:p.get('relation')||'',topic:p.get('topic')||'default',left:p.get('left')||'',right:p.get('right')||''};
  }
  function serialize(s){
    const view=views.has(s.view)?s.view:'river',p=new URLSearchParams();
    if(s.language&&view!=='about'&&view!=='compare')p.set('language',s.language);
    if(['river','lineage'].includes(view)){
      if(s.layer==='ecosystem')p.set('layer','ecosystem');
      if(['all','levels'].includes(s.depth))p.set('depth',s.depth);
      if(s.depth==='levels'){if(['up','down'].includes(s.direction))p.set('direction',s.direction);if([2,3].includes(s.levels))p.set('levels',s.levels)}

    }
    if(['river','lineage','catalogue'].includes(view)&&s.relation)p.set('relation',s.relation);
    if(['lab','compare'].includes(view)&&s.topic&&s.topic!=='default')p.set('topic',s.topic);
    if(view==='compare'){if(s.left)p.set('left',s.left);if(s.right)p.set('right',s.right)}
    return '#'+view+(p.size?'?'+p:'');
  }
  const api={parse,serialize};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.MUSEUM_ROUTE=api;
})(typeof window!=='undefined'?window:globalThis);
