const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true },
  type: { type: String, enum: ['registration', 'vote', 'ticket'], required: true },
  amount: { type: Number, required: true }, // kobo
  status: { type: String, enum: ['initiated', 'confirmed', 'failed'], default: 'initiated' },
  relatedId: { type: mongoose.Schema.Types.ObjectId, default: null },
  payerEmail: { type: String, required: true },
  payerName: { type: String },
  registrationData: {
    fullName: String,
    stageName: String,
    bio: String,
    photoUrl: String,
    whatsappNumber: String
  },
  // Same idea as registrationData, but for type: 'vote'.
  voteData: {
    voterEmail: String,
    allocations: [{
      performerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Performer' },
      quantity: Number
    }]
  },
  confirmedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);