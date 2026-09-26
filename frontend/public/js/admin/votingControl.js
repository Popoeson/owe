let settingsCache = null;

function naira(kobo) {
  return `₦${(kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

async function loadSettings() {
  const res = await fetch(`${API_BASE}/admin/settings`, { credentials: 'include' });
  settingsCache = await res.json();
  renderControl();
}

function renderControl() {
  const card = document.getElementById('masterControlCard');
  const isOpen = settingsCache.votingOpen;
  card.classList.toggle('is-off', !isOpen);
  document.getElementById('votingWord').textContent = isOpen ? 'ON' : 'OFF';
  document.getElementById('votingDesc').textContent = isOpen
    ? 'Fans can buy votes on the Stat Board right now.'
    : 'The Stat Board is visible, but vote buttons are disabled with a "voting paused" notice.';
  document.getElementById('votingToggle').checked = isOpen;
  document.getElementById('priceInput').value = settingsCache.votePrice / 100;
  updatePreview();
}

function updatePreview() {
  const priceNaira = Number(document.getElementById('priceInput').value) || 0;
  document.getElementById('pricePreview').textContent = `Preview · 50 votes = ${naira(priceNaira * 100 * 50)}`;
}
document.getElementById('priceInput').addEventListener('input', updatePreview);

document.getElementById('votingToggle').addEventListener('change', (e) => {
  const wantsOn = e.target.checked;
  e.target.checked = !wantsOn; // revert until confirmed
  showPauseModal(wantsOn);
});

function showPauseModal(turningOn) {
  const backdrop = document.getElementById('pauseModalBackdrop');
  document.getElementById('pauseModalTitle').textContent = turningOn ? 'Resume voting for everyone?' : 'Pause voting for everyone?';
  document.getElementById('pauseModalBody').textContent = turningOn
    ? 'Vote buttons will be enabled across the site straight away.'
    : 'Vote buttons will be disabled across the site straight away. Standings stay visible.';
  const confirmBtn = document.getElementById('confirmPauseBtn');
  confirmBtn.textContent = turningOn ? 'Resume voting' : 'Pause voting';
  confirmBtn.className = turningOn ? 'btn btn-primary' : 'btn admin-btn-danger';
  confirmBtn.onclick = async () => {
    await fetch(`${API_BASE}/admin/settings`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ votingOpen: turningOn })
    });
    backdrop.style.display = 'none';
    await loadSettings();
  };
  backdrop.style.display = 'flex';
}
document.getElementById('closePauseModal').addEventListener('click', () => { document.getElementById('pauseModalBackdrop').style.display = 'none'; });
document.getElementById('cancelPauseBtn').addEventListener('click', () => { document.getElementById('pauseModalBackdrop').style.display = 'none'; });

document.getElementById('savePriceBtn').addEventListener('click', async () => {
  const priceNaira = Number(document.getElementById('priceInput').value);
  if (!priceNaira || priceNaira <= 0) return;
  await fetch(`${API_BASE}/admin/settings`, {
    method: 'PATCH', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ votePrice: priceNaira * 100 })
  });
  await loadSettings();
});

// Sub-tabs
document.getElementById('tabControl').addEventListener('click', () => switchTab('control'));
document.getElementById('tabStatBoard').addEventListener('click', () => switchTab('statboard'));

function switchTab(tab) {
  document.getElementById('controlView').style.display = tab === 'control' ? 'block' : 'none';
  document.getElementById('statBoardView').style.display = tab === 'statboard' ? 'block' : 'none';
  document.getElementById('tabControl').classList.toggle('active', tab === 'control');
  document.getElementById('tabStatBoard').classList.toggle('active', tab === 'statboard');
  if (tab === 'statboard') loadStatBoard();
}

async function loadStatBoard() {
  const res = await fetch(`${API_BASE}/stat-board`);
  const { performers, totalVotes } = await res.json();
  document.getElementById('statBoardList').innerHTML = `
    <p class="admin-page-sub">Total votes: ${totalVotes.toLocaleString()} — read-only view.</p>
    ${performers.map((p) => `
      <div class="admin-standings-row">
        <span class="admin-rank-badge">${p.rank}</span>
        <img src="${p.photoUrl}" class="admin-performer-avatar" alt="">
        <span class="admin-performer-name">${p.stageName}</span>
        <span class="admin-vote-count">${p.voteCount.toLocaleString()} votes</span>
      </div>
    `).join('')}
  `;
}

loadSettings();