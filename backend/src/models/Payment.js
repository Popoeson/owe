const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true },
  type: { type: String, enum: ['registration', 'vote', 'ticket'], required: true },
  amount: { type: Number, required: true }, // kobo
  status: { type: String, enum: ['initiated', 'confirmed', 'failed'], default: 'initiated' },
  relatedId: { type: mongoose.Schema.Types.ObjectId, default: null }, // set once the related record exists
  payerEmail: { type: String, required: true },
  payerName: { type: String },
  // Holds the submitted registration form fields until the webhook confirms
  // and a real Performer record is created from them. Only used for type: 'registration'.
  registrationData: {
    fullName: String,
    stageName: String,
    bio: String,
    photoUrl: String
  },
  confirmedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);