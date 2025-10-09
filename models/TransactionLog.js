// models/TransactionLog.js
const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    date: { type: Date, default: Date.now }, // stored in UTC, compared in IST
    openingQty: { type: Number, required: true },
    addedQty: { type: Number, default: 0 },
    soldQty: { type: Number, default: 0 },
    closingQty: { type: Number, required: true },
    remarks: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TransactionLog", transactionSchema);
