const Ticket = require('../models/Ticket');

const MAX_SCANS = 2;        // how many times one ticket can be scanned in total
const DEBOUNCE_MS = 8000;   // a re-scan inside this window is the same entry, so it is not counted

const ticketInfo = (t) => ({
  tierName: t.tierId?.name,
  category: t.tierId?.category,
  buyerName: t.buyerName,
  seq: t.seq,
});

const counts = (t) => {
  const scanCount = t.scanCount || 0;
  return { scanCount, maxScans: MAX_SCANS, scansLeft: Math.max(0, MAX_SCANS - scanCount) };
};

/**
 * Atomic: the count check and the increment happen in one database operation,
 * so two phones scanning the same code at once can never use more than MAX_SCANS.
 * Returns { status, body } for the controller to send.
 */
exports.scanTicketCode = async (rawCode) => {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code || code.length > 64) {
    return { status: 404, body: { result: 'invalid', message: 'Invalid ticket.' } };
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - DEBOUNCE_MS);

  const ticket = await Ticket.findOneAndUpdate(
    {
      qrCode: code,
      $and: [
        { $or: [{ scanCount: { $lt: MAX_SCANS } }, { scanCount: { $exists: false } }] },
        { $or: [{ usedAt: null }, { usedAt: { $lte: cutoff } }] },
      ],
    },
    { $inc: { scanCount: 1 }, $push: { scanLog: now }, $set: { usedAt: now } },
    { new: true }
  ).populate('tierId', 'name category');

  if (ticket) {
    if (ticket.scanCount >= MAX_SCANS) {
      await Ticket.updateOne({ _id: ticket._id }, { status: 'used' });
    }
    return {
      status: 200,
      body: { result: 'valid', message: 'Valid ticket. Admit.', ticket: ticketInfo(ticket), ...counts(ticket) },
    };
  }

  // Not counted: work out why
  const existing = await Ticket.findOne({ qrCode: code }).populate('tierId', 'name category');
  if (!existing) {
    return { status: 404, body: { result: 'invalid', message: 'Invalid ticket.' } };
  }

  const c = counts(existing);
  if (c.scanCount >= MAX_SCANS) {
    return {
      status: 409,
      body: {
        result: 'used',
        message: 'Fully used.',
        usedAt: existing.usedAt,
        scanTimes: existing.scanLog || [],
        ticket: ticketInfo(existing),
        ...c,
      },
    };
  }

  // Scanned again within the debounce window: same entry, nothing used up
  return {
    status: 200,
    body: { result: 'recent', message: 'Just scanned. No entry used.', ticket: ticketInfo(existing), ...c },
  };
};