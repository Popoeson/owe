function renderAdminNav(activePage) {
  const link = (page, icon, label) =>
    `<a href="${page}.html" class="admin-nav-link ${activePage === page ? 'active' : ''}">
       <i class="fa-solid ${icon}"></i> ${label}
     </a>`;

  document.getElementById('adminNav').innerHTML = `
    <nav class="admin-nav">
      <a href="dashboard.html" class="admin-nav-brand">
        <img src="../images/okizz_ligo.png" alt="OKIZZ Entertainment" class="admin-nav-logo">
      </a>
      <div class="admin-nav-links">
        ${link('dashboard', 'fa-table-cells', 'Dashboard')}
        ${link('performers', 'fa-users', 'Performers')}
        ${link('payments', 'fa-credit-card', 'Payments')}
        ${link('voting-control', 'fa-sliders', 'Voting control')}
        ${link('tickets', 'fa-ticket', 'Tickets &amp; scanner')}
        ${link('export', 'fa-download', 'Export')}
      </div>
      <button class="admin-nav-logout" id="adminLogoutBtn" aria-label="Log out">
        <i class="fa-solid fa-right-from-bracket"></i>
      </button>
    </nav>`;

  document.getElementById('adminLogoutBtn').addEventListener('click', async () => {
    await fetch(`${API_BASE}/admin/logout`, { method: 'POST', credentials: 'include' });
    window.location.href = 'login.html';
  });
}