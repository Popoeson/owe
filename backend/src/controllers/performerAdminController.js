const Performer = require('../models/Performer');

async function listPerformers(req, res, next) {
  try {
    const performers = await Performer.find().sort({ createdAt: -1 });
    res.json(performers);
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
      // registrationPaymentRef intentionally left null — BR-09
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