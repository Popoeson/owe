const Ticket = require('../models/Ticket');
const { generateTicketCode } = require('../utils/ticketCode');

/**
 * Called from the webhook / manual-verify path AFTER the payment has been
 * marked confirmed. Safe to call twice: the unique (paymentRef, seq) index
 * and the existing-count check stop duplicates.
 */
exports.issueTicketsForPayment = async (payment) => {
  const { tierId, quantity, unitPrice, buyerName, buyerEmail } = payment.ticketData;

  const existing = await Ticket.countDocuments({ paymentRef: payment.reference });
  if (existing >= quantity) return;

  const docs = [];
  for (let seq = 1; seq <= quantity; seq++) {
    docs.push({
      tierId,
      paymentRef: payment.reference,
      seq,
      buyerName,
      buyerEmail,
      qrCode: generateTicketCode(),
      pricePaid: unitPrice,
    });
  }

  try {
    await Ticket.insertMany(docs, { ordered: false });
  } catch (err) {
    // 11000 = duplicate key: another path already issued these tickets
    const onlyDupes = err.code === 11000 ||
      (err.writeErrors && err.writeErrors.every((e) => e.code === 11000));
    if (!onlyDupes) throw err;
  }
};