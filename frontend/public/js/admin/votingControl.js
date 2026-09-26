let activeSession = null;
let settingsCache = null;
let selectedPerformerIds = new Set();

function naira(kobo) {
  return `₦${(kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

async function loadAll() {
  const [sessionRes, settingsRes] = await Promise.all([
    fetch(`${API_BASE}/admin/sessions/active`, { credentials: 'include' }),
    fetch(`${API_BASE}/admin/settings`, { credentials: 'include' })
  ]);
  activeSession = sessionRes.ok ? await sessionRes.json() : null;
  settingsCache = await settingsRes.json();
  renderControl();
}

function renderControl() {
  const card = document.getElementById('masterControlCard');
  const nameEl = document.getElementById('sessionName');
  const descEl = document.getElementById('votingDesc');
  const actionsEl = document.getElementById('sessionActions');

  if (!activeSession) {
    card.classList.add('is-off');
    nameEl.textContent = 'No active session';
    descEl.textContent = 'Start a new session to open voting.';
    actionsEl.innerHTML = '';
  } else {
    const paused = activeSession.isPaused;
    card.classList.toggle('is-off', paused);
    nameEl.textContent = activeSession.name;
    descEl.textContent = paused
      ? 'Paused — the Stat Board is visible but vote buttons are disabled.'
      : 'Live — fans can buy votes on the Stat Board right now.';
    actionsEl.innerHTML = `
      ${paused
        ? `<button class="btn btn-primary" id="resumeBtn">Resume voting</button>`
        : `<button class="btn admin-btn-danger" id="pauseBtn">Pause voting</button>`}
      <button class="admin-link-action danger" id="endSessionBtn" style="margin-top:10px;">End session</button>
    `;

    const toggleBtn = document.getElementById(paused ? 'resumeBtn' : 'pauseBtn');
    toggleBtn.addEventListener('click', () => showPauseModal(paused));

    document.getElementById('endSessionBtn').addEventListener('click', endCurrentSession);
  }

  document.getElementById('priceInput').value = settingsCache.votePrice / 100;
  updatePreview();
}

function updatePreview() {
  const priceNaira = Number(document.getElementById('priceInput').value) || 0;
  document.getElementById('pricePreview').textContent = `Preview · 50 votes = ${naira(priceNaira * 100 * 50)}`;
}
document.getElementById('priceInput').addEventListener('input', updatePreview);

function showPauseModal(currentlyPaused) {
  const backdrop = document.getElementById('pauseModalBackdrop');
  const turningOn = currentlyPaused; // if paused, this action resumes
  document.getElementById('pauseModalTitle').textContent = turningOn ? 'Resume voting for everyone?' : 'Pause voting for everyone?';
  document.getElementById('pauseModalBody').textContent = turningOn
    ? 'Vote buttons will be enabled across the site straight away.'
    : 'Vote buttons will be disabled across the site straight away. Standings stay visible.';
  const confirmBtn = document.getElementById('confirmPauseBtn');
  confirmBtn.textContent = turningOn ? 'Resume voting' : 'Pause voting';
  confirmBtn.className = turningOn ? 'btn btn-primary' : 'btn admin-btn-danger';
  confirmBtn.onclick = async () => {
    const action = turningOn ? 'resume' : 'pause';
    await fetch(`${API_BASE}/admin/sessions/${activeSession.id || activeSession._id}/${action}`, {
      method: 'PATCH', credentials: 'include'
    });
    backdrop.style.display = 'none';
    await loadAll();
  };
  backdrop.style.display = 'flex';
}
document.getElementById('closePauseModal').addEventListener('click', () => { document.getElementById('pauseModalBackdrop').style.display = 'none'; });
document.getElementById('cancelPauseBtn').addEventListener('click', () => { document.getElementById('pauseModalBackdrop').style.display = 'none'; });

async function endCurrentSession() {
  if (!confirm(`End "${activeSession.name}"? It will move to Session history and voting will close until a new session starts.`)) return;
  await fetch(`${API_BASE}/admin/sessions/${activeSession._id}/end`, { method: 'PATCH', credentials: 'include' });
  await loadAll();
}

document.getElementById('savePriceBtn').addEventListener('click', async () => {
  const priceNaira = Number(document.getElementById('priceInput').value);
  if (!priceNaira || priceNaira <= 0) return;
  await fetch(`${API_BASE}/admin/settings`, {
    method: 'PATCH', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ votePrice: priceNaira * 100 })
  });
  await loadAll();
});

// New session modal
const nsBackdrop = document.getElementById('newSessionBackdrop');
document.getElementById('newSessionBtn').addEventListener('click', openNewSessionModal);
document.getElementById('closeNewSessionModal').addEventListener('click', () => { nsBackdrop.style.display = 'none'; });

async function openNewSessionModal() {
  selectedPerformerIds = new Set();
  document.getElementById('ns_name').value = '';
  document.getElementById('newSessionError').style.display = 'none';

  const warningEl = document.getElementById('newSessionWarning');
  if (activeSession) {
    warningEl.textContent = `Starting a new session will immediately end "${activeSession.name}".`;
    warningEl.style.display = 'block';
  } else {
    warningEl.style.display = 'none';
  }

  const res = await fetch(`${API_BASE}/admin/performers?status=approved`, { credentials: 'include' });
  const { performers } = await res.json();

  document.getElementById('ns_performerList').innerHTML = performers.map((p) => `
    <label class="admin-checklist-item">
      <input type="checkbox" value="${p._id}">
      <img src="${p.photoUrl}" class="admin-performer-avatar" alt="">
      <span>${p.stageName}</span>
    </label>
  `).join('') || `<p class="admin-empty-state">No approved performers yet.</p>`;

  document.querySelectorAll('#ns_performerList input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) selectedPerformerIds.add(cb.value);
      else selectedPerformerIds.delete(cb.value);
    });
  });

  nsBackdrop.style.display = 'flex';
}

document.getElementById('createSessionBtn').addEventListener('click', async () => {
  const errorEl = document.getElementById('newSessionError');
  const name = document.getElementById('ns_name').value.trim();

  if (!name) { errorEl.textContent = 'Session name is required.'; errorEl.style.display = 'block'; return; }
  if (selectedPerformerIds.size === 0) { errorEl.textContent = 'Select at least one performer.'; errorEl.style.display = 'block'; return; }

  const res = await fetch(`${API_BASE}/admin/sessions`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, performerIds: [...selectedPerformerIds] })
  });

  if (!res.ok) {
    const data = await res.json();
    errorEl.textContent = data.error || 'Failed to start session.';
    errorEl.style.display = 'block';
    return;
  }

  nsBackdrop.style.display = 'none';
  await loadAll();
});

// Sub-tabs
document.getElementById('tabControl').addEventListener('click', () => switchTab('control'));
document.getElementById('tabStatBoard').addEventListener('click', () => switchTab('statboard'));
document.getElementById('tabHistory').addEventListener('click', () => switchTab('history'));

function switchTab(tab) {
  document.getElementById('controlView').style.display = tab === 'control' ? 'block' : 'none';
  document.getElementById('statBoardView').style.display = tab === 'statboard' ? 'block' : 'none';
  document.getElementById('historyView').style.display = tab === 'history' ? 'block' : 'none';
  document.getElementById('tabControl').classList.toggle('active', tab === 'control');
  document.getElementById('tabStatBoard').classList.toggle('active', tab === 'statboard');
  document.getElementById('tabHistory').classList.toggle('active', tab === 'history');
  if (tab === 'statboard') loadCurrentStanding();
  if (tab === 'history') loadHistory();
}

async function loadCurrentStanding() {
  const container = document.getElementById('statBoardList');
  if (!activeSession) {
    container.innerHTML = `<p class="admin-empty-state">No active session.</p>`;
    return;
  }
  const ranked = [...activeSession.performers].sort((a, b) => b.voteCount - a.voteCount);
  container.innerHTML = `
    <p class="admin-page-sub">${activeSession.name} — read-only view.</p>
    ${ranked.map((p, i) => `
      <div class="admin-standings-row">
        <span class="admin-rank-badge">${i + 1}</span>
        <img src="${p.photoUrl}" class="admin-performer-avatar" alt="">
        <span class="admin-performer-name">${p.stageName}</span>
        <span class="admin-vote-count">${p.voteCount.toLocaleString()} votes</span>
      </div>
    `).join('')}
  `;
}

async function loadHistory() {
  const res = await fetch(`${API_BASE}/admin/sessions`, { credentials: 'include' });
  const sessions = (await res.json()).filter((s) => s.status === 'ended');
  const container = document.getElementById('historyList');

  if (!sessions.length) {
    container.innerHTML = `<p class="admin-empty-state">No past sessions yet.</p>`;
    return;
  }

  container.innerHTML = sessions.map((s) => {
    const ranked = [...s.performers].sort((a, b) => b.voteCount - a.voteCount);
    return `
      <div class="admin-card admin-history-card">
        <div class="admin-history-head">
          <h3>${s.name}</h3>
          <span class="admin-history-date">Ended ${new Date(s.endedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
        ${ranked.slice(0, 3).map((p, i) => `
          <div class="admin-standings-row">
            <span class="admin-rank-badge">${i + 1}</span>
            <img src="${p.photoUrl}" class="admin-performer-avatar" alt="">
            <span class="admin-performer-name">${p.stageName}</span>
            <span class="admin-vote-count">${p.voteCount.toLocaleString()} votes</span>
          </div>
        `).join('')}
      </div>
    `;
  }).join('');
}

loadAll();