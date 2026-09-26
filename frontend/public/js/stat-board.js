const QUICK_OPTIONS = [10, 50, 100, 500];
let previousRanks = null;
let currentData = null;
let selectedPerformer = null;
let qty = 10;

function naira(kobo) {
  return `₦${(kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

async function pollStatBoard() {
  const res = await fetch(`${API_BASE}/stat-board`);
  const data = await res.json();
  currentData = data;
  renderBoard(data);
}

function renderBoard(data) {
  if (!data.activeSession) {
    document.getElementById('sessionTitle').textContent = 'No active voting session';
    document.getElementById('sessionSub').textContent = 'Check back once the next round opens.';
    document.getElementById('totalVotes').textContent = '0';
    document.getElementById('perVote').textContent = naira(data.pricePerVote);
    document.getElementById('standingsList').innerHTML = `<p class="sb-empty">No session running right now.</p>`;
    document.getElementById('liveBadge').style.display = 'none';
    return;
  }

  const session = data.activeSession;
  document.getElementById('liveBadge').style.display = 'inline-flex';
  document.getElementById('sessionTitle').textContent = session.name;
  document.getElementById('sessionSub').textContent = 'Every vote moves the rankings. Top performers take the stage on showdown night.';
  document.getElementById('totalVotes').textContent = session.totalVotes.toLocaleString();
  document.getElementById('perVote').textContent = naira(data.pricePerVote);
  document.getElementById('pausedNote').style.display = data.votingOpen ? 'none' : 'block';

  const newRanks = {};
  document.getElementById('standingsList').innerHTML = session.performers.map((p) => {
    newRanks[p.id] = p.rank;
    let movementHtml = `<span class="sb-movement">—</span>`;
    if (previousRanks && previousRanks[p.id] !== undefined) {
      const diff = previousRanks[p.id] - p.rank;
      if (diff > 0) movementHtml = `<span class="sb-movement up"><i class="fa-solid fa-arrow-up"></i> ${diff}</span>`;
      else if (diff < 0) movementHtml = `<span class="sb-movement down"><i class="fa-solid fa-arrow-down"></i> ${Math.abs(diff)}</span>`;
    }
    const rankClass = p.rank === 1 ? 'top1' : p.rank <= 3 ? 'top2' : '';
    return `
      <div class="sb-row">
        <span class="sb-rank ${rankClass}">${p.rank}</span>
        <img src="${p.photoUrl}" class="sb-avatar" alt="">
        <span class="sb-name">${p.stageName}</span>
        ${movementHtml}
        <div class="sb-votes"><b>${p.voteCount.toLocaleString()}</b><span>VOTES</span></div>
        <button class="sb-vote-btn" data-id="${p.id}" ${data.votingOpen ? '' : 'disabled'}>Vote</button>
      </div>
    `;
  }).join('');
  previousRanks = newRanks;

  document.querySelectorAll('.sb-vote-btn').forEach((btn) => {
    btn.addEventListener('click', () => openVoteModal(btn.dataset.id));
  });
}

function openVoteModal(performerId) {
  selectedPerformer = currentData.activeSession.performers.find((p) => p.id === performerId);
  qty = 10;
  document.getElementById('modalPricePerVote').textContent = `${naira(currentData.pricePerVote)} per vote`;
  document.getElementById('modalPerformerCard').innerHTML = `
    <img src="${selectedPerformer.photoUrl}" alt="">
    <div>
      <div class="name">${selectedPerformer.stageName}</div>
      <div class="meta">#${selectedPerformer.rank} · ${selectedPerformer.voteCount.toLocaleString()} votes</div>
    </div>
  `;
  document.getElementById('qtyQuick').innerHTML = QUICK_OPTIONS.map((n) =>
    `<button type="button" data-qty="${n}" class="${n === qty ? 'active' : ''}">${n}</button>`
  ).join('');
  document.querySelectorAll('#qtyQuick button').forEach((b) => {
    b.addEventListener('click', () => { qty = Number(b.dataset.qty); updateQtyUI(); });
  });
  document.getElementById('voteError').style.display = 'none';
  updateQtyUI();
  document.getElementById('voteModalBackdrop').style.display = 'flex';
}

function updateQtyUI() {
  document.getElementById('qtyValue').textContent = qty;
  document.querySelectorAll('#qtyQuick button').forEach((b) => b.classList.toggle('active', Number(b.dataset.qty) === qty));
  const total = qty * currentData.pricePerVote;
  document.getElementById('qtyBreakdown').textContent = `${qty} × ${naira(currentData.pricePerVote)}`;
  document.getElementById('totalAmount').textContent = naira(total);
  document.getElementById('payBtnLabel').textContent = `Pay ${naira(total)}`;
}

document.getElementById('qtyMinus').addEventListener('click', () => { qty = Math.max(1, qty - 1); updateQtyUI(); });
document.getElementById('qtyPlus').addEventListener('click', () => { qty += 1; updateQtyUI(); });
document.getElementById('closeVoteModal').addEventListener('click', () => { document.getElementById('voteModalBackdrop').style.display = 'none'; });

document.getElementById('payBtn').addEventListener('click', async () => {
  const errorEl = document.getElementById('voteError');
  const email = document.getElementById('voterEmail').value.trim();
  if (!email) { errorEl.textContent = 'Please enter your email.'; errorEl.style.display = 'block'; return; }
  errorEl.style.display = 'none';

  try {
    const { authorizationUrl } = await apiPost('/vote/initiate', {
      performerId: selectedPerformer.id, quantity: qty, email
    });
    window.location.href = authorizationUrl;
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  }
});

// Older sessions tab
document.getElementById('tabCurrent').addEventListener('click', () => switchView('current'));
document.getElementById('tabOlder').addEventListener('click', () => switchView('older'));

function switchView(view) {
  document.getElementById('currentView').style.display = view === 'current' ? 'block' : 'none';
  document.getElementById('olderView').style.display = view === 'older' ? 'block' : 'none';
  document.getElementById('tabCurrent').classList.toggle('active', view === 'current');
  document.getElementById('tabOlder').classList.toggle('active', view === 'older');
  if (view === 'older') loadOlderSessions();
}

async function loadOlderSessions() {
  const res = await fetch(`${API_BASE}/sessions`);
  const sessions = await res.json();
  const container = document.getElementById('olderList');

  if (!sessions.length) {
    container.innerHTML = `<p class="sb-empty">No past sessions yet.</p>`;
    return;
  }

  container.innerHTML = sessions.map((s) => `
    <div class="sb-older-session">
      <h3>${s.name}</h3>
      <p class="sb-older-meta">${s.totalVotes.toLocaleString()} total votes · ended ${new Date(s.endedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
      ${s.performers.map((p) => `
        <div class="sb-row">
          <span class="sb-rank ${p.rank === 1 ? 'top1' : p.rank <= 3 ? 'top2' : ''}">${p.rank}</span>
          <img src="${p.photoUrl}" class="sb-avatar" alt="">
          <span class="sb-name">${p.stageName}</span>
          <div class="sb-votes"><b>${p.voteCount.toLocaleString()}</b><span>VOTES</span></div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

pollStatBoard();
setInterval(pollStatBoard, 8000);