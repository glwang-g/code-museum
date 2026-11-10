((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MUSEUM_CREDIT_SEARCH=api})(typeof window==='object'?window:globalThis,()=>{
  const normalize=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}+#.]+/gu,' ').trim().replace(/\s+/g,' ');
  function distance(a,b,limit){
    if(Math.abs(a.length-b.length)>limit)return limit+1;
    let previous=Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){
      const next=[i];let minimum=i;
      for(let j=1;j<=b.length;j++){next[j]=Math.min(next[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));minimum=Math.min(minimum,next[j])}
      if(minimum>limit)return limit+1;previous=next;
    }
    return previous[b.length];
  }
  function index(entries){return entries.map((entry,order)=>{const title=normalize(entry.name),body=normalize(entry.searchText);return {...entry,order,title,body,words:[...new Set((title+' '+body).split(' '))]}})}
  function score(row,term){
    if(row.title.split(' ').includes(term))return 0;
    if(row.title.includes(term))return 2;
    if(row.body.includes(term))return 8;
    if(/^[a-z][a-z0-9]{2,24}$/.test(term)){
      const limit=term.length>=6?2:1;
      if(row.words.some(word=>/^[a-z0-9]+$/.test(word)&&distance(term,word,limit)<=limit))return 16;
    }
    if(term.length>=2&&term.length<=30){
      const compact=row.title.replaceAll(' ','');let first=-1,last=-1,cursor=0;
      for(const c of term){last=compact.indexOf(c,cursor);if(last<0)return Infinity;if(first<0)first=last;cursor=last+1}
      if(last-first+1<=term.length+Math.max(2,Math.floor(term.length/2)))return 12;
    }
    return Infinity;
  }
  function search(entries,query='',category='all'){
    const terms=normalize(query).slice(0,120).split(' ').filter(Boolean);
    return entries.filter(row=>category==='all'||row.category===category).map(row=>({row,score:terms.reduce((n,term)=>n+score(row,term),0)})).filter(item=>Number.isFinite(item.score)).sort((a,b)=>a.score-b.score||a.row.order-b.row.order).map(item=>item.row);
  }
  return {normalize,index,search};
});
