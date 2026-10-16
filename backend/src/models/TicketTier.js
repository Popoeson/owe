const mongoose = require('mongoose');

const ticketTierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },        // Regular, VIP, Silver, Gold, Platinum
    category: { type: String, required: true, trim: true },    // admin-defined label
        description: { type: String, default: '', trim: true },    // info about the ticket
    imageUrl: { type: String, default: '', trim: true },       // Cloudinary URL of the ticket image
    price: { type: Number, required: true, min: 1 },           // in kobo
    isActive: { type: Boolean, default: true },                // false = hidden from public ("deleted")
  },
  { timestamps: true }
);

module.exports = mongoose.model('TicketTier', ticketTierSchema);