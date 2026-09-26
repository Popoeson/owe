const Performer = require('../models/Performer');
const Payment = require('../models/Payment');
const Settings = require('../models/Settings');
const Vote = require('../models/Vote');

const activeSession = await Session.findOne({ status: 'active' });

async function getStats(req, res, next) {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [pendingCount, approvedCount, registrationAgg, votingAgg, settings, totalVotesAgg, votesTodayAgg] = await Promise.all([
      Performer.countDocuments({ status: 'pending' }),
      Performer.countDocuments({ status: 'approved', isActive: true }),
      Payment.aggregate([
        { $match: { type: 'registration', status: 'confirmed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Payment.aggregate([
        { $match: { type: 'vote', status: 'confirmed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Settings.getSingleton(),
      Vote.aggregate([
        { $unwind: '$allocations' },
        { $group: { _id: null, total: { $sum: '$allocations.quantity' } } }
      ]),
      Vote.aggregate([
        { $match: { createdAt: { $gte: startOfToday } } },
        { $unwind: '$allocations' },
        { $group: { _id: null, total: { $sum: '$allocations.quantity' } } }
      ])
    ]);

    const registrationRevenue = registrationAgg[0]?.total || 0;
    const votingRevenue = votingAgg[0]?.total || 0;
    const totalVotesCast = totalVotesAgg[0]?.total || 0;
    const votesToday = votesTodayAgg[0]?.total || 0;

    // Tickets phase not built yet.
    const ticketRevenue = 0;
    const ticketsSold = 0;

    res.json({
      pendingPerformers: pendingCount,
      approvedPerformers: approvedCount,
      revenue: {
        total: registrationRevenue + votingRevenue + ticketRevenue,
        registration: registrationRevenue,
        voting: votingRevenue,
        tickets: ticketRevenue
      },

      voting: {
        isOpen: !!activeSession && !activeSession.isPaused,
        pricePerVote: settings.votePrice,
        totalVotesCast,
        votesToday
      },
      tickets: { sold: ticketsSold, revenue: ticketRevenue }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getStats };