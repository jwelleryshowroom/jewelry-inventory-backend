const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  sku: { type: String, unique: true }, // auto-generated SKU
  name: { type: String, required: true },

  // final/closing quantity (what inventory shows)
  quantity: { type: Number, default: 0 },

  // per-unit weight (grams)
  unitWeightGr: { type: Number, default: 0 },

  // auto-derived: total weight in grams = unitWeightGr * quantity
  totalWeightGr: { type: Number, default: 0 },

  // low stock alert
  lowQuantity: { type: Number, default: 0 },

  // Tracking (lifetime since opening)
  openingQty: { type: Number, default: 0 },
  addedQty: { type: Number, default: 0 },
  soldQty: { type: Number, default: 0 },
  closingQty: { type: Number, default: 0 },

  // we’ll also use createdAt/updatedAt for calendar filtering
  date: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
