const Session = require('../models/Session');
const Performer = require('../models/Performer');

async function getActiveSession(req, res, next) {
  try {
    const session = await Session.findOne({ status: 'active' });
    res.json(session);
  } catch (err) { next(err); }
}

async function listAllSessions(req, res, next) {
  try {
    const sessions = await Session.find().sort({ startedAt: -1 });
    res.json(sessions);
  } catch (err) { next(err); }
}

// POST /api/admin/sessions — ends any current active session, starts a new one
async function createSession(req, res, next) {
  try {
    const { name, performerIds } = req.body;
    if (!name || !Array.isArray(performerIds) || performerIds.length === 0) {
      return res.status(400).json({ error: 'name and at least one performerId are required' });
    }

    const performers = await Performer.find({ _id: { $in: performerIds }, status: 'approved', isActive: true });
    if (performers.length !== performerIds.length) {
      return res.status(400).json({ error: 'One or more performers are not approved/active' });
    }

    await Session.updateMany(
      { status: 'active' },
      { status: 'ended', endedAt: new Date() }
    );

    const session = await Session.create({
      name,
      status: 'active',
      performers: performers.map((p) => ({
        performerId: p._id,
        stageName: p.stageName,
        photoUrl: p.photoUrl,
        voteCount: 0
      }))
    });

    res.status(201).json(session);
  } catch (err) { next(err); }
}

async function pauseSession(req, res, next) {
  try {
    const session = await Session.findOneAndUpdate({ _id: req.params.id, status: 'active' }, { isPaused: true }, { new: true });
    if (!session) return res.status(404).json({ error: 'Active session not found' });
    res.json(session);
  } catch (err) { next(err); }
}

async function resumeSession(req, res, next) {
  try {
    const session = await Session.findOneAndUpdate({ _id: req.params.id, status: 'active' }, { isPaused: false }, { new: true });
    if (!session) return res.status(404).json({ error: 'Active session not found' });
    res.json(session);
  } catch (err) { next(err); }
}

async function endSession(req, res, next) {
  try {
    const session = await Session.findOneAndUpdate(
      { _id: req.params.id, status: 'active' },
      { status: 'ended', endedAt: new Date() },
      { new: true }
    );
    if (!session) return res.status(404).json({ error: 'Active session not found' });
    res.json(session);
  } catch (err) { next(err); }
}

module.exports = { getActiveSession, listAllSessions, createSession, pauseSession, resumeSession, endSession };