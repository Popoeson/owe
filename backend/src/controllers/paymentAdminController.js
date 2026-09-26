const Payment = require('../models/Payment');

async function listPayments(req, res, next) {
  try {
    const { type, status, search } = req.query;
    const filter = {};

    if (type && type !== 'all') filter.type = type;
    if (status && status !== 'all') filter.status = status;
    if (search) {
      filter.$or = [
        { reference: { $regex: search, $options: 'i' } },
        { payerName: { $regex: search, $options: 'i' } },
        { payerEmail: { $regex: search, $options: 'i' } }
      ];
    }

    const payments = await Payment.find(filter).sort({ createdAt: -1 }).lean();

    const shaped = payments.map((p) => ({
      reference: p.reference,
      type: p.type,
      amount: p.amount,
      status: p.status,
      payerName: p.payerName,
      payerEmail: p.payerEmail,
      createdAt: p.createdAt,
      // Details column: only registration has a backing source right now (registrationData).
      // Vote/Ticket payments have nothing to describe until those collections exist.
      details: p.type === 'registration'
        ? `Audition · ${p.registrationData?.stageName || '—'}`
        : null
    }));

    const confirmedTotal = shaped
      .filter((p) => p.status === 'confirmed')
      .reduce((sum, p) => sum + p.amount, 0);

    res.json({ payments: shaped, confirmedTotal, count: shaped.length });
  } catch (err) { next(err); }
}

module.exports = { listPayments };