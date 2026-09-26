function naira(kobo) {
  return `₦${(kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

async function loadDashboard() {
  try {
    const res = await fetch(`${API_BASE}/admin/dashboard`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load dashboard');
    renderDashboard(await res.json());
  } catch (err) {
    console.error(err);
  }
}

function renderDashboard({ pendingPerformers, approvedPerformers, revenue, voting, tickets }) {
  document.getElementById('votingStatusBadge').textContent = voting.isOpen ? 'ON' : 'OFF';
  document.getElementById('votingStatusBadge').classList.toggle('off', !voting.isOpen);
  document.getElementById('votingHeadline').textContent = voting.isOpen ? 'Voting is live' : 'Voting is closed';
  document.getElementById('votingSub').textContent =
    `${naira(voting.pricePerVote)} per vote · ${voting.votesToday.toLocaleString()} votes today`;

  document.getElementById('totalRevenue').textContent = naira(revenue.total);
  document.getElementById('registrationRevenue').textContent = naira(revenue.registration);
  document.getElementById('votingRevenue').textContent = naira(revenue.voting);
  document.getElementById('ticketsRevenue').textContent = naira(revenue.tickets);

  const total = revenue.total || 1;
  document.getElementById('barRegistration').style.width = `${(revenue.registration / total) * 100}%`;
  document.getElementById('barVoting').style.width = `${(revenue.voting / total) * 100}%`;
  document.getElementById('barTickets').style.width = `${(revenue.tickets / total) * 100}%`;

  document.getElementById('pendingCount').textContent = pendingPerformers;
  document.getElementById('approvedCount').textContent = approvedPerformers;
  document.getElementById('votesCastCount').textContent = voting.totalVotesCast.toLocaleString();
  document.getElementById('votesTodayNote').textContent = `+${voting.votesToday.toLocaleString()} today`;
  document.getElementById('ticketsSoldCount').textContent = tickets.sold.toLocaleString();
  document.getElementById('ticketsCapacityNote').textContent = 'Capacity not yet configured';
}

loadDashboard();