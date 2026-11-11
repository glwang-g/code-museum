// Count production document loads only; SPA navigation and local previews do not report.
(() => {
  if (location.origin !== 'https://codemuseum.freexlib.com' || navigator.webdriver) return;
  try {
    const key = 'code-museum:visitor:v1';
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    let visitorId;
    try {
      visitorId = localStorage.getItem(key);
      if (!uuid.test(visitorId || '')) {
        visitorId = crypto.randomUUID();
        localStorage.setItem(key, visitorId);
      }
    } catch { return; } // Without persistent storage, omit UV/PV rather than invent a new visitor each load.
    const eventId = crypto.randomUUID();
    const send = () => fetch('/api/visits', {
      method: 'POST', credentials: 'same-origin', keepalive: true,
      headers: {'Content-Type': 'application/json'}, body: JSON.stringify({visitorId, eventId})
    }).catch(() => {});
    if (document.visibilityState === 'visible') send();
    else {
      const visible = () => {
        if (document.visibilityState !== 'visible') return;
        document.removeEventListener('visibilitychange', visible); send();
      };
      document.addEventListener('visibilitychange', visible);
    }
  } catch { /* Statistics never interrupt the museum. */ }
})();
