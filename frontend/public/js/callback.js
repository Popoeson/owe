const params = new URLSearchParams(window.location.search);
const reference = params.get('reference') || params.get('trxref');
const card = document.getElementById('statusCard');

// Asked of the backend (never decided by the page): what kind of payment is this?
let paymentType = null;
const RETRY = {
  registration: { href: 'register.html', label: 'Try again' },
  vote: { href: 'stat-board.html', label: 'Back to Stat Board' },
  ticket: { href: 'tickets.html', label: 'Back to tickets' }
};

async function loadType() {
  if (paymentType || !reference) return paymentType;
  try {
    const details = await apiGet(`/payments/${encodeURIComponent(reference)}`);
    paymentType = details.type;
  } catch {}
  return paymentType;
}

const FAST_INTERVAL_MS = 1500;   // first 10 seconds
const SLOW_INTERVAL_MS = 3000;   // after that
const FAST_PHASE_MS = 10000;
const POLL_TIMEOUT_MS = 45000;
const VERIFY_AT_MS = [0, 5000, 15000, 30000]; // 0 = ask Paystack immediately

let finished = false;

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function refChip() {
  return reference ? `<div class="ref-chip">Ref <span>${esc(reference)}</span></div>` : '';
}

function renderChecking() {
  card.innerHTML = `
    <div class="equalizer"><span></span><span></span><span class="accent"></span><span></span><span></span></div>
    <h2>Checking your payment…</h2>
    <p>We're confirming your payment with the bank. Please keep this page open.</p>
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

async function renderSuccess() {
  if (finished) return;
  finished = true;
  await loadType();
  const target = paymentType === 'ticket' ? 'ticket-confirmation.html' : 'confirmation.html';
  window.location.href = `${target}?reference=${encodeURIComponent(reference)}`;
}

function renderFailed() {
  if (finished) return;
  finished = true;
  const retry = RETRY[paymentType] || RETRY.registration;
  card.innerHTML = `
    <h2>Payment didn't go through</h2>
    <p>No charge was completed. You can try again.</p>
    <a href="${retry.href}" class="btn btn-primary">${retry.label}</a>
  `;
}

// One status check. Returns true when the payment is settled (confirmed or failed).
async function checkStatus() {
  try {
    const { status } = await apiGet(`/payments/${encodeURIComponent(reference)}/status`);
    if (status === 'confirmed') { renderSuccess(); return true; }
    if (status === 'failed') { renderFailed(); return true; }
  } catch {}
  return false;
}

// Ask the backend to verify with the payment provider directly.
async function verifyNow() {
  if (finished) return false;
  try {
    const { status } = await apiPost(`/payments/${encodeURIComponent(reference)}/verify`, {});
    if (status === 'confirmed') { renderSuccess(); return true; }
    if (status === 'failed') { renderFailed(); return true; }
  } catch {}
  return false;
}

async function poll() {
  const startedAt = Date.now();
  const verifyTimes = [...VERIFY_AT_MS];

  while (!finished) {
    const elapsed = Date.now() - startedAt;

    if (await checkStatus()) return;

    // Don't wait for the webhook: verify directly at set moments
    if (verifyTimes.length && elapsed >= verifyTimes[0]) {
      verifyTimes.shift();
      if (await verifyNow()) return;
    }

    if (elapsed > POLL_TIMEOUT_MS) {
      if (!(await verifyNow())) renderFallback();
      return;
    }

    const wait = elapsed < FAST_PHASE_MS ? FAST_INTERVAL_MS : SLOW_INTERVAL_MS;
    await new Promise((r) => setTimeout(r, wait));
  }
}

async function manualCheck() {
  const btn = document.getElementById('checkAgainBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-rotate-right fa-spin"></i> Checking…';
  if (!(await verifyNow())) renderFallback();
}

if (!reference) {
  card.innerHTML = `<h2>Missing payment reference</h2><p>Please start again from the registration page.</p>
    <a href="register.html" class="btn btn-primary">Back to registration</a>`;
} else {
  renderChecking();
  loadType();  // runs alongside polling so the redirect doesn't wait on it
  poll();
}