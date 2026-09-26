const TYPE_TABS = [
  { key: 'all', label: 'All types' },
  { key: 'registration', label: 'Registration' },
  { key: 'vote', label: 'Votes' },
  { key: 'ticket', label: 'Tickets' }
];

let activeType = 'all';
let searchTerm = '';
let activeStatus = 'all';

function naira(kobo) {
  return `₦${(kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}
function fmtDate(iso) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function loadPayments() {
  const params = new URLSearchParams();
  if (activeType !== 'all') params.set('type', activeType);
  if (activeStatus !== 'all') params.set('status', activeStatus);
  if (searchTerm) params.set('search', searchTerm);

  const res = await fetch(`${API_BASE}/admin/payments?${params}`, { credentials: 'include' });
  if (!res.ok) return;
  const { payments, confirmedTotal, count } = await res.json();
  renderTabs();
  renderTable(payments);
  document.getElementById('tableFooter').textContent =
    `Showing ${payments.length} of ${count} · ${naira(confirmedTotal)} confirmed in view`;
}

function renderTabs() {
  document.getElementById('typeTabs').innerHTML = TYPE_TABS.map((t) => `
    <button class="admin-tab ${activeType === t.key ? 'active' : ''}" data-type="${t.key}">${t.label}</button>
  `).join('');
  document.querySelectorAll('#typeTabs .admin-tab').forEach((btn) => {
    btn.addEventListener('click', () => { activeType = btn.dataset.type; loadPayments(); });
  });
}

function renderTable(payments) {
  const body = document.getElementById('paymentsTableBody');
  if (!payments.length) {
    body.innerHTML = `<tr><td colspan="7" class="admin-empty-state">No payments match this view.</td></tr>`;
    return;
  }

  body.innerHTML = payments.map((p) => `
    <tr>
      <td class="admin-td-mono">${p.reference}</td>
      <td class="admin-td-capitalize">${p.type}</td>
      <td>
        <div class="admin-td-payer-name">${p.payerName || '—'}</div>
        <div class="admin-td-payer-email">${p.payerEmail || '—'}</div>
      </td>
      <td>${p.details || '—'}</td>
      <td class="admin-td-mono">${naira(p.amount)}</td>
      <td><span class="admin-badge ${p.status}">${p.status.toUpperCase()}</span></td>
      <td>${fmtDate(p.createdAt)}</td>
    </tr>
  `).join('');
}

document.getElementById('searchInput').addEventListener('input', (e) => {
  searchTerm = e.target.value;
  loadPayments();
});
document.getElementById('statusSelect').addEventListener('change', (e) => {
  activeStatus = e.target.value;
  loadPayments();
});

loadPayments();