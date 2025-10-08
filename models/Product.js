const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    sku: { type: String, index: true }, // no "unique",
    name: { type: String, required: true },
    quantity: { type: Number, default: 0 }, // current/closing quantity
    unitWeightGr: { type: Number, default: 0 },
    totalWeightGr: { type: Number, default: 0 },
    lowQuantity: { type: Number, default: 0 },

    // Tracking fields
    openingQty: { type: Number, default: 0 },
    addedQty: { type: Number, default: 0 },
    soldQty: { type: Number, default: 0 },
    closingQty: { type: Number, default: 0 },

    date: { type: Date, default: Date.now }, // local date
    isActive: { type: Boolean, default: true }, // NEW: for soft delete
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
