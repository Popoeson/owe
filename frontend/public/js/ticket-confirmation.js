const params = new URLSearchParams(window.location.search);
const reference = params.get('ref') || params.get('reference') || params.get('trxref');

const MAX_POLLS = 20;      // about 60 seconds
const POLL_MS = 3000;

let polls = 0;
let pollTimer = null;
let built = []; // [{ canvas, name }]

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const fmt = (n) => `₦${Number(n).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

/* ---------- Status messages ---------- */

function showStatus(icon, title, text, { button, onClick } = {}) {
  const box = $('statusBox');
  box.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <h2>${title}</h2>
    <p>${text}</p>
    ${button ? `<button class="tk-btn" id="statusBtn">${button}</button>` : ''}
  `;
  box.style.display = 'block';
  if (button) $('statusBtn').addEventListener('click', onClick);
}

/* ---------- Talking to the backend ---------- */

async function fetchOrder() {
  const res = await fetch(`${API_BASE}/tickets/by-reference/${encodeURIComponent(reference)}`);
  let data = {};
  try { data = await res.json(); } catch (_) { /* no body */ }
  return { status: res.status, data };
}

async function check({ verify } = {}) {
  clearTimeout(pollTimer);
  try {
    // Manual "check again": ask the backend to re-verify with Paystack first
    if (verify) {
      await fetch(`${API_BASE}/payments/${encodeURIComponent(reference)}/verify`, { method: 'POST' });
    }

    const { status, data } = await fetchOrder();

    if (status === 200) return showTickets(data);

    if (status === 404) {
      return showStatus('fa-circle-question', 'Order not found',
        'We could not find an order with that reference. Check it and try again.',
        { button: 'Back to tickets', onClick: () => { window.location.href = 'tickets.html'; } });
    }

    if (status === 202) {
      if (data.status === 'failed') {
        return showStatus('fa-circle-xmark', 'Payment did not go through',
          'No money was taken for this order. You can try again.',
          { button: 'Back to tickets', onClick: () => { window.location.href = 'tickets.html'; } });
      }

      polls += 1;
      if (polls < MAX_POLLS) {
        showStatus('fa-spinner fa-spin', 'Confirming your payment…',
          'This usually takes a few seconds. Please keep this page open.');
        pollTimer = setTimeout(() => check(), POLL_MS);
      } else {
        showStatus('fa-hourglass-half', 'Still confirming',
          'This can take a moment. Tap below to check again. If you were charged, your tickets will appear here.',
          { button: 'Check again', onClick: () => { polls = 0; check({ verify: true }); } });
      }
      return;
    }

    throw new Error('bad status');
  } catch (_) {
    showStatus('fa-wifi', 'Connection problem',
      'We could not reach the server. Check your connection and try again.',
      { button: 'Try again', onClick: () => { polls = 0; check(); } });
  }
}

/* ---------- Drawing the ticket (browser only; the codes come from the backend) ---------- */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // needed so the canvas can be exported
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image failed'));
    img.src = src;
  });
}

// Draws the QR for `text` inside a white box at (x, y) of side `size`
function drawQr(ctx, text, x, y, size, padding) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x, y, size, size);

  const inner = size - padding * 2;
  const cell = inner / count;
  ctx.fillStyle = '#000000';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) {
        const px = Math.round(x + padding + c * cell);
        const py = Math.round(y + padding + r * cell);
        ctx.fillRect(px, py, Math.ceil(cell), Math.ceil(cell));
      }
    }
  }
}

