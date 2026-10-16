const crypto = require('crypto');
const mongoose = require('mongoose');
const TicketTier = require('../models/TicketTier');
const Ticket = require('../models/Ticket');
const Payment = require('../models/Payment');
const { initializeTransaction } = require('../services/paystackService');

const MAX_PER_ORDER = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publicTier = (t) => ({
  id: t._id,
  name: t.name,
  category: t.category,
  description: t.description,
  priceNaira: t.price / 100,
  imageUrl: t.imageUrl || '',
});

// GET /api/tickets/tiers
exports.listTiers = async (req, res) => {
  try {
    const tiers = await TicketTier.find({ isActive: true }).sort({ price: 1 });
    res.json({ tiers: tiers.map(publicTier) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load tickets.' });
  }
};

// POST /api/tickets/initiate   { tierId, quantity, buyerName, buyerEmail }
exports.initiatePurchase = async (req, res) => {
  try {
    const { tierId, quantity, buyerName, buyerEmail } = req.body;
    const qty = Number(quantity);

    if (!mongoose.isValidObjectId(tierId)) {
      return res.status(400).json({ message: 'Invalid ticket type.' });
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_PER_ORDER) {
      return res.status(400).json({ message: `Quantity must be 1 to ${MAX_PER_ORDER}.` });
    }
    if (!buyerName || !buyerName.trim()) {
      return res.status(400).json({ message: 'Name is required.' });
    }
    if (!buyerEmail || !EMAIL_RE.test(buyerEmail)) {
      return res.status(400).json({ message: 'A valid email is required.' });
    }

    const tier = await TicketTier.findOne({ _id: tierId, isActive: true });
    if (!tier) return res.status(404).json({ message: 'This ticket is no longer available.' });

    const amount = tier.price * qty; // kobo; price snapshot taken now (BR-03)
    const reference = `okizz_tkt_${crypto.randomBytes(8).toString('hex')}`;

    const payment = await Payment.create({
      reference,
      type: 'ticket',
      amount,
      status: 'initiated',
      payerEmail: buyerEmail.trim().toLowerCase(),
      payerName: buyerName.trim(),
      ticketData: {
        tierId: tier._id,
        quantity: qty,
        unitPrice: tier.price,
        buyerName: buyerName.trim(),
        buyerEmail: buyerEmail.trim().toLowerCase(),
      },
    });

    const tx = await initializeTransaction({
      email: payment.payerEmail,
      amountKobo: amount,
      reference,
      callbackUrl: `${process.env.FRONTEND_URL}/callback.html`
    });

    res.json({ authorizationUrl: tx.authorization_url, reference });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

// GET /api/tickets/by-reference/:reference
// Used by the confirmation page, and to re-download a lost ticket later.
exports.getByReference = async (req, res) => {
  try {
    const payment = await Payment.findOne({ reference: req.params.reference, type: 'ticket' });
    if (!payment) return res.status(404).json({ message: 'Order not found.' });

    if (payment.status !== 'confirmed') {
      return res.status(202).json({ status: payment.status, tickets: [] });
    }

    const tickets = await Ticket.find({ paymentRef: payment.reference })
      .sort({ seq: 1 })
      .populate('tierId', 'name category imageUrl');

    if (tickets.length === 0) return res.status(202).json({ status: 'issuing', tickets: [] });

    res.json({
      status: 'confirmed',
      tickets: tickets.map((t) => ({
        qrCode: t.qrCode,
        seq: t.seq,
        buyerName: t.buyerName,
        tierName: t.tierId?.name,
        category: t.tierId?.category,
        imageUrl: t.tierId?.imageUrl || '',
        status: t.status,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load your tickets.' });
  }
};