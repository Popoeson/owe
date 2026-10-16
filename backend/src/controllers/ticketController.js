const crypto = require('crypto');
const mongoose = require('mongoose');
const TicketTier = require('../models/TicketTier');
const Ticket = require('../models/Ticket');
const Payment = require('../models/Payment');
const { initializeTransaction } = require('../services/paystackService');
const { issueTicketsForPayment } = require('../services/ticketFulfillment');

const MAX_PER_TIER = 10;
const MAX_TICKETS_PER_ORDER = 20;
const MAX_TIERS_PER_ORDER = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

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

// POST /api/tickets/initiate
// { items: [{ tierId, quantity }, ...], buyerName, buyerEmail }
// The client never sends a price or total. Everything is recomputed here.
exports.initiatePurchase = async (req, res) => {
  try {
    const { items, buyerName, buyerEmail } = req.body;

    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_TIERS_PER_ORDER) {
      return res.status(400).json({ message: 'Choose at least one ticket.' });
    }

    // Validate and merge duplicate tiers
    const wanted = new Map(); // tierId -> quantity
    for (const it of items) {
      const id = it && String(it.tierId);
      const qty = Number(it && it.quantity);
      if (!OBJECT_ID_RE.test(id || '')) {
        return res.status(400).json({ message: 'Invalid ticket type.' });
      }
      if (!Number.isInteger(qty) || qty < 1) {
        return res.status(400).json({ message: 'Invalid quantity.' });
      }
      wanted.set(id, (wanted.get(id) || 0) + qty);
    }

    let totalTickets = 0;
    for (const qty of wanted.values()) {
      if (qty > MAX_PER_TIER) {
        return res.status(400).json({ message: `You can buy up to ${MAX_PER_TIER} of each ticket type.` });
      }
      totalTickets += qty;
    }
    if (totalTickets > MAX_TICKETS_PER_ORDER) {
      return res.status(400).json({ message: `You can buy up to ${MAX_TICKETS_PER_ORDER} tickets per order.` });
    }

    if (!buyerName || !buyerName.trim() || buyerName.trim().length > 100) {
      return res.status(400).json({ message: 'Name is required.' });
    }
    if (!buyerEmail || !EMAIL_RE.test(buyerEmail)) {
      return res.status(400).json({ message: 'A valid email is required.' });
    }

    // Prices come from the database only
    const tiers = await TicketTier.find({ _id: { $in: [...wanted.keys()] }, isActive: true }).sort({ price: 1 });
    if (tiers.length !== wanted.size) {
      return res.status(409).json({
        message: 'One or more selected tickets are no longer available. Please refresh and try again.'
      });
    }

    let amount = 0; // kobo
    const orderItems = tiers.map((tier) => {
      const quantity = wanted.get(String(tier._id));
      amount += tier.price * quantity;
      return { tierId: tier._id, quantity, unitPrice: tier.price }; // price snapshot (BR-03)
    });

    const email = buyerEmail.trim().toLowerCase();
    const name = buyerName.trim();
    const reference = `okizz_tkt_${crypto.randomBytes(8).toString('hex')}`;

    const payment = await Payment.create({
      reference,
      type: 'ticket',
      amount,
      status: 'initiated',
      payerEmail: email,
      payerName: name,
      ticketData: { items: orderItems, buyerName: name, buyerEmail: email },
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
// Returns tickets only once the backend has confirmed the payment.
exports.getByReference = async (req, res) => {
  try {
    const payment = await Payment.findOne({ reference: req.params.reference, type: 'ticket' });
    if (!payment) return res.status(404).json({ message: 'Order not found.' });

    if (payment.status !== 'confirmed') {
      return res.status(202).json({ status: payment.status, tickets: [] });
    }

    const expected = payment.ticketData.items.reduce((sum, i) => sum + i.quantity, 0);
    const load = () => Ticket.find({ paymentRef: payment.reference })
      .sort({ seq: 1 })
      .populate('tierId', 'name category imageUrl qrX qrY qrSize');

    let tickets = await load();

    // Self-heal: confirmed but tickets missing (e.g. a crash mid-issue). Safe to repeat.
    if (tickets.length < expected) {
      await issueTicketsForPayment(payment);
      tickets = await load();
    }
    if (tickets.length < expected) {
      return res.status(202).json({ status: 'issuing', tickets: [] });
    }

    res.json({
      status: 'confirmed',
      buyerName: payment.ticketData.buyerName,
      amountNaira: payment.amount / 100,
      tickets: tickets.map((t) => ({
        qrCode: t.qrCode,
        seq: t.seq,
        buyerName: t.buyerName,
        tierName: t.tierId?.name,
        category: t.tierId?.category,
        imageUrl: t.tierId?.imageUrl || '',
        qrX: t.tierId?.qrX,
        qrY: t.tierId?.qrY,
        qrSize: t.tierId?.qrSize,
        status: t.status,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load your tickets.' });
  }
};