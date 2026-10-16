const mongoose = require('mongoose');

const ticketTierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },        // Regular, VIP, Silver, Gold, Platinum
    category: { type: String, required: true, trim: true },    // admin-defined label
        description: { type: String, default: '', trim: true },    // info about the ticket
        imageUrl: { type: String, default: '', trim: true },       // Cloudinary URL of the ticket image
    // Where the QR is drawn on the ticket image (fractions: centre x/y of height/width, size = share of width)
    qrX: { type: Number, default: 0.848, min: 0, max: 1 },
    qrY: { type: Number, default: 0.605, min: 0, max: 1 },
    qrSize: { type: Number, default: 0.127, min: 0.05, max: 0.5 },
    price: { type: Number, required: true, min: 1 },           // in kobo
    isActive: { type: Boolean, default: true },                // false = hidden from public ("deleted")
  },
  { timestamps: true }
);

module.exports = mongoose.model('TicketTier', ticketTierSchema);