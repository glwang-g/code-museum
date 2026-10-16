// Public guest book: visitors write short notes that stay visible in a log.
// The panel never invents data: when the endpoint is missing or unreachable it
// says so and disables the form instead of showing placeholder messages.
(() => {
  const API = '/api/messages';
  const VIEWS = {'timeline-view': '时间长河', 'lineage-view': '关系谱系', 'catalogue-view': '语言检索', 'lab-view': '语言实验台', 'compare-view': '语言对比', 'sources-view': '出处与说明'};
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const STORAGE = 'code-museum:visitor:v1';
  const MAX_BODY = 600, COOLDOWN = 20, LIMIT = 20;
  const TIME = new Intl.DateTimeFormat('zh-CN', {timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false});

  function visitorId() {
    try {
      const saved = localStorage.getItem(STORAGE);
      if (UUID.test(saved || '')) return saved;
      const created = crypto.randomUUID();
      localStorage.setItem(STORAGE, created);
      return created;
    } catch { return crypto.randomUUID(); } // Without persistent storage, rate limits apply per session only.
  }
  function pageLabel() {
    const view = VIEWS[document.querySelector('.museum-tabs .active')?.id] || '首页';
    let language = '';
    try { language = window.MUSEUM_NAV.state().language; } catch { language = ''; }
    const label = typeof language === 'string' && language ? view + ' · ' + language : view;
    return label.slice(0, 80);
  }
  function timeLabel(value) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? TIME.format(date) : '';
  }

  const trigger = document.createElement('button');
  trigger.id = 'messages-open';
  trigger.className = 'guest-trigger';
  trigger.type = 'button';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-label', '留言板');
  trigger.innerHTML = '留言板 <span id="guest-badge" aria-hidden="true" hidden></span>';
  document.querySelector('.header-tools .share-control').before(trigger);

  const dialog = document.createElement('dialog');
  dialog.id = 'messages-dialog';
  dialog.className = 'guest-dialog';
  dialog.setAttribute('aria-labelledby', 'guest-title');
  dialog.innerHTML = '<button class="guest-close" type="button" aria-label="关闭留言板">关闭 ×</button><div class="guest-body">' +
    '<div class="guest-intro"><p class="eyebrow">VISITOR NOTES</p><h2 id="guest-title">留言板</h2>' +
    '<p>欢迎写下意见或建议。留言会公开显示在下方；如已配置通知服务，维护者会收到提醒。</p>' +
    '<p class="guest-boundary">留言公开展示，请勿填写隐私信息。服务只保存昵称、留言内容、当前页面位置和用于限流的匿名标识哈希，不记录 IP、邮箱、账号或原始匿名标识；发送失败时不会显示为已送达。</p></div>' +
    '<form class="guest-form" novalidate><label for="guest-author">昵称（可选）</label>' +
    '<input id="guest-author" name="author" type="text" maxlength="24" autocomplete="off" placeholder="默认显示为匿名">' +
    '<label for="guest-body">留言</label>' +
    '<textarea id="guest-body" name="body" maxlength="600" placeholder="想说的话（2–600 字）"></textarea>' +
    '<div class="guest-form-foot"><span id="guest-count">0/' + MAX_BODY + '</span><button id="guest-submit" type="submit">发布留言</button></div></form>' +
    '<p id="guest-status" role="status" aria-live="polite"></p>' +
    '<div class="guest-log-head"><h3>最新留言</h3><span id="guest-total"></span></div>' +
    '<ul class="guest-log" id="guest-log"></ul></div>';
  document.body.append(dialog);

  const $ = id => dialog.querySelector('#' + id);
  const form = dialog.querySelector('.guest-form'), authorField = $('guest-author'), bodyField = $('guest-body');
  const submitButton = $('guest-submit'), count = $('guest-count'), status = $('guest-status'), log = $('guest-log'), total = $('guest-total'), badge = trigger.querySelector('#guest-badge');
  let online = false, pending = false, eventId = crypto.randomUUID(), cooldownUntil = 0, cooldownTimer = 0;

  function feedback(state, text) {
    status.dataset.state = state;
    status.textContent = text;
  }
  function renderSubmit() {
    const wait = Math.ceil((cooldownUntil - Date.now()) / 1000);
    if (pending) { submitButton.disabled = true; submitButton.textContent = '发布中…'; return; }
    if (wait > 0) { submitButton.disabled = true; submitButton.textContent = '请稍候 ' + wait + 's 再发'; return; }
    submitButton.disabled = !online;
    submitButton.textContent = '发布留言';
  }
  function startCooldown() {
    cooldownUntil = Date.now() + COOLDOWN * 1000;
    clearInterval(cooldownTimer);
    renderSubmit();
    cooldownTimer = setInterval(() => {
      if (Date.now() >= cooldownUntil) { clearInterval(cooldownTimer); cooldownTimer = 0; }
      renderSubmit();
    }, 1000);
  }
  function updateCount() { count.textContent = bodyField.value.length + '/' + MAX_BODY; }
  bodyField.addEventListener('input', updateCount);

  function renderLog(messages) {
    log.textContent = '';
    if (!messages.length) {
      const empty = document.createElement('p');
      empty.className = 'guest-empty';
      empty.textContent = '还没有留言，欢迎写下第一条。';
      log.append(empty);
      return;
    }
    for (const item of messages) {
      const row = document.createElement('li');
      const meta = document.createElement('div');
      meta.className = 'guest-meta';
      const author = document.createElement('b');
      author.textContent = item.author || '匿名';
      const time = document.createElement('span');
      time.textContent = timeLabel(item.createdAt);
      meta.append(author, time);
      const text = document.createElement('p');
      text.className = 'guest-text';
      text.textContent = item.body;
      row.append(meta, text);
      if (item.page) {
        const page = document.createElement('span');
        page.className = 'guest-page';
        page.textContent = item.page;
        row.append(page);
      }
      log.append(row);
    }
  }
  function setAvailable() {
    online = true;
    authorField.disabled = false;
    bodyField.disabled = false;
    renderSubmit();
  }
  function setUnavailable(note) {
    online = false;
    authorField.disabled = true;
    bodyField.disabled = true;
    renderSubmit();
    feedback('error', note || '留言服务未接入：本地预览或后端不可用时，这里不会显示真实留言。');
    log.textContent = '';
    const empty = document.createElement('p');
    empty.className = 'guest-empty';
    empty.textContent = '服务不可用，暂时无法读取留言。';
    log.append(empty);
    total.textContent = '';
    badge.hidden = true;
  }

  async function load() {
    try {
      const response = await fetch(API + '?limit=' + LIMIT, {credentials: 'same-origin', signal: AbortSignal.timeout(8000)});
      if (!response.ok) throw new Error('unavailable');
      const data = await response.json();
      if (!Array.isArray(data.messages) || !Number.isSafeInteger(data.total)) throw new Error('unavailable');
      renderLog(data.messages);
      total.textContent = data.total > data.messages.length ? '共 ' + data.total + ' 条' : '';
      badge.hidden = data.total < 1;
      badge.textContent = data.total > 99 ? '99+' : String(data.total);
      setAvailable();
      if (!status.textContent || status.dataset.state === 'error') feedback('idle', '留言会公开显示；如已配置通知服务，维护者会收到提醒。');
    } catch { setUnavailable(); }
  }

  function failureMessage(responseStatus, code) {
    if (responseStatus === 429) return code === 'Daily message limit reached' ? '今天的留言条数已达上限，请明天再来。' : '提交太快了，请稍等一会儿再发。';
    if (responseStatus === 413) return '内容超过了长度限制，请精简后再发。';
    if (responseStatus === 403) return '提交被拒绝：来源校验失败。';
    if (responseStatus === 415) return '提交被拒绝：请求格式不受支持。';
    if (responseStatus === 503) return '留言服务暂不可用，请稍后再试。';
    return '提交失败（HTTP ' + responseStatus + '）。';
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!online || pending || Date.now() < cooldownUntil) return;
    const body = bodyField.value.replace(/\r\n?/g, '\n').trim();
    if (body.length < 2) { feedback('error', '留言至少 2 个字。'); bodyField.focus(); return; }
    pending = true;
    renderSubmit();
    try {
      const response = await fetch(API, {
        method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({author: authorField.value.trim(), body, page: pageLabel(), visitorId: visitorId(), eventId})
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        eventId = crypto.randomUUID(); // A new note needs a new id; the previous one stays idempotent.
        bodyField.value = ''; updateCount();
        feedback('ok', data.note || '留言已发布，公开显示在下方。');
        startCooldown();
        await load();
      } else {
        feedback('error', failureMessage(response.status, data.error));
      }
    } catch {
      feedback('error', '提交失败：网络不可用，请稍后重试。');
    } finally {
      pending = false;
      renderSubmit();
    }
  });

  const close = () => dialog.close();
  trigger.onclick = () => {
    if (dialog.open) return;
    dialog.showModal();
    renderSubmit();
    load().then(() => { if (!cooldownUntil) bodyField.focus(); });
  };
  dialog.querySelector('.guest-close').onclick = close;
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
  dialog.addEventListener('close', () => {
    renderSubmit();
    trigger.focus();
  });
})();
