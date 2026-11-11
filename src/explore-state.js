(function(root){
 function eraFor(year){return year<1940?'early':String(Math.floor(year/10)*10)}
 function timeline(records,requested='all'){
  const groups=new Map();
  for(const r of records.filter(r=>r.mapEligible&&Number.isFinite(r.year)).sort((a,b)=>a.year-b.year||a.name.localeCompare(b.name))){const era=eraFor(r.year);if(!groups.has(era))groups.set(era,[]);groups.get(era).push(r)}
  const era=groups.has(requested)?requested:'all';
  return {era,eras:[...groups.keys()],total:[...groups.values()].reduce((n,rows)=>n+rows.length,0),groups:[...groups].filter(([key])=>era==='all'||key===era)};
 }
 function relations(rows,id,layer='design'){const edges=rows.filter(e=>e.layer===layer);return {incoming:edges.filter(e=>e.to===id),outgoing:edges.filter(e=>e.from===id)}}
 const api={eraFor,timeline,relations};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MUSEUM_EXPLORE_STATE=api;
})(typeof window!=='undefined'?window:globalThis);
