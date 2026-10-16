const mongoose = require('mongoose');
const TicketTier = require('../models/TicketTier');
const Ticket = require('../models/Ticket');

const toKobo = (naira) => Math.round(Number(naira) * 100);
const adminTier = (t) => ({
  id: t._id,
  name: t.name,
  category: t.category,
  description: t.description,
  priceNaira: t.price / 100,
  isActive: t.isActive,
});

// GET /api/admin/tickets/tiers  (includes hidden tiers)
exports.listTiers = async (req, res) => {
  try {
    const tiers = await TicketTier.find().sort({ createdAt: 1 });
    res.json({ tiers: tiers.map(adminTier) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load tickets.' });
  }
};

// POST /api/admin/tickets/tiers   { name, category, description, priceNaira }
exports.createTier = async (req, res) => {
  try {
    const { name, category, description, priceNaira } = req.body;
    if (!name?.trim() || !category?.trim()) {
      return res.status(400).json({ message: 'Name and category are required.' });
    }
    if (!(Number(priceNaira) > 0)) {
      return res.status(400).json({ message: 'Enter a price greater than 0.' });
    }
    const tier = await TicketTier.create({
      name, category, description, price: toKobo(priceNaira),
    });
    res.status(201).json({ tier: adminTier(tier) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not create ticket.' });
  }
};

// PUT /api/admin/tickets/tiers/:id   (any subset of fields, incl. isActive to restore)
// Price edits only affect future purchases; issued tickets keep pricePaid.
exports.updateTier = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid id.' });
    const { name, category, description, priceNaira, isActive } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (category !== undefined) update.category = category;
    if (description !== undefined) update.description = description;
    if (isActive !== undefined) update.isActive = !!isActive;
    if (priceNaira !== undefined) {
      if (!(Number(priceNaira) > 0)) return res.status(400).json({ message: 'Enter a price greater than 0.' });
      update.price = toKobo(priceNaira);
    }
    const tier = await TicketTier.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!tier) return res.status(404).json({ message: 'Ticket not found.' });
    res.json({ tier: adminTier(tier) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not update ticket.' });
  }
};

// DELETE /api/admin/tickets/tiers/:id  -> hides the tier, keeps the record
exports.hideTier = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid id.' });
    const tier = await TicketTier.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!tier) return res.status(404).json({ message: 'Ticket not found.' });
    res.json({ tier: adminTier(tier) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not hide ticket.' });
  }
};

// POST /api/admin/tickets/scan   { code }
// Atomic: two scanners hitting the same code can never both get "valid".
exports.scan = async (req, res) => {
  try {
    const code = String(req.body.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ result: 'invalid', message: 'No code scanned.' });

    const ticket = await Ticket.findOneAndUpdate(
      { qrCode: code, status: 'issued' },
      { status: 'used', usedAt: new Date() },
      { new: true }
    ).populate('tierId', 'name category');

    if (ticket) {
      return res.json({
        result: 'valid',
        message: 'Valid ticket. Admit.',
        ticket: { tierName: ticket.tierId?.name, category: ticket.tierId?.category, buyerName: ticket.buyerName, seq: ticket.seq },
      });
    }

    const existing = await Ticket.findOne({ qrCode: code });
    if (existing) {
      return res.status(409).json({ result: 'used', message: 'Already used.', usedAt: existing.usedAt });
    }
    res.status(404).json({ result: 'invalid', message: 'Invalid ticket.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ result: 'error', message: 'Scan failed. Try again.' });
  }
};