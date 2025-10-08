const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const XLSX = require("xlsx");

// ✅ Helper to generate SKU
// ✅ Improved Helper to generate SKU (prevents duplicate error)
// ✅ Robust Helper to generate SKU (always unique)
async function generateSKU(name) {
  const initials = name.slice(0, 2).toUpperCase();

  // Find the highest SKU with the same prefix
  const lastProduct = await Product.findOne({ sku: new RegExp(`^${initials}`, "i") })
    .sort({ sku: -1 });

  let nextNumber = 1;
  if (lastProduct && lastProduct.sku) {
    const existingNumber = parseInt(lastProduct.sku.slice(2)) || 0;
    nextNumber = existingNumber + 1;
  }

  return `${initials}${nextNumber.toString().padStart(2, "0")}`;
}



// ✅ Add Product
router.post("/add", async (req, res) => {
  try {
    const { name, quantity, unitWeightGr, lowQuantity } = req.body;
    const sku = await generateSKU(name);
    const totalWeightGr = Number(quantity) * Number(unitWeightGr);

    const product = new Product({
      name: name.toUpperCase(),
      sku,
      quantity: Number(quantity),
      unitWeightGr: Number(unitWeightGr),
      totalWeightGr,
      lowQuantity: Number(lowQuantity) || 0,
      openingQty: Number(quantity),
      addedQty: 0,
      soldQty: 0,
      closingQty: Number(quantity),
      isActive: true,
      date: new Date(),
    });

    await product.save();
    res.status(201).json({ message: "Product added successfully", product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ Update Product (Add/Sell logic)
router.put("/update/:id", async (req, res) => {
  try {
    const { addQty = 0, sellQty = 0 } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    const openingQty = product.openingQty || product.quantity;
    const newAdded = (Number(product.addedQty) || 0) + Number(addQty);
    const newSold = (Number(product.soldQty) || 0) + Number(sellQty);
    const closingQty = openingQty + newAdded - newSold;

    product.addedQty = newAdded;
    product.soldQty = newSold;
    product.closingQty = closingQty;
    product.quantity = closingQty;
    product.totalWeightGr = closingQty * product.unitWeightGr;
    await product.save();

    res.json({ message: "Product updated successfully", product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ Soft Delete Product (Archive it)
router.put("/soft-delete/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    product.isActive = false;
    await product.save();

    res.json({ message: "Product archived successfully", product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ Restore Archived Product
router.put("/restore/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    product.isActive = true;
    await product.save();

    res.json({ message: "Product restored successfully", product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ Hard Delete (permanent removal)
router.delete("/delete/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    res.json({ message: "Product permanently deleted" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ Get all active products
router.get("/", async (req, res) => {
  try {
    const products = await Product.find({ isActive: true });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get all archived products
router.get("/archived", async (req, res) => {
  try {
    const archived = await Product.find({ isActive: false });
    res.json(archived);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get ALL products (active + archived)
router.get("/all", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Export products as Excel (with optional date range)
router.get("/export", async (req, res) => {
  try {
    const { start, end } = req.query;
    let filter = {};

    if (start && end) {
      filter.date = {
        $gte: new Date(start),
        $lte: new Date(new Date(end).setHours(23, 59, 59, 999)),
      };
    }

    const products = await Product.find(filter).sort({ date: 1 });
    if (!products.length) {
      return res.status(404).json({ error: "No products found in this range." });
    }

    const data = products.map((p) => ({
      SKU: p.sku,
      Name: p.name,
      Opening: p.openingQty,
      Added: p.addedQty,
      Sold: p.soldQty,
      Closing: p.closingQty,
      Archived: p.isActive ? "No" : "Yes",
      Date: new Date(p.date).toLocaleDateString(),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory Data");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=inventory_export_${Date.now()}.xlsx`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to export data" });
  }
});

module.exports = router;
