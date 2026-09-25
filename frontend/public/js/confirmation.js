function formatNaira(kobo) {
  return `₦${(kobo / 100).toLocaleString('en-NG')}`;
}

async function loadConfirmation() {
  const params = new URLSearchParams(window.location.search);
  const reference = params.get('reference');
  if (!reference) return;

  try {
    const data = await apiGet(`/payments/${reference}`);

    const name = data.stageName || data.fullName || '';
    document.getElementById('confirmHeading').textContent = name
      ? `You're registered, ${name}!`
      : "You're registered!";

    const emailPart = data.payerEmail ? ` (${data.payerEmail})` : '';
    const phonePart = data.whatsappNumber ? ` (${data.whatsappNumber})` : '';
    document.getElementById('contactDetail').textContent =
      `We'll reach out to you by email${emailPart} or on WhatsApp${phonePart} once your audition has been reviewed.`;

    document.getElementById('amountPaid').textContent = formatNaira(data.amount);
    document.getElementById('referenceValue').textContent = data.reference;
  } catch {
    // Lookup failed — leave the generic copy in place; this should still read as success.
  }
}

loadConfirmation();