const Ticket = require('../models/Ticket');

const ticketInfo = (t) => ({
  tierName: t.tierId?.name,
  category: t.tierId?.category,
  buyerName: t.buyerName,
  seq: t.seq,
});

/**
 * Atomic: two phones scanning the same code can never both get "valid".
 * Returns { status, body } for the controller to send.
 */
exports.scanTicketCode = async (rawCode) => {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code || code.length > 64) {
    return { status: 404, body: { result: 'invalid', message: 'Invalid ticket.' } };
  }

  const ticket = await Ticket.findOneAndUpdate(
    { qrCode: code, status: 'issued' },
    { status: 'used', usedAt: new Date() },
    { new: true }
  ).populate('tierId', 'name category');

  if (ticket) {
    return {
      status: 200,
      body: { result: 'valid', message: 'Valid ticket. Admit.', ticket: ticketInfo(ticket) },
    };
  }

  const existing = await Ticket.findOne({ qrCode: code }).populate('tierId', 'name category');
  if (existing) {
    return {
      status: 409,
      body: { result: 'used', message: 'Already used.', usedAt: existing.usedAt, ticket: ticketInfo(existing) },
    };
  }

  return { status: 404, body: { result: 'invalid', message: 'Invalid ticket.' } };
};