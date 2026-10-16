let tiers = [];
let editingId = null;
let imageUrl = '';
let uploading = false;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

// Where the QR prints on the ticket image (fractions of the image).
// Defaults suit the stub on the right-hand side of the standard design.
const DEFAULT_QR = { x: 0.848, y: 0.605, size: 0.127 };
let qr = { ...DEFAULT_QR };

const listEl = document.getElementById('tierList');
const backdrop = document.getElementById('tierModalBackdrop');
const errorEl = document.getElementById('tierError');
const saveBtn = document.getElementById('saveTierBtn');
const imageInput = document.getElementById('tierImageInput');
const imagePreview = document.getElementById('tierImagePreview');
const progressTrack = document.getElementById('tierProgressTrack');
const progressFill = document.getElementById('tierProgressFill');
const imageStatus = document.getElementById('tierImageStatus');
const qrStage = document.getElementById('qrStage');
const qrBox = document.getElementById('qrBox');
const qrSizeRange = document.getElementById('qrSizeRange');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const formatNaira = (n) => `₦${Number(n).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
const errMsg = (data, fallback) => (data && (data.error || data.message)) || fallback;

function setImageStatus(text, cls) {
  imageStatus.textContent = text;
  imageStatus.className = 'admin-upload-status' + (cls ? ` ${cls}` : '');
}

function showPreview(src) {
  if (src) {
    imagePreview.src = src;
    qrStage.style.display = 'block';
    updateQrBox();
  } else {
    imagePreview.removeAttribute('src');
    qrStage.style.display = 'none';
  }
}

async function loadTiers() {
  try {
    const res = await fetch(`${API_BASE}/admin/tickets/tiers`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(errMsg(data, 'Could not load tickets.'));
    tiers = data.tiers;
    renderTiers();
  } catch (err) {
    listEl.innerHTML = `<p class="admin-empty-state">${esc(err.message)}</p>`;
  }
}

function renderTiers() {
  if (!tiers.length) {
    listEl.innerHTML = `<p class="admin-empty-state">No tickets yet. Tap "Add ticket" to create one.</p>`;
    return;
  }

  // On-sale tickets first, hidden ones last
  const sorted = [...tiers].sort((a, b) => Number(b.isActive) - Number(a.isActive));

  listEl.innerHTML = sorted.map((t) => `
    <div class="admin-tier-card ${t.isActive ? '' : 'is-hidden'}">
      ${t.imageUrl ? `<img src="${esc(t.imageUrl)}" class="admin-tier-thumb" alt="${esc(t.name)} ticket">` : ''}
      <div class="admin-tier-top">
        <div>
          <h3 class="admin-tier-name">${esc(t.name)}</h3>
          <div class="admin-badge-row" style="margin-bottom:0;">
            <span class="admin-badge source">${esc(t.category)}</span>
            <span class="admin-badge ${t.isActive ? 'approved' : 'deactivated'}">${t.isActive ? 'ON SALE' : 'HIDDEN'}</span>
          </div>
        </div>
        <div class="admin-tier-price">${formatNaira(t.priceNaira)}</div>
      </div>
      ${t.description ? `<p class="admin-tier-desc">${esc(t.description)}</p>` : ''}
      <div class="admin-tier-actions">
        <button class="admin-link-action" data-action="edit" data-id="${t.id}">
          <i class="fa-solid fa-pen"></i> Edit
        </button>
        ${t.isActive
          ? `<button class="admin-link-action danger" data-action="hide" data-id="${t.id}"><i class="fa-solid fa-eye-slash"></i> Hide</button>`
          : `<button class="admin-link-action" data-action="restore" data-id="${t.id}"><i class="fa-solid fa-eye"></i> Put back on sale</button>`}
      </div>
    </div>
  `).join('');
}

listEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const tier = tiers.find((t) => String(t.id) === btn.dataset.id);
  if (!tier) return;

  if (btn.dataset.action === 'edit') return openModal(tier);

  if (btn.dataset.action === 'hide') {
    if (!confirm(`Hide "${tier.name}"? Fans won't be able to buy it, but tickets already sold stay valid.`)) return;
    await sendRequest(`${API_BASE}/admin/tickets/tiers/${tier.id}`, 'DELETE');
    return loadTiers();
  }

  if (btn.dataset.action === 'restore') {
    await sendRequest(`${API_BASE}/admin/tickets/tiers/${tier.id}`, 'PUT', { isActive: true });
    return loadTiers();
  }
});

async function sendRequest(url, method, body) {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch (_) { /* no body */ }
  return { ok: res.ok, data };
}

