(async function requireAdminSession() {
  try {
    const res = await fetch(`${API_BASE}/admin/session`, { credentials: 'include' });
    if (!res.ok) throw new Error();
  } catch {
    window.location.href = 'login.html';
  }
})();