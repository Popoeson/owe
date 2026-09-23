const params = new URLSearchParams(window.location.search);
const reference = params.get('reference') || params.get('trxref');
const card = document.getElementById('statusCard');

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 45000;

function renderFallback() {
  card.innerHTML = `
    <h2>Still confirming</h2>
    <p>This can take a moment. You can check again, or hang tight — it'll update automatically once confirmed.</p>
    <button class="btn btn-primary" id="checkAgainBtn">Check again</button>
    <p class="error-text" id="callbackError" style="display:none; margin-top:14px;"></p>
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
    } catch {
      // transient network error — let it keep polling until timeout
    }
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      clearInterval(interval);
      renderFallback();
    }
  }, POLL_INTERVAL_MS);
}

async function manualCheck() {
  const btn = document.getElementById('checkAgainBtn');
  const errorEl = document.getElementById('callbackError');
  btn.disabled = true;
  btn.textContent = 'Checking…';
  errorEl.style.display = 'none';

  try {
    const { status } = await apiPost(`/payments/${reference}/verify`, {});
    if (status === 'confirmed') { renderSuccess(); return; }
    errorEl.textContent = "Still not confirmed — Paystack hasn't reported this payment as successful yet.";
    errorEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Check again';
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Check again';
  }
}

if (!reference) {
  card.innerHTML = `<h2>Missing payment reference</h2><p>Please start again from the registration page.</p>
    <a href="register.html" class="btn btn-primary">Back to registration</a>`;
} else {
  poll();
}
