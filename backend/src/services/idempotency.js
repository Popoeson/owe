const Payment = require('../models/Payment');
const Performer = require('../models/Performer');
const Vote = require('../models/Vote');
const Session = require('../models/Session');


/**
 * Confirms a payment exactly once, no matter how many times or from how many
 * paths (webhook, manual verify) this gets called for the same reference.
 * BR-05 / BR-06: relies on Mongo's atomic findOneAndUpdate as the race guard —
 * only the call that actually flips status: initiated -> confirmed does the
 * side-effect work; every other call (already-confirmed) is a safe no-op.
 */
async function confirmPayment(reference) {
  const payment = await Payment.findOneAndUpdate(
    { reference, status: 'initiated' },
    { status: 'confirmed', confirmedAt: new Date() },
    { new: true }
  );

  if (!payment) {
    // Either already confirmed by the other path, or reference doesn't exist.
    const existing = await Payment.findOne({ reference });
    return { alreadyHandled: true, payment: existing || null };
  }

  if (payment.type === 'registration') {
    const performer = await Performer.create({
      ...payment.registrationData,
      status: 'pending',
      source: 'paid',
      registrationPaymentRef: payment.reference
    });
    payment.relatedId = performer._id;
    await payment.save();
  }

// ...replacing the existing vote branch:
  if (payment.type === 'vote') {
    const { sessionId, allocations, voterEmail } = payment.voteData;

    const vote = await Vote.create({
      paymentRef: payment.reference,
      sessionId,
      voterEmail,
      allocations,
      totalAmount: payment.amount
    });

    await Promise.all(allocations.map((a) =>
      Promise.all([
        // Session-scoped count — this is what ranking/standings actually reads.
        Session.updateOne(
          { _id: sessionId, 'performers.performerId': a.performerId },
          { $inc: { 'performers.$.voteCount': a.quantity } }
        ),
        // All-time counter on Performer — kept for historical/legacy purposes, not used for ranking.
        Performer.findByIdAndUpdate(a.performerId, { $inc: { voteCount: a.quantity } })
      ])
    ));

    payment.relatedId = vote._id;
    await payment.save();
  }
  

module.exports = { confirmPayment };