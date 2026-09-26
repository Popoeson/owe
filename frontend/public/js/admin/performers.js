const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all-active', label: 'All active' },
  { key: 'deactivated', label: 'Deactivated' }
];

let activeTab = 'pending';
let searchTerm = '';
let expandedId = null;
let uploadedPhotoUrl = null;

function fmtDate(iso) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function maskEmail(email) {
  if (!email) return '—';
  return email.length > 18 ? email.slice(0, 15) + '...' : email;
}

async function loadPerformers() {
  const params = new URLSearchParams();
  if (activeTab) params.set('status', activeTab);
  if (searchTerm) params.set('search', searchTerm);

  const res = await fetch(`${API_BASE}/admin/performers?${params}`, { credentials: 'include' });
  if (!res.ok) return;
  const { performers, counts } = await res.json();
  renderTabs(counts);
  renderList(performers);
}

function renderTabs(counts) {
  const countKey = { pending: 'pending', approved: 'approved', rejected: 'rejected', 'all-active': 'allActive', deactivated: 'deactivated' };
  document.getElementById('statusTabs').innerHTML = TABS.map((t) => `
    <button class="admin-tab ${activeTab === t.key ? 'active' : ''}" data-tab="${t.key}">
      ${t.label} <span class="admin-tab-count">${counts[countKey[t.key]] ?? 0}</span>
    </button>
  `).join('');

  document.querySelectorAll('.admin-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      expandedId = null;
      loadPerformers();
    });
  });
}

function renderList(performers) {
  const container = document.getElementById('performerList');
  if (!performers.length) {
    container.innerHTML = `<p class="admin-empty-state">No performers in this view.</p>`;
    return;
  }

  container.innerHTML = performers.map((p) => `
    <div class="admin-performer-card">
      <div class="admin-performer-row" data-id="${p._id}">
        <img src="${p.photoUrl}" class="admin-performer-avatar" alt="">
        <span class="admin-performer-name">${p.stageName}</span>
        <i class="fa-solid fa-chevron-${expandedId === p._id ? 'up' : 'down'}"></i>
      </div>
      ${expandedId === p._id ? renderDetail(p) : ''}
    </div>
  `).join('');

  container.querySelectorAll('.admin-performer-row').forEach((row) => {
    row.addEventListener('click', () => {
      const id = row.dataset.id;
      expandedId = expandedId === id ? null : id;
      loadPerformers();
    });
  });

  bindDetailActions();
}

function renderDetail(p) {
  const badgeClass = { pending: 'pending', approved: 'approved', rejected: 'rejected' }[p.status];
  return `
    <div class="admin-performer-detail" onclick="event.stopPropagation()">
      <img src="${p.photoUrl}" class="admin-performer-photo-full" alt="">
      ${p.videoUrl ? `
        <div class="admin-video-chip">
          <i class="fa-solid fa-circle-play"></i>
          <div>
            <div class="admin-video-name">${p.videoUrl.split('/').pop()}</div>
            <div class="admin-video-meta">audition video</div>
          </div>
        </div>` : ''}

      <div class="admin-badge-row">
        <span class="admin-badge ${badgeClass}">${p.status.toUpperCase()}</span>
        <span class="admin-badge source">${p.source === 'admin-added' ? 'ADMIN-ADDED' : 'PAID'}</span>
        ${!p.isActive ? `<span class="admin-badge deactivated">DEACTIVATED</span>` : ''}
      </div>

      <div class="admin-detail-grid">
        <div><span class="admin-detail-label">FULL NAME</span><div>${p.fullName}</div></div>
        <div><span class="admin-detail-label">STAGE NAME</span><div>${p.stageName}</div></div>
        <div><span class="admin-detail-label">VOTES</span><div>${p.voteCount.toLocaleString()}</div></div>
        <div><span class="admin-detail-label">PAYMENT REF</span><div>${p.registrationPaymentRef || '—'}</div></div>
        <div><span class="admin-detail-label">EMAIL</span><div>${maskEmail(p.email)}</div></div>
        <div><span class="admin-detail-label">PHONE</span><div>${p.whatsappNumber}</div></div>
        <div><span class="admin-detail-label">SUBMITTED</span><div>${fmtDate(p.createdAt)}</div></div>
      </div>

      <div class="admin-detail-bio">
        <span class="admin-detail-label">BIO</span>
        <p>${p.bio}</p>
      </div>

      ${p.rejectionReason ? `<div class="admin-rejection-note"><b>Rejection reason:</b> ${p.rejectionReason}</div>` : ''}

      <div class="admin-detail-actions">
        ${p.status !== 'approved' ? `<button class="btn admin-action-approve" data-action="approve" data-id="${p._id}"><i class="fa-solid fa-check"></i> Approve</button>` : ''}
        ${p.status !== 'rejected' ? `<button class="btn btn-ghost" data-action="reject" data-id="${p._id}"><i class="fa-solid fa-xmark"></i> Reject</button>` : ''}
      </div>
      <div class="admin-detail-actions-secondary">
        ${p.isActive
          ? `<button class="admin-link-action" data-action="deactivate" data-id="${p._id}"><i class="fa-solid fa-box-archive"></i> Deactivate</button>`
          : `<button class="admin-link-action" data-action="reactivate" data-id="${p._id}"><i class="fa-solid fa-rotate-left"></i> Reactivate</button>`}
        <button class="admin-link-action danger" data-action="delete" data-id="${p._id}"><i class="fa-solid fa-trash"></i> Delete permanently</button>
      </div>
    </div>
  `;
}

