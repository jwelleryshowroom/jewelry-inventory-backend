const express = require("express");
const router = express.Router();
const Product = require("../models/Product");

// Helper to generate SKU like "NE01"
async function generateSKU(name) {
  const initials = (name || '').slice(0, 2).toUpperCase();
  const count = await Product.countDocuments({ name: new RegExp(`^${name}`, "i") });
  const number = (count + 1).toString().padStart(2, "0");
  return initials + number;
}

// ✅ Add Product
router.post("/add", async (req, res) => {
  try {
    let {
      name,
      quantity = 0,
      unitWeightGr = 0,
      lowQuantity = 0,
      addQty = 0,
      sellQty = 0,
    } = req.body;

    name = String(name || '').toUpperCase();
    quantity = Number(quantity) || 0;
    unitWeightGr = Number(unitWeightGr) || 0;
    lowQuantity = Number(lowQuantity) || 0;
    addQty = Number(addQty) || 0;
    sellQty = Number(sellQty) || 0;

    const sku = await generateSKU(name);

    const openingQty = quantity;
    const addedQty = addQty > 0 ? addQty : 0;
    const soldQty = sellQty > 0 ? sellQty : 0;
    const closingQty = openingQty + addedQty - soldQty;
    const totalWeightGr = unitWeightGr * closingQty;

    const product = new Product({
      sku,
      name,
      quantity: closingQty,
      unitWeightGr,
      totalWeightGr,
      lowQuantity,
      openingQty,
      addedQty,
      soldQty,
      closingQty,
      date: new Date()
    });

    await product.save();
    res.status(201).json({ message: "Product added successfully", product });
  } catch (err) {
    console.error("[ADD ERROR]", err);
    res.status(400).json({ error: err.message });
  }
});

// ✅ Update Product (Add or Sell stock)
router.put("/update/:id", async (req, res) => {
  try {
    console.log("[UPDATE REQUEST]", req.params.id, req.body);

    const {
      addQty = 0,
      sellQty = 0,
      unitWeightGr,
      lowQuantity,
      name
    } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) {
      console.warn("[UPDATE] Product not found:", req.params.id);
      return res.status(404).json({ error: "Product not found" });
    }

    // ✅ Optional: update name only if sent
    if (name && typeof name === "string") {
      product.name = name.toUpperCase();
    }

    // ✅ Optional: update unit weight & low qty if provided
    if (unitWeightGr !== undefined && unitWeightGr !== null && unitWeightGr !== "") {
      product.unitWeightGr = Number(unitWeightGr) || 0;
    }
    if (lowQuantity !== undefined && lowQuantity !== null && lowQuantity !== "") {
      product.lowQuantity = Number(lowQuantity) || 0;
    }

    // ✅ Safe numeric conversions, ignore negatives
    const add = Number(addQty) > 0 ? Number(addQty) : 0;
    const sell = Number(sellQty) > 0 ? Number(sellQty) : 0;

    // ✅ Initialize openingQty if missing
    if (!product.openingQty || product.openingQty <= 0) {
      product.openingQty = Number(product.quantity || 0);
    }

    // ✅ Increment cumulative totals
    product.addedQty = (Number(product.addedQty) || 0) + add;
    product.soldQty = (Number(product.soldQty) || 0) + sell;

    // ✅ Recalculate closingQty, quantity, and total weight
    const opening = Number(product.openingQty) || 0;
    const closing = opening + product.addedQty - product.soldQty;

    product.closingQty = closing;
    product.quantity = closing;
    product.totalWeightGr = (Number(product.unitWeightGr) || 0) * closing;

    await product.save();

    console.log("[UPDATE SUCCESS]", {
      id: product._id,
      opening,
      addedQty: product.addedQty,
      soldQty: product.soldQty,
      closingQty: product.closingQty,
      quantity: product.quantity,
      totalWeightGr: product.totalWeightGr
    });

    res.json({ message: "Product updated successfully", product });
  } catch (err) {
    console.error("[UPDATE ERROR]", err);
    res.status(400).json({ error: err.message });
  }
});

// ✅ Delete Product
router.delete("/delete/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ Get all Products
router.get("/", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
