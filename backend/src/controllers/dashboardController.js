const Performer = require('../models/Performer');
const Payment = require('../models/Payment');

async function getStats(req, res, next) {
  try {
    const [pendingCount, approvedCount, revenueAgg] = await Promise.all([
      Performer.countDocuments({ status: 'pending' }),
      Performer.countDocuments({ status: 'approved' }),
      Payment.aggregate([
        { $match: { type: 'registration', status: 'confirmed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    res.json({
      pendingPerformers: pendingCount,
      approvedPerformers: approvedCount,
      registrationRevenue: (revenueAgg[0]?.total || 0) / 100 // kobo -> naira
    });
  } catch (err) { next(err); }
}

module.exports = { getStats };