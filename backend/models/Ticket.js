const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  tierId: { type: mongoose.Schema.Types.ObjectId, ref: 'TicketTier', required: true },
  paymentRef: { type: String, required: true, index: true },
  seq: { type: Number, required: true },                       // 1..N within one purchase
  buyerName: { type: String, required: true },
  buyerEmail: { type: String, required: true },
  qrCode: { type: String, required: true, unique: true },
  pricePaid: { type: Number, required: true },                 // kobo, snapshot at purchase
  status: { type: String, enum: ['issued', 'used'], default: 'issued' },
  issuedAt: { type: Date, default: Date.now },
  usedAt: { type: Date, default: null },
});

// Makes double-issuing for one payment impossible at the database level
ticketSchema.index({ paymentRef: 1, seq: 1 }, { unique: true });

module.exports = mongoose.model('Ticket', ticketSchema);