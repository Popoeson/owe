const crypto = require('crypto');
const Payment = require('../models/Payment');
const Performer = require('../models/Performer');
const Settings = require('../models/Settings');
const { initializeTransaction } = require('../services/paystackService');

// GET /api/stat-board — public, approved+active performers ranked by votes
async function getStatBoard(req, res, next) {
  try {
    const settings = await Settings.getSingleton();
    const performers = await Performer.find({ status: 'approved', isActive: true })
      .sort({ voteCount: -1 })
      .select('stageName photoUrl voteCount');

    res.json({
      votingOpen: settings.votingOpen,
      pricePerVote: settings.votePrice,
      totalVotes: performers.reduce((sum, p) => sum + p.voteCount, 0),
      performers: performers.map((p, i) => ({
        id: p._id,
        rank: i + 1,
        stageName: p.stageName,
        photoUrl: p.photoUrl,
        voteCount: p.voteCount
        // Rank movement ("+5", "-1") isn't included yet — see note below.
      }))
    });
  } catch (err) { next(err); }
}

// POST /api/vote/initiate
async function initiateVote(req, res, next) {
  try {
    const { performerId, quantity, email } = req.body;
    if (!performerId || !quantity || quantity < 1 || !email) {
      return res.status(400).json({ error: 'performerId, quantity, and email are required' });
    }

    const settings = await Settings.getSingleton();
    if (!settings.votingOpen) {
      return res.status(403).json({ error: 'Voting is currently closed' }); // BR-12
    }

    const performer = await Performer.findOne({ _id: performerId, status: 'approved', isActive: true });
    if (!performer) return res.status(404).json({ error: 'Performer not found or not approved' });

    const amount = settings.votePrice * quantity;
    const reference = `okizz_vote_${crypto.randomBytes(8).toString('hex')}`;

    const payment = await Payment.create({
      reference,
      type: 'vote',
      amount,
      payerEmail: email,
      voteData: { voterEmail: email, allocations: [{ performerId, quantity }] }
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

module.exports = { getStatBoard, initiateVote };