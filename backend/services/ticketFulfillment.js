const Ticket = require('../models/Ticket');
const { generateTicketCode } = require('../utils/ticketCode');

// Call from the webhook / manual-verify path AFTER the payment is marked confirmed.
// Safe to call twice: the unique (paymentRef, seq) index stops duplicates.
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