// Aggregate totals only; this read never records a visit or downloads visitor data.
(() => {
  const box = document.getElementById('visit-counts');
  const status = document.getElementById('visit-counts-status');
  if (!box || !status) return;
  const format = new Intl.NumberFormat('zh-CN', {notation: 'compact', maximumFractionDigits: 1});
  let pending = false, lastRead = 0;
  async function load() {
    if (pending || (lastRead && Date.now() - lastRead < 60000)) return;
    pending = true;
    try {
      const response = await fetch('/api/visits', {credentials: 'same-origin', signal: AbortSignal.timeout(8000)});
      if (!response.ok) throw new Error('Statistics unavailable');
      const data = await response.json();
      if (!Number.isSafeInteger(data.uv) || data.uv < 0 || !Number.isSafeInteger(data.pv) || data.pv < data.uv || typeof data.startedAt !== 'string' || !Number.isFinite(Date.parse(data.startedAt))) throw new Error('Invalid totals');
      for (const key of ['uv', 'pv']) document.getElementById('visit-' + key).textContent = format.format(data[key]);
      const start = new Intl.DateTimeFormat('zh-CN', {timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(data.startedAt));
      status.textContent = `自 ${start} 起 · 访客 ${data.uv.toLocaleString('zh-CN')} · 访问 ${data.pv.toLocaleString('zh-CN')}`;
      box.querySelector('summary').setAttribute('aria-label', `累计访客 ${data.uv}，累计访问 ${data.pv}。展开查看统计口径`);
      lastRead = Date.now();
    } catch {
      status.textContent = lastRead ? '暂时无法更新，显示上次读取的累计数字。' : '统计暂不可用；本地预览没有生产访问数据。';
    } finally { pending = false; }
  }
  box.addEventListener('toggle', () => { if (box.open) load(); });
  document.addEventListener('click', event => { if (!box.contains(event.target)) box.open = false; });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && box.open) { box.open = false; box.querySelector('summary').focus(); } });
  // Let the production page-load recorder submit this visit before reading totals.
  setTimeout(load, 1200);
})();
