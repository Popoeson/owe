const Ticket = require('../models/Ticket');
const { generateTicketCode } = require('../utils/ticketCode');

/**
 * Called after a payment is confirmed (webhook / manual verify), and by the
 * order lookup as a self-heal. Safe to call any number of times: the unique
 * (paymentRef, seq) index and the count check stop duplicates.
 * Tickets are numbered 1..N across the whole order.
 */
exports.issueTicketsForPayment = async (payment) => {
  const { items, buyerName, buyerEmail } = payment.ticketData;
  const total = items.reduce((sum, i) => sum + i.quantity, 0);

  const existing = await Ticket.countDocuments({ paymentRef: payment.reference });
  if (existing >= total) return;

  const docs = [];
  let seq = 0;
  for (const item of items) {
    for (let i = 0; i < item.quantity; i++) {
      seq += 1;
      docs.push({
        tierId: item.tierId,
        paymentRef: payment.reference,
        seq,
        buyerName,
        buyerEmail,
        qrCode: generateTicketCode(),
        pricePaid: item.unitPrice,
      });
    }
  }

  try {
    await Ticket.insertMany(docs, { ordered: false });
  } catch (err) {
    // 11000 = duplicate key: those tickets already exist (another path issued them)
    const onlyDupes = err.code === 11000 ||
      (err.writeErrors && err.writeErrors.every((e) => e.code === 11000));
    if (!onlyDupes) throw err;
  }
};