const crypto = require('crypto');
const Payment = require('../models/Payment');
const Performer = require('../models/Performer');
const Session = require('../models/Session');
const Settings = require('../models/Settings');
const { initializeTransaction } = require('../services/paystackService');

function shapeSession(session) {
  const ranked = [...session.performers].sort((a, b) => b.voteCount - a.voteCount);
  return {
    id: session._id,
    name: session.name,
    status: session.status,
    isPaused: session.isPaused,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    totalVotes: ranked.reduce((sum, p) => sum + p.voteCount, 0),
    performers: ranked.map((p, i) => ({
      id: p.performerId,
      rank: i + 1,
      stageName: p.stageName,
      photoUrl: p.photoUrl,
      voteCount: p.voteCount
    }))
  };
}

// GET /api/stat-board — current active session only
async function getStatBoard(req, res, next) {
  try {
    const settings = await Settings.getSingleton();
    const activeSession = await Session.findOne({ status: 'active' });

    if (!activeSession) {
      return res.json({ activeSession: null, pricePerVote: settings.votePrice });
    }

    res.json({
      activeSession: shapeSession(activeSession),
      votingOpen: !activeSession.isPaused,
      pricePerVote: settings.votePrice
    });
  } catch (err) { next(err); }
}

// GET /api/sessions — ended sessions only, for "view older session results"
async function listEndedSessions(req, res, next) {
  try {
    const sessions = await Session.find({ status: 'ended' }).sort({ endedAt: -1 });
    res.json(sessions.map(shapeSession));
  } catch (err) { next(err); }
}

// GET /api/sessions/:id — full frozen standings for one past session
async function getSessionDetail(req, res, next) {
  try {
    const session = await Session.findOne({ _id: req.params.id, status: 'ended' });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(shapeSession(session));
  } catch (err) { next(err); }
}

// POST /api/vote/initiate
async function initiateVote(req, res, next) {
  try {
    const { performerId, quantity, email } = req.body;
    if (!performerId || !quantity || quantity < 1 || !email) {
      return res.status(400).json({ error: 'performerId, quantity, and email are required' });
    }

    const activeSession = await Session.findOne({ status: 'active' });
    if (!activeSession || activeSession.isPaused) {
      return res.status(403).json({ error: 'Voting is currently paused' });
    }

    const inSession = activeSession.performers.some((p) => p.performerId.toString() === performerId);
    if (!inSession) return res.status(404).json({ error: 'Performer is not part of the current session' });

    const settings = await Settings.getSingleton();
    const amount = settings.votePrice * quantity;
    const reference = `okizz_vote_${crypto.randomBytes(8).toString('hex')}`;

    await Payment.create({
      reference,
      type: 'vote',
      amount,
      payerEmail: email,
      voteData: { voterEmail: email, sessionId: activeSession._id, allocations: [{ performerId, quantity }] }
    });

    const tx = await initializeTransaction({
      email,
      amountKobo: amount,
      reference,
      callbackUrl: `${process.env.FRONTEND_URL}/callback.html`
    });

    res.json({ authorizationUrl: tx.authorization_url, reference });
  } catch (err) { next(err); }
}

module.exports = { getStatBoard, initiateVote, listEndedSessions, getSessionDetail };