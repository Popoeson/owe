const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  paymentRef: { type: String, required: true, unique: true },
  voterEmail: { type: String, required: true },
  allocations: [{
    performerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Performer', required: true },
    quantity: { type: Number, required: true, min: 1 }
  }],
  totalAmount: { type: Number, required: true } // kobo, matches Payment.amount
}, { timestamps: true });

module.exports = mongoose.model('Vote', voteSchema);