function bindDetailActions() {
  document.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const { action, id } = btn.dataset;

      if (action === 'reject') {
        const reason = prompt('Reason for rejection (optional):') || '';
        await fetch(`${API_BASE}/admin/performers/${id}/reject`, {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason })
        });
      } else if (action === 'delete') {
        if (!confirm('Permanently delete this performer? This cannot be undone.')) return;
        await fetch(`${API_BASE}/admin/performers/${id}`, { method: 'DELETE', credentials: 'include' });
        expandedId = null;
      } else {
        await fetch(`${API_BASE}/admin/performers/${id}/${action}`, { method: 'PATCH', credentials: 'include' });
      }
      loadPerformers();
    });
  });
}

document.getElementById('searchInput').addEventListener('input', (e) => {
  searchTerm = e.target.value;
  loadPerformers();
});

// Onboard modal
const backdrop = document.getElementById('onboardModalBackdrop');
document.getElementById('onboardBtn').addEventListener('click', () => { backdrop.style.display = 'flex'; });
document.getElementById('closeOnboardModal').addEventListener('click', () => { backdrop.style.display = 'none'; });

document.getElementById('ob_photoInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('ob_photoStatus');
  statusEl.textContent = 'Uploading...';
  try {
    uploadedPhotoUrl = await uploadToCloudinary(file, 'image'); // reuses existing js/cloudinary.js helper
    statusEl.textContent = 'Uploaded.';
  } catch {
    statusEl.textContent = 'Upload failed — try again.';
  }
});

document.getElementById('onboardForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('onboardError');
  errorEl.style.display = 'none';

  if (!uploadedPhotoUrl) {
    errorEl.textContent = 'Please wait for the photo to finish uploading.';
    errorEl.style.display = 'block';
    return;
  }

  const res = await fetch(`${API_BASE}/admin/performers`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: document.getElementById('ob_fullName').value,
      stageName: document.getElementById('ob_stageName').value,
      whatsappNumber: document.getElementById('ob_whatsappNumber').value,
      bio: document.getElementById('ob_bio').value,
      photoUrl: uploadedPhotoUrl,
      status: document.getElementById('ob_status').value
    })
  });

  if (!res.ok) {
    const data = await res.json();
    errorEl.textContent = data.error || 'Failed to onboard performer.';
    errorEl.style.display = 'block';
    return;
  }

  backdrop.style.display = 'none';
  e.target.reset();
  uploadedPhotoUrl = null;
  loadPerformers();
});

loadPerformers();