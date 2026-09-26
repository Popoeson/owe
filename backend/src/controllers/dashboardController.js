const Performer = require('../models/Performer');
const Payment = require('../models/Payment');
const Settings = require('../models/Settings');

async function getStats(req, res, next) {
  try {
    const [pendingCount, approvedCount, registrationAgg, settings] = await Promise.all([
      Performer.countDocuments({ status: 'pending' }),
      Performer.countDocuments({ status: 'approved', isActive: true }),
      Payment.aggregate([
        { $match: { type: 'registration', status: 'confirmed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Settings.getSingleton()
    ]);

    const registrationRevenue = registrationAgg[0]?.total || 0;

    // Voting and Tickets aren't built yet — no Vote/Ticket collections exist,
    // so these stay hardcoded at 0 rather than querying something that isn't there.
    const votingRevenue = 0;
    const totalVotesCast = 0;
    const votesToday = 0;
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
        isOpen: settings.votingOpen,
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