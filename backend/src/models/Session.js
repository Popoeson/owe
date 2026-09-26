const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  status: { type: String, enum: ['active', 'ended'], default: 'active' },
  isPaused: { type: Boolean, default: false },
  performers: [{
    performerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Performer', required: true },
    stageName: String, // snapshotted at session creation, so history reads correctly even if a performer's name changes later
    photoUrl: String,
    voteCount: { type: Number, default: 0 }
  }],
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);