const Performer = require('../models/Performer');

async function listPerformers(req, res, next) {
  try {
    const performers = await Performer.find().sort({ createdAt: -1 });
    res.json(performers);
  } catch (err) { next(err); }
}

async function approvePerformer(req, res, next) {
  try {
    const performer = await Performer.findByIdAndUpdate(
      req.params.id, { status: 'approved' }, { new: true }
    );
    res.json(performer);
  } catch (err) { next(err); }
}

async function rejectPerformer(req, res, next) {
  try {
    const { reason } = req.body;
    const performer = await Performer.findByIdAndUpdate(
      req.params.id, { status: 'rejected', rejectionReason: reason || null }, { new: true }
    );
    res.json(performer);
  } catch (err) { next(err); }
}

async function deactivatePerformer(req, res, next) {
  try {
    const performer = await Performer.findByIdAndUpdate(
      req.params.id, { isActive: false }, { new: true }
    );
    res.json(performer);
  } catch (err) { next(err); }
}

async function reactivatePerformer(req, res, next) {
  try {
    const performer = await Performer.findByIdAndUpdate(
      req.params.id, { isActive: true }, { new: true }
    );
    res.json(performer);
  } catch (err) { next(err); }
}

async function hardDeletePerformer(req, res, next) {
  try {
    await Performer.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// Manual onboarding — bypasses payment entirely (BR-09)
async function onboardPerformer(req, res, next) {
  try {
    const { fullName, stageName, bio, photoUrl, videoUrl, status } = req.body;
    const performer = await Performer.create({
      fullName, stageName, bio, photoUrl, videoUrl,
      status: status === 'approved' ? 'approved' : 'pending',
      source: 'admin-added',
      registrationPaymentRef: null
    });
    res.status(201).json(performer);
  } catch (err) { next(err); }
}

module.exports = {
  listPerformers, approvePerformer, rejectPerformer,
  deactivatePerformer, reactivatePerformer, hardDeletePerformer, onboardPerformer
};