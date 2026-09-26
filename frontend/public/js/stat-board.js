const QUICK_OPTIONS = [10, 50, 100, 500];
let previousRanks = null; // { performerId: rank } from the last poll — resets on page load, so "live since you opened this page"
let currentData = null;
let selectedPerformer = null;
let qty = 10;

function naira(kobo) {
  return `₦${(kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

async function pollStatBoard() {
  const res = await fetch(`${API_BASE}/stat-board`);
  const data = await res.json();
  renderBoard(data);
  currentData = data;
}

function renderBoard(data) {
  document.getElementById('totalVotes').textContent = data.totalVotes.toLocaleString();
  document.getElementById('perVote').textContent = naira(data.pricePerVote);
  document.getElementById('pausedNote').style.display = data.votingOpen ? 'none' : 'block';

  const newRanks = {};
  document.getElementById('standingsList').innerHTML = data.performers.map((p) => {
    newRanks[p.id] = p.rank;
    let movementHtml = `<span class="sb-movement">—</span>`;
    if (previousRanks && previousRanks[p.id] !== undefined) {
      const diff = previousRanks[p.id] - p.rank; // positive = moved up
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
  selectedPerformer = currentData.performers.find((p) => p.id === performerId);
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
  if (!email) {
    errorEl.textContent = 'Please enter your email.';
    errorEl.style.display = 'block';
    return;
  }
  errorEl.style.display = 'none';

  try {
    const { authorizationUrl } = await apiPost('/vote/initiate', {
      performerId: selectedPerformer.id,
      quantity: qty,
      email
    });
    window.location.href = authorizationUrl;
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  }
});
pollStatBoard();
setInterval(pollStatBoard, 8000); // "live" — re-fetches every 8s, movement compared to the previous poll in this session