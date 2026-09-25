const params = new URLSearchParams(window.location.search);
const reference = params.get('reference') || params.get('trxref');
const card = document.getElementById('statusCard');

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 45000;

function refChip() {
  return reference ? `<div class="ref-chip">Ref <span>${reference}</span></div>` : '';
}

function renderChecking() {
  card.innerHTML = `
    <div class="equalizer"><span></span><span></span><span class="accent"></span><span></span><span></span></div>
    <h2>Checking your payment…</h2>
    <p>We're confirming your audition fee with the bank. Please keep this page open.</p>
    ${refChip()}
    <a href="index.html" class="back-home">Back to home</a>
  `;
}

function renderFallback() {
  card.innerHTML = `
    <div class="status-icon-clock"><i class="fa-regular fa-clock"></i></div>
    <h2>Still confirming — this can take a moment</h2>
    <p>Some banks take a little longer to respond. If you were charged, your payment is safe and will be matched to this reference.</p>
    <button class="btn check-again-btn" id="checkAgainBtn"><i class="fa-solid fa-rotate-right"></i> Check again</button>
    <p class="support-note">Still stuck? Call <a href="tel:+2349148833279">0914 883 3279</a> with your reference.</p>
    ${refChip()}
    <a href="index.html" class="back-home">Back to home</a>
  `;
  document.getElementById('checkAgainBtn').addEventListener('click', manualCheck);
}

function renderSuccess() {
  window.location.href = `confirmation.html?reference=${encodeURIComponent(reference)}`;
}

function renderFailed() {
  card.innerHTML = `
    <h2>Payment didn't go through</h2>
    <p>No charge was completed. You can try registering again.</p>
    <a href="register.html" class="btn btn-primary">Try again</a>
  `;
}

async function poll() {
  const startedAt = Date.now();
  const interval = setInterval(async () => {
    try {
      const { status } = await apiGet(`/payments/${reference}/status`);
      if (status === 'confirmed') { clearInterval(interval); renderSuccess(); return; }
      if (status === 'failed') { clearInterval(interval); renderFailed(); return; }
    } catch {}
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      clearInterval(interval);
      renderFallback();
    }
  }, POLL_INTERVAL_MS);
}

async function manualCheck() {
  const btn = document.getElementById('checkAgainBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-rotate-right fa-spin"></i> Checking…';
  try {
    const { status } = await apiPost(`/payments/${reference}/verify`, {});
    if (status === 'confirmed') { renderSuccess(); return; }
    renderFallback();
  } catch {
    renderFallback();
  }
}

if (!reference) {
  card.innerHTML = `<h2>Missing payment reference</h2><p>Please start again from the registration page.</p>
    <a href="register.html" class="btn btn-primary">Back to registration</a>`;
} else {
  renderChecking();
  poll();
}