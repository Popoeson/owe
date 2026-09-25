const mongoose = require('mongoose');

const performerSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  stageName: { type: String, required: true },
  bio: { type: String, required: true },
  photoUrl: { type: String, required: true },
  videoUrl: { type: String, default: null },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  isActive: { type: Boolean, default: true },
  registrationPaymentRef: { type: String, default: null },
  source: { type: String, enum: ['paid', 'admin-added'], default: 'paid' },
  voteCount: { type: Number, default: 0 },
  rejectionReason: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Performer', performerSchema);