function openModal(tier) {
  editingId = tier ? tier.id : null;
  imageUrl = tier ? (tier.imageUrl || '') : '';
  uploading = false;

  document.getElementById('tierModalTitle').textContent = tier ? 'Edit ticket' : 'Add ticket';
  document.getElementById('tier_name').value = tier ? tier.name : '';
  document.getElementById('tier_category').value = tier ? tier.category : '';
  document.getElementById('tier_description').value = tier ? tier.description : '';
  document.getElementById('tier_price').value = tier ? tier.priceNaira : '';

  imageInput.value = '';
  progressTrack.style.display = 'none';
  progressFill.style.width = '0%';

  qr = {
    x: tier && tier.qrX != null ? tier.qrX : DEFAULT_QR.x,
    y: tier && tier.qrY != null ? tier.qrY : DEFAULT_QR.y,
    size: tier && tier.qrSize != null ? tier.qrSize : DEFAULT_QR.size
  };
  qrSizeRange.value = Math.round(qr.size * 100);

  showPreview(imageUrl);
  setImageStatus(imageUrl ? 'Current image. Choose a file to replace it.' : '');

  errorEl.style.display = 'none';
  backdrop.style.display = 'flex';
}

function closeModal() {
  backdrop.style.display = 'none';
}

imageInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    imageInput.value = '';
    return setImageStatus('Please choose an image file.', 'fail');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    imageInput.value = '';
    return setImageStatus('Image is too large. Max 5MB.', 'fail');
  }

  uploading = true;
  saveBtn.disabled = true;
  progressFill.style.width = '0%';
  progressTrack.style.display = 'block';
  setImageStatus('Uploading…');

  try {
    const url = await uploadToCloudinary(file, {
      onProgress: (p) => { progressFill.style.width = `${p}%`; }
    });
    imageUrl = url;
    showPreview(url);
    setImageStatus('Image uploaded', 'done');
  } catch (err) {
    setImageStatus(err.message, 'fail');
  } finally {
    uploading = false;
    saveBtn.disabled = false;
  }
});

/* ---------- QR placement ---------- */
let draggingQr = false;

function updateQrBox() {
  qrBox.style.left = `${qr.x * 100}%`;
  qrBox.style.top = `${qr.y * 100}%`;
  qrBox.style.width = `${qr.size * 100}%`;
  document.getElementById('qrSizeLabel').textContent = `${Math.round(qr.size * 100)}%`;
}

// fx, fy = desired centre as fractions of the image; clamped so the box stays inside it
function placeQr(fx, fy) {
  const rect = qrStage.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const halfW = qr.size / 2;
  const halfH = (qr.size * rect.width) / rect.height / 2;
  qr.x = Math.min(1 - halfW, Math.max(halfW, fx));
  qr.y = Math.min(1 - halfH, Math.max(halfH, fy));
  updateQrBox();
}

function moveQr(clientX, clientY) {
  const rect = qrStage.getBoundingClientRect();
  placeQr((clientX - rect.left) / rect.width, (clientY - rect.top) / rect.height);
}

qrBox.addEventListener('pointerdown', (e) => {
  draggingQr = true;
  qrBox.setPointerCapture(e.pointerId);
  e.preventDefault();
});
qrBox.addEventListener('pointermove', (e) => { if (draggingQr) moveQr(e.clientX, e.clientY); });
qrBox.addEventListener('pointerup', () => { draggingQr = false; });
qrBox.addEventListener('pointercancel', () => { draggingQr = false; });
qrStage.addEventListener('click', (e) => {
  if (qrBox.contains(e.target)) return;
  moveQr(e.clientX, e.clientY);
});
qrSizeRange.addEventListener('input', () => {
  qr.size = Number(qrSizeRange.value) / 100;
  placeQr(qr.x, qr.y);
});

document.getElementById('addTierBtn').addEventListener('click', () => openModal(null));
document.getElementById('closeTierModal').addEventListener('click', closeModal);

saveBtn.addEventListener('click', async () => {
  const name = document.getElementById('tier_name').value.trim();
  const category = document.getElementById('tier_category').value.trim();
  const description = document.getElementById('tier_description').value.trim();
  const priceNaira = Number(document.getElementById('tier_price').value);

  const fail = (msg) => { errorEl.textContent = msg; errorEl.style.display = 'block'; };

  if (uploading) return fail('Please wait for the image to finish uploading.');
  if (!name) return fail('Ticket type is required.');
  if (!category) return fail('Category is required.');
  if (!(priceNaira > 0)) return fail('Enter a price greater than 0.');
  if (!imageUrl) return fail('Please upload a ticket image.');

  saveBtn.disabled = true;
  const body = {
    name, category, description, priceNaira, imageUrl,
    qrX: Number(qr.x.toFixed(4)),
    qrY: Number(qr.y.toFixed(4)),
    qrSize: Number(qr.size.toFixed(4))
  };
  const { ok, data } = editingId
    ? await sendRequest(`${API_BASE}/admin/tickets/tiers/${editingId}`, 'PUT', body)
    : await sendRequest(`${API_BASE}/admin/tickets/tiers`, 'POST', body);
  saveBtn.disabled = false;

  if (!ok) return fail(errMsg(data, 'Could not save ticket.'));

  closeModal();
  await loadTiers();
});

loadTiers();