const mongoose = require('mongoose');

const inventoryHistorySchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  date: { type: Date, default: Date.now },
  openingQty: { type: Number, required: true },
  addedQty: { type: Number, default: 0 },
  soldQty: { type: Number, default: 0 },
  closingQty: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('InventoryHistory', inventoryHistorySchema);
