// Private applications share the guest book's mail service, not its public log.
(() => {
  const API = '/api/access-requests', trigger = document.querySelector('#access-request-open');
  const dialog = document.createElement('dialog');
  dialog.id = 'access-request-dialog';
  dialog.className = 'guest-dialog access-dialog';
  dialog.setAttribute('aria-labelledby', 'access-title');
  dialog.innerHTML = '<button class="guest-close" type="button" aria-label="关闭权限申请">关闭 ×</button><div class="guest-body">' +
    '<div class="guest-intro"><p class="eyebrow">REMOTE EXECUTION ACCESS</p><h2 id="access-title">申请运行权限</h2>' +
    '<p>填写联系邮箱和使用用途，后台会向维护者发送申请邮件。审核结果通过邮件回复，提交申请不会自动开通权限。</p>' +
    '<p class="guest-boundary">申请仅供维护者审核，不在留言板公开。服务保存昵称、联系邮箱、申请内容和用于限流的匿名标识哈希；请勿填写密码或令牌。</p></div>' +
    '<form class="guest-form"><label for="access-author">昵称（可选）</label><input id="access-author" maxlength="24" autocomplete="nickname">' +
    '<label for="access-email">联系邮箱</label><input id="access-email" type="email" maxlength="254" autocomplete="email" required placeholder="用于接收审核回复">' +
    '<label for="access-body">使用用途</label><textarea id="access-body" minlength="2" maxlength="600" required placeholder="想运行哪些语言、用于什么学习或研究（2–600 字）"></textarea>' +
    '<div class="guest-form-foot"><span class="access-count">0/600</span><button id="access-submit" type="submit">提交申请</button></div></form>' +
    '<p id="access-status" role="status" aria-live="polite"></p></div>';
  document.body.append(dialog);
  const $ = id => dialog.querySelector('#' + id);
  const form = dialog.querySelector('form'), email = $('access-email'), author = $('access-author'), body = $('access-body');
  const submit = $('access-submit'), status = $('access-status');
  let available = false, pending = false, checking = false, eventId = crypto.randomUUID(), until = 0, timer;
  // A retry retains its exact payload and id, even if the response was lost.
  let attempt = null;
  const feedback = (state, text) => { status.dataset.state = state; status.textContent = text; };
  function render() {
    const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    submit.disabled = !available || pending || checking || remaining > 0;
    submit.textContent = pending ? '提交中…' : checking ? '正在连接…' : remaining ? `请稍候 ${remaining}s 再申请` : '提交申请';
    for (const field of [email, author, body]) {
      field.disabled = !available || pending || checking;
      field.readOnly = attempt !== null;
    }
  }
  function cooldown() {
    until = Date.now() + 60000;
    clearInterval(timer);
    timer = setInterval(() => { if (Date.now() >= until) clearInterval(timer); render(); }, 1000);
  }
  function visitorId() {
    try {
      const key = 'code-museum:visitor:v1', saved = localStorage.getItem(key);
      if (/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(saved || '')) return saved;
      const id = crypto.randomUUID(); localStorage.setItem(key, id); return id;
    } catch { return visitorId.fallback ||= crypto.randomUUID(); }
  }
  async function connect() {
    checking = true; render();
    try {
      const response = await fetch(API, {credentials: 'same-origin', signal: AbortSignal.timeout(8000)});
      const data = await response.json();
      available = response.ok && data.available === true;
    } catch { available = false; }
    checking = false; render();
    if (!available) feedback('error', '申请服务暂不可用，请稍后重新打开重试，或联系 1956341482@qq.com。');
    else if (status.dataset.state !== 'ok') feedback('idle', '申请将由后台邮件通知维护者，不在网站公开展示。');
  }
  body.addEventListener('input', () => { dialog.querySelector('.access-count').textContent = body.value.length + '/600'; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!available || pending || checking || Date.now() < until) return;
    if (body.value.trim().length < 2) { feedback('error', '请填写至少 2 个字的使用用途。'); body.focus(); return; }
    pending = true; render();
    attempt ||= {author: author.value.trim(), email: email.value.trim(), body: body.value.trim(), visitorId: visitorId(), eventId};
    try {
      const response = await fetch(API, {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(attempt), signal: AbortSignal.timeout(15000)});
      const data = await response.json().catch(() => ({}));
      if (response.ok && /^[a-f0-9]{32}$/.test(data.id || '')) {
        const sent = attempt;
        feedback('ok', '申请已保存，等待后台邮件通知。编号：' + data.id + '。审核回复将发至 ' + sent.email + '，请勿重复提交。');
        eventId = crypto.randomUUID(); attempt = null;
        body.value = ''; body.dispatchEvent(new Event('input')); cooldown();
      } else {
        // Explicit validation failures are safe to edit; uncertain results keep the attempt for retry.
        if ([400, 403, 409, 413, 415, 429].includes(response.status)) attempt = null;
        const note = response.status === 429 ? '申请过于频繁或今日额度已满，请稍后再试。' :
          response.status === 400 ? '请检查联系邮箱和使用用途。' : response.status === 503 ? '申请服务暂不可用，请稍后再试。' : '申请未成功，请稍后重试。';
        feedback('error', note);
        if (response.status === 429) cooldown();
      }
    } catch { feedback('error', '尚未确认提交结果。重试会核对原申请，避免重复发送；填写内容已保留。'); }
    finally { pending = false; render(); }
  });
  trigger.addEventListener('click', () => { if (!dialog.open) { dialog.showModal(); connect(); } });
  dialog.querySelector('.guest-close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => trigger.focus());
})();