// Plain branded ticket, used only if a tier has no image or it fails to load
function drawFallback(ctx, W, H, t) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#100BAE');
  g.addColorStop(1, '#0B0870');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#F5A100';
  ctx.beginPath();
  ctx.arc(W * 0.93, H * 0.05, W * 0.14, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 ${Math.round(W * 0.05)}px Sora, Arial, sans-serif`;
  ctx.fillText('OKIZZ ENTERTAINMENT', W * 0.05, H * 0.2);
  ctx.font = `800 ${Math.round(W * 0.085)}px Sora, Arial, sans-serif`;
  ctx.fillText(String(t.tierName || 'Ticket').toUpperCase(), W * 0.05, H * 0.5);
  ctx.fillStyle = '#FFD98C';
  ctx.font = `600 ${Math.round(W * 0.035)}px Inter, Arial, sans-serif`;
  ctx.fillText(t.category || '', W * 0.05, H * 0.62);
}

async function buildTicketCanvas(t, total) {
  let bg = null;
  if (t.imageUrl) {
    try { bg = await loadImage(t.imageUrl); } catch (_) { bg = null; }
  }

  const W = bg ? bg.naturalWidth : 1024;
  const H = bg ? bg.naturalHeight : 576;
  const PANEL_H = Math.round(W * 0.66);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H + PANEL_H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (bg) ctx.drawImage(bg, 0, 0, W, H);
  else drawFallback(ctx, W, H, t);

  // 1) QR printed on the ticket, at the position the admin chose
  const qrSize = Math.round(W * (t.qrSize || 0.127));
  const cx = W * (t.qrX ?? 0.848);
  const cy = H * (t.qrY ?? 0.605);
  drawQr(ctx, t.qrCode, Math.round(cx - qrSize / 2), Math.round(cy - qrSize / 2), qrSize, Math.round(qrSize * 0.07));

  // 2) Large QR panel underneath: this is the one that scans reliably from a phone screen
  const big = Math.round(W * 0.42);
  const bx = Math.round((W - big) / 2);
  const by = H + Math.round(W * 0.035);
  drawQr(ctx, t.qrCode, bx, by, big, Math.round(big * 0.05));
  // thin border so the white box is visible on a white page
  ctx.strokeStyle = '#E3E3EE';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, big, big);

  ctx.textAlign = 'center';
  let ty = by + big + Math.round(W * 0.06);
  ctx.fillStyle = '#0B0870';
  ctx.font = `700 ${Math.round(W * 0.034)}px Sora, Arial, sans-serif`;
  ctx.fillText([t.tierName, t.category].filter(Boolean).join(' · '), W / 2, ty);

  ty += Math.round(W * 0.045);
  ctx.fillStyle = '#1B1B2A';
  ctx.font = `500 ${Math.round(W * 0.027)}px Inter, Arial, sans-serif`;
  ctx.fillText(`Ticket ${t.seq} of ${total} · ${t.buyerName}`, W / 2, ty);

  ty += Math.round(W * 0.04);
  ctx.fillStyle = '#5B5B72';
  ctx.font = `500 ${Math.round(W * 0.022)}px monospace`;
  ctx.fillText(t.qrCode, W / 2, ty);

  return canvas;
}

function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, 'image/png');
}

/* ---------- Showing the tickets ---------- */

async function showTickets(data) {
  clearTimeout(pollTimer);
  $('statusBox').style.display = 'none';

  const tickets = data.tickets;
  const total = tickets.length;

  $('orderHead').innerHTML = `
    <i class="fa-solid fa-circle-check"></i>
    <div>
      <h2>Payment confirmed</h2>
      <p>${total} ticket${total === 1 ? '' : 's'} for ${esc(data.buyerName)} · ${fmt(data.amountNaira)}</p>
    </div>`;
  $('orderHead').style.display = 'flex';

  $('ticketList').innerHTML = tickets.map((t, i) => `
    <article class="tc-ticket">
      <div class="tc-img" id="img-${i}"><p class="tc-loading">Preparing ticket…</p></div>
      <div class="tc-foot">
        <div>
          <strong>${esc(t.tierName)}</strong>
          <span>Ticket ${t.seq} of ${total}</span>
          ${t.status === 'used' ? '<em class="tc-used">ALREADY USED</em>' : ''}
        </div>
        <button class="tk-btn tk-btn-small" data-i="${i}"><i class="fa-solid fa-download"></i> Download</button>
      </div>
    </article>
  `).join('');

  built = [];
  for (let i = 0; i < tickets.length; i++) {
    const t = tickets[i];
    const slot = $(`img-${i}`);
    try {
      const canvas = await buildTicketCanvas(t, total);
      const safe = String(t.tierName || 'ticket').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      built[i] = { canvas, name: `okizz-${safe}-ticket-${t.seq}.png` };

      // Shown as an <img> so people can also long-press to save it
      const img = document.createElement('img');
      img.alt = `${t.tierName} ticket ${t.seq}`;
      img.src = canvas.toDataURL('image/png');
      slot.innerHTML = '';
      slot.appendChild(img);
    } catch (_) {
      slot.innerHTML = '<p class="tc-loading">Could not draw this ticket. Reload the page to try again.</p>';
    }
  }

  if (total > 1) $('downloadAllBtn').style.display = 'flex';
}

$('ticketList').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-i]');
  if (!btn) return;
  const item = built[Number(btn.dataset.i)];
  if (item) downloadCanvas(item.canvas, item.name);
});

$('downloadAllBtn').addEventListener('click', () => {
  built.forEach((item, i) => {
    if (item) setTimeout(() => downloadCanvas(item.canvas, item.name), i * 500);
  });
});

/* ---------- Start ---------- */

if (!reference) {
  showStatus('fa-circle-question', 'No order found',
    'Open this page from your payment confirmation, or enter your payment reference on the tickets page.',
    { button: 'Go to tickets', onClick: () => { window.location.href = 'tickets.html'; } });
} else {
  showStatus('fa-spinner fa-spin', 'Loading your tickets…', 'One moment.');
  check();
}