const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  registrationFee: { type: Number, default: 500000 }, // kobo = ₦5,000
  votePrice: { type: Number, default: 10000 },         // kobo = ₦100
  votingOpen: { type: Boolean, default: false }
});

// Singleton accessor — creates the one settings doc on first use.
settingsSchema.statics.getSingleton = async function () {
  let settings = await this.findOne();
  if (!settings) settings = await this.create({});
  return settings;
};

module.exports = mongoose.model('Settings', settingsSchema);