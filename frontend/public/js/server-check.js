(function () {
  const OVERLAY_ID = 'serverCheckOverlay';
  let attempts = 0;

  function hideOverlay() {
    const el = document.getElementById(OVERLAY_ID);
    if (el) el.remove();
  }

  function updateMessage() {
    const textEl = document.querySelector(`#${OVERLAY_ID} .server-check-text`);
    if (!textEl) return;
    if (attempts >= 5) {
      textEl.textContent = "Still waking up the server — this can take up to a minute on first load.";
      textEl.classList.add('slow');
    }
  }

  async function checkServer() {
    attempts++;
    updateMessage();
    try {
      const res = await fetch(`${API_BASE}/health`, { cache: 'no-store' });
      if (res.ok) { hideOverlay(); return; }
    } catch (e) { /* server still down or waking up */ }
    setTimeout(checkServer, 2000);
  }

  document.addEventListener('DOMContentLoaded', checkServer);
})();