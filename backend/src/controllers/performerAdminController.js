const Performer = require('../models/Performer');
const Payment = require('../models/Payment');

async function listPerformers(req, res, next) {
  try {
    const { status, search } = req.query;
    const filter = {};

    if (status === 'pending' || status === 'rejected') {
      filter.status = status;
    } else if (status === 'approved') {
      filter.status = 'approved';
      filter.isActive = true; // deactivated approved performers live under "Deactivated" instead
    } else if (status === 'deactivated') {
      filter.isActive = false;
    } else if (status === 'all-active') {
      filter.isActive = true;
    }
    // no status, or unrecognized -> no filter (all performers)

    if (search) {
      filter.$or = [
        { stageName: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } }
      ];
    }

    const performers = await Performer.find(filter).sort({ createdAt: -1 }).lean();

    // Performer has no email field — populate it from the linked registration Payment.
    const refs = performers.map((p) => p.registrationPaymentRef).filter(Boolean);
    const payments = await Payment.find({ reference: { $in: refs } }, 'reference payerEmail').lean();
    const emailByRef = {};
    payments.forEach((p) => { emailByRef[p.reference] = p.payerEmail; });

    const withEmail = performers.map((p) => ({
      ...p,
      email: p.registrationPaymentRef ? emailByRef[p.registrationPaymentRef] || null : null
    }));

    const facets = await Performer.aggregate([
      { $facet: {
        pending: [{ $match: { status: 'pending' } }, { $count: 'n' }],
        approved: [{ $match: { status: 'approved', isActive: true } }, { $count: 'n' }],
        rejected: [{ $match: { status: 'rejected' } }, { $count: 'n' }],
        allActive: [{ $match: { isActive: true } }, { $count: 'n' }],
        deactivated: [{ $match: { isActive: false } }, { $count: 'n' }]
      } }
    ]);
    const f = facets[0];
    const counts = {
      pending: f.pending[0]?.n || 0,
      approved: f.approved[0]?.n || 0,
      rejected: f.rejected[0]?.n || 0,
      allActive: f.allActive[0]?.n || 0,
      deactivated: f.deactivated[0]?.n || 0
    };

    res.json({ performers: withEmail, counts });
  } catch (err) { next(err); }
}

async function onboardPerformer(req, res, next) {
  try {
    const { fullName, stageName, whatsappNumber, bio, photoUrl, status } = req.body;
    if (!fullName || !stageName || !whatsappNumber || !bio || !photoUrl) {
      return res.status(400).json({ error: 'fullName, stageName, whatsappNumber, bio, and photoUrl are required' });
    }
    const performer = await Performer.create({
      fullName, stageName, whatsappNumber, bio, photoUrl,
      source: 'admin-added',
      status: status === 'approved' ? 'approved' : 'pending'
    });
    res.status(201).json(performer);
  } catch (err) { next(err); }
}

async function approvePerformer(req, res, next) {
  try {
    const performer = await Performer.findByIdAndUpdate(req.params.id, { status: 'approved' }, { new: true });
    if (!performer) return res.status(404).json({ error: 'Performer not found' });
    res.json(performer);
  } catch (err) { next(err); }
}

async function rejectPerformer(req, res, next) {
  try {
    const { reason } = req.body;
    const performer = await Performer.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected', rejectionReason: reason || null },
      { new: true }
    );
    if (!performer) return res.status(404).json({ error: 'Performer not found' });
    res.json(performer);
  } catch (err) { next(err); }
}

async function deactivatePerformer(req, res, next) {
  try {
    const performer = await Performer.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!performer) return res.status(404).json({ error: 'Performer not found' });
    res.json(performer);
  } catch (err) { next(err); }
}

async function reactivatePerformer(req, res, next) {
  try {
    const performer = await Performer.findByIdAndUpdate(req.params.id, { isActive: true }, { new: true });
    if (!performer) return res.status(404).json({ error: 'Performer not found' });
    res.json(performer);
  } catch (err) { next(err); }
}

async function hardDeletePerformer(req, res, next) {
  try {
    const performer = await Performer.findByIdAndDelete(req.params.id);
    if (!performer) return res.status(404).json({ error: 'Performer not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = {
  listPerformers, onboardPerformer, approvePerformer, rejectPerformer,
  deactivatePerformer, reactivatePerformer, hardDeletePerformer
};