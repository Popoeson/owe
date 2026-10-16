const MAX_PER_TIER = 10;
const MAX_TOTAL = 20;
const RECENT_KEY = 'okizzTicketOrders';

let tiers = [];
// tierId -> quantity. Used for DISPLAY only: the server recomputes prices and totals itself.
const cart = new Map();

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const fmt = (n) => `₦${Number(n).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
const errMsg = (d, fallback) => (d && (d.error || d.message)) || fallback;

function totals() {
  let count = 0;
  let amount = 0;
  for (const [id, qty] of cart) {
    const tier = tiers.find((t) => t.id === id);
    if (!tier) continue;
    count += qty;
    amount += tier.priceNaira * qty;
  }
  return { count, amount };
}

/* ---------- Load + render tiers ---------- */

async function loadTiers() {
  try {
    const res = await fetch(`${API_BASE}/tickets/tiers`);
    const data = await res.json();
    if (!res.ok) throw new Error(errMsg(data, 'Could not load tickets.'));
    tiers = data.tiers;
    for (const id of [...cart.keys()]) {
      if (!tiers.some((t) => t.id === id)) cart.delete(id);
    }
    renderTiers();
  } catch (err) {
    $('tierStatus').textContent = err.message;
    $('tierStatus').style.display = 'block';
  }
}

function renderTiers() {
  const status = $('tierStatus');
  if (!tiers.length) {
    status.textContent = 'No tickets are on sale yet. Please check back soon.';
    status.style.display = 'block';
    $('tierGrid').innerHTML = '';
    updateUI();
    return;
  }
  status.style.display = 'none';

  $('tierGrid').innerHTML = tiers.map((t) => `
    <article class="tk-card" data-id="${esc(t.id)}">
      ${t.imageUrl ? `<img class="tk-img" src="${esc(t.imageUrl)}" alt="${esc(t.name)} ticket" loading="lazy">` : ''}
      <div class="tk-body">
        <div class="tk-top">
          <h3>${esc(t.name)}</h3>
          <span class="tk-cat">${esc(t.category)}</span>
        </div>
        ${t.description ? `<p class="tk-desc">${esc(t.description)}</p>` : ''}
        <div class="tk-row">
          <strong class="tk-price">${fmt(t.priceNaira)}</strong>
          <div class="tk-stepper">
            <button type="button" data-act="dec" data-id="${esc(t.id)}" aria-label="Remove one">&minus;</button>
            <span data-qty="${esc(t.id)}">0</span>
            <button type="button" data-act="inc" data-id="${esc(t.id)}" aria-label="Add one">+</button>
          </div>
        </div>
      </div>
    </article>
  `).join('');

  updateUI();
}

function updateUI() {
  const { count, amount } = totals();

  document.querySelectorAll('[data-qty]').forEach((el) => {
    el.textContent = cart.get(el.dataset.qty) || 0;
  });
  document.querySelectorAll('button[data-act]').forEach((btn) => {
    const qty = cart.get(btn.dataset.id) || 0;
    btn.disabled = btn.dataset.act === 'dec'
      ? qty <= 0
      : qty >= MAX_PER_TIER || count >= MAX_TOTAL;
  });

  const bar = $('cartBar');
  bar.style.display = count > 0 ? 'flex' : 'none';
  $('cartCount').textContent = `${count} ticket${count === 1 ? '' : 's'}`;
  $('cartTotal').textContent = fmt(amount);
}

$('tierGrid').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn || btn.disabled) return;
  const id = btn.dataset.id;
  const qty = cart.get(id) || 0;
  const next = btn.dataset.act === 'inc' ? qty + 1 : qty - 1;
  if (next <= 0) cart.delete(id);
  else cart.set(id, next);
  updateUI();
});

/* ---------- Checkout sheet ---------- */

function openSheet() {
  const { count, amount } = totals();
  if (!count) return;

  $('orderLines').innerHTML = [...cart].map(([id, qty]) => {
    const t = tiers.find((x) => x.id === id);
    if (!t) return '';
    return `<div class="tk-line"><span>${esc(t.name)} &times; ${qty}</span><b>${fmt(t.priceNaira * qty)}</b></div>`;
  }).join('');
  $('sheetTotal').textContent = fmt(amount);
  $('sheetError').style.display = 'none';
  $('sheetBackdrop').style.display = 'flex';
}

function closeSheet() { $('sheetBackdrop').style.display = 'none'; }

$('checkoutBtn').addEventListener('click', openSheet);
$('closeSheet').addEventListener('click', closeSheet);
$('sheetBackdrop').addEventListener('click', (e) => { if (e.target === $('sheetBackdrop')) closeSheet(); });

$('payBtn').addEventListener('click', async () => {
  const errorEl = $('sheetError');
  const payBtn = $('payBtn');
  const buyerName = $('buyerName').value.trim();
  const buyerEmail = $('buyerEmail').value.trim();
  const fail = (m) => { errorEl.textContent = m; errorEl.style.display = 'block'; };

  errorEl.style.display = 'none';
  if (!buyerName) return fail('Please enter your full name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) return fail('Please enter a valid email.');

  payBtn.disabled = true;
  payBtn.textContent = 'Starting payment…';

  try {
    const res = await fetch(`${API_BASE}/tickets/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Only ids and quantities go to the server. No prices.
      body: JSON.stringify({
        items: [...cart].map(([tierId, quantity]) => ({ tierId, quantity })),
        buyerName,
        buyerEmail
      })
    });
    let data = {};
    try { data = await res.json(); } catch (_) { /* no body */ }

    if (!res.ok) {
      if (res.status === 409) await loadTiers(); // a ticket was hidden: refresh the list
      throw new Error(errMsg(data, 'Could not start payment.'));
    }

    saveRecent(data.reference);
    window.location.href = data.authorizationUrl;
  } catch (err) {
    fail(err.message);
    payBtn.disabled = false;
    payBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Pay securely';
  }
});

/* ---------- Find / recent orders ---------- */

function getRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch (_) { return []; }
}
function saveRecent(ref) {
  try {
    const list = [{ ref, at: Date.now() }, ...getRecent().filter((r) => r.ref !== ref)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch (_) { /* storage unavailable */ }
}

function renderRecent() {
  const list = getRecent();
  $('recentOrders').innerHTML = list.length
    ? `<p class="tk-recent-title">Recent orders on this device</p>` + list.map((r) => `
        <a class="tk-recent" href="ticket-confirmation.html?ref=${encodeURIComponent(r.ref)}">
          <span>${new Date(r.at).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
          <i class="fa-solid fa-arrow-right"></i>
        </a>`).join('')
    : '';
}

$('findBtn').addEventListener('click', () => {
  const ref = $('findRef').value.trim();
  if (ref) window.location.href = `ticket-confirmation.html?ref=${encodeURIComponent(ref)}`;
});
$('findRef').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('findBtn').click(); });

renderRecent();
loadTiers();