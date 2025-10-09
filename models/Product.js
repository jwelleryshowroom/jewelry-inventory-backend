// models/Product.js
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    sku: { type: String, index: true },
    name: { type: String, required: true },
    quantity: { type: Number, default: 0 }, // current stock
    lowQuantity: { type: Number, default: 0 },

    // Stock tracking fields
    openingQty: { type: Number, default: 0 },
    addedQty: { type: Number, default: 0 },
    soldQty: { type: Number, default: 0 },
    closingQty: { type: Number, default: 0 },

    date: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true }, // soft delete flag
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
