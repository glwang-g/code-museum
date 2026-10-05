// Label rectangles contain world coordinates plus optional screen-sized text.
((root) => {
  function boundsAt(parts, scale) {
    return {
      left: Math.min(...parts.map(p => p.left * scale + (p.fixedLeft || 0))),
      right: Math.max(...parts.map(p => p.right * scale + (p.fixedWidth || 0))),
      top: Math.min(...parts.map(p => p.top * scale + (p.fixedTop || 0))),
      bottom: Math.max(...parts.map(p => p.bottom * scale + (p.fixedHeight || 0)))
    };
  }
  function fitScale(parts, width, height, maximum = .9, minimum = .04, padding = 18) {
    const fits = scale => {
      const b = boundsAt(parts, scale);
      return b.right - b.left <= width - padding * 2 && b.bottom - b.top <= height - padding * 2;
    };
    if (fits(maximum)) return maximum;
    let low = minimum, high = maximum;
    for (let i = 0; i < 32; i++) {
      const middle = (low + high) / 2;
      if (fits(middle)) low = middle; else high = middle;
    }
    return low;
  }
  function scrollAxis(first, last, size, selected, maximum, padding = 18, anchor = .58) {
    const low = last - size + padding, high = first - padding;
    const preferred = selected - size * anchor;
    const target = low <= high ? Math.max(low, Math.min(preferred, high)) : preferred;
    return Math.max(0, Math.min(target, maximum));
  }
  function placeLabels(labels, width, height, padding = 8, gap = 5) {
    const occupied = [], result = [];
    const overlaps = (a, b) => a.left < b.right + gap && a.right + gap > b.left && a.top < b.bottom + gap && a.bottom + gap > b.top;
    for (const label of [...labels].sort((a,b) => a.priority-b.priority || a.id.localeCompare(b.id))) {
      const w=label.right-label.left,h=label.bottom-label.top;
      const maxX=width-padding-w,maxY=height-padding-h;
      if(maxX<padding||maxY<padding){result.push({...label,placed:false});continue}
      const x=Math.max(padding,Math.min(label.left,maxX)),y=Math.max(padding,Math.min(label.top,maxY));
      const xs=new Set([x,padding,maxX]),ys=new Set([y,padding,maxY]);
      for(const box of occupied){xs.add(Math.max(padding,Math.min(box.left-w-gap,maxX)));xs.add(Math.max(padding,Math.min(box.right+gap,maxX)));ys.add(Math.max(padding,Math.min(box.top-h-gap,maxY)));ys.add(Math.max(padding,Math.min(box.bottom+gap,maxY)));}
      for(let at=padding;at<=maxX;at+=24)xs.add(at);
      for(let at=padding;at<=maxY;at+=24)ys.add(at);
      let best=null,score=Infinity;
      for(const left of xs)for(const top of ys){
        const cost=(left-label.left)**2*2+(top-label.top)**2;
        if(cost>=score)continue;
        const box={left,top,right:left+w,bottom:top+h};
        if(occupied.some(other=>overlaps(box,other)))continue;
        best=box;score=cost;
      }
      if(best){occupied.push(best);result.push({...label,...best,placed:true,dx:best.left-label.left,dy:best.top-label.top});}
      else result.push({...label,placed:false});
    }
    return result;
  }
  const api = { boundsAt, fitScale, scrollAxis, placeLabels };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MUSEUM_MAP_FRAME = api;
})(typeof window === 'object' ? window : globalThis);
