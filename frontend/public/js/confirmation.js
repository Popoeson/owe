function formatNaira(kobo) {
  return `₦${(kobo / 100).toLocaleString('en-NG')}`;
}

function renderRegistration(data) {
  const name = data.stageName || data.fullName || '';
  document.getElementById('confirmHeading').textContent = name
    ? `You're registered, ${name}!`
    : "You're registered!";
  document.querySelector('.confirm-hero p').textContent =
    'Your audition for Fiesta Open Mic has been received and your fee is paid.';

  const emailPart = data.payerEmail ? ` (${data.payerEmail})` : '';
  const phonePart = data.whatsappNumber ? ` (${data.whatsappNumber})` : '';
  document.querySelector('.contact-note strong').textContent = 'Our team will reach out to you soon';
  document.getElementById('contactDetail').textContent =
    `We'll reach out to you by email${emailPart} or on WhatsApp${phonePart} once your audition has been reviewed.`;
}

function renderVote(data) {
  const summary = data.allocations.length
    ? data.allocations.map((a) => `${a.quantity.toLocaleString()} votes for ${a.stageName}`).join(', ')
    : 'your votes';

  document.getElementById('confirmHeading').textContent = "Your votes are in!";
  document.querySelector('.confirm-hero p').textContent =
    `Thanks for backing your favorite${data.allocations.length > 1 ? 's' : ''} — every vote moves the rankings.`;

  document.querySelector('.contact-note strong').textContent = 'Vote recorded';
  document.getElementById('contactDetail').textContent =
    `We've added ${summary}. Check the Stat Board to see the standings update.`;
}

function setBackLink(href, label) {
  const backBtn = document.querySelector('.confirm-actions .btn-primary');
  backBtn.href = href;
  backBtn.textContent = label;
}

async function loadConfirmation() {
  const params = new URLSearchParams(window.location.search);
  const reference = params.get('reference');
  if (!reference) return;

  try {
    const data = await apiGet(`/payments/${reference}`);

    if (data.type === 'vote') {
      renderVote(data);
      setBackLink('stat-board.html', 'Back to Stat Board');
    } else {
      renderRegistration(data);
      setBackLink('index.html', 'Back to home');
    }

    document.getElementById('amountPaid').textContent = formatNaira(data.amount);
    document.getElementById('referenceValue').textContent = data.reference;
  } catch {
    // Lookup failed — leave the generic copy in place; this should still read as success.
  }
}

loadConfirmation();