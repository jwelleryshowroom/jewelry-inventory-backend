const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const TransactionLog = require("../models/TransactionLog");
const XLSX = require("xlsx");
const auth = require("../middleware/auth"); // ✅ Import auth middleware

// ✅ Helper to generate SKU
async function generateSKU(name) {
  const initials = name.slice(0, 2).toUpperCase();
  const lastProduct = await Product.findOne({ sku: new RegExp(`^${initials}`, "i") }).sort({ sku: -1 });
  let nextNumber = 1;
  if (lastProduct && lastProduct.sku) {
    const existingNumber = parseInt(lastProduct.sku.slice(2)) || 0;
    nextNumber = existingNumber + 1;
  }
  return `${initials}${nextNumber.toString().padStart(2, "0")}`;
}

// ✅ Add Product (protected)
router.post("/add", auth(["admin", "staff"]), async (req, res) => {
  try {
    const { name, quantity, lowQuantity } = req.body;
    const sku = await generateSKU(name);

    const product = new Product({
      name: name.toUpperCase(),
      sku,
      quantity: Number(quantity),
      lowQuantity: Number(lowQuantity) || 0,
      openingQty: Number(quantity),
      addedQty: 0,
      soldQty: 0,
      closingQty: Number(quantity),
      isActive: true,
      date: new Date(),
    });

    await product.save();

    // 🧾 Create initial Transaction Log
    await new TransactionLog({
      productId: product._id,
      productName: product.name,
      sku: product.sku,
      openingQty: Number(quantity),
      addedQty: 0,
      soldQty: 0,
      closingQty: Number(quantity),
      remarks: "Initial stock entry",
    }).save();

    res.status(201).json({ message: "Product added successfully", product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ Update Product (with IST-based transaction logging)
router.put("/update/:id", auth(["admin", "staff"]), async (req, res) => {
  try {
    const { addQty = 0, sellQty = 0 } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    // 🕒 Calculate IST-based start and end of today
    const nowIST = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const todayIST = new Date(nowIST);
    const startOfDay = new Date(todayIST.setHours(0, 0, 0, 0));
    const endOfDay = new Date(todayIST.setHours(23, 59, 59, 999));

    // 🧾 Check if a transaction already exists today
    let todayTxn = await TransactionLog.findOne({
      productId: product._id,
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    // 🧭 If new day (no transaction for today)
    if (!todayTxn) {
      const lastTxn = await TransactionLog.findOne({ productId: product._id }).sort({ date: -1 });
      const openingQty = lastTxn ? lastTxn.closingQty : product.quantity;
      const closingQty = openingQty + Number(addQty) - Number(sellQty);

      todayTxn = new TransactionLog({
        productId: product._id,
        productName: product.name,
        sku: product.sku,
        openingQty,
        addedQty: Number(addQty),
        soldQty: Number(sellQty),
        closingQty,
        remarks: "New day transaction",
      });
    } else {
      // 🧮 Merge multiple updates on same day
      todayTxn.addedQty += Number(addQty);
      todayTxn.soldQty += Number(sellQty);
      todayTxn.closingQty = todayTxn.openingQty + todayTxn.addedQty - todayTxn.soldQty;
    }

    await todayTxn.save();

    // 🧾 Update Product current snapshot
    product.openingQty = todayTxn.openingQty;
    product.addedQty = todayTxn.addedQty;
    product.soldQty = todayTxn.soldQty;
    product.closingQty = todayTxn.closingQty;
    product.quantity = todayTxn.closingQty;
    await product.save();

    res.json({ message: "Product updated successfully (transaction logged)", product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ Soft Delete Product (admin only)
router.put("/soft-delete/:id", auth(["admin"]), async (req, res) => {
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

// ✅ Restore Archived Product (admin only)
router.put("/restore/:id", auth(["admin"]), async (req, res) => {
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

// ✅ Hard Delete (admin only)
router.delete("/delete/:id", auth(["admin"]), async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    // Delete transaction logs linked to this product
    await TransactionLog.deleteMany({ productId: req.params.id });

    res.json({ message: "Product permanently deleted" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ Get all active products (public)
router.get("/", async (req, res) => {
  try {
    const products = await Product.find({ isActive: true });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get all archived products (public)
router.get("/archived", async (req, res) => {
  try {
    const archived = await Product.find({ isActive: false });
    res.json(archived);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get ALL products (public)
router.get("/all", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get all transactions by date (used for Calendar tab)
router.get("/transactions/by-date", async (req, res) => {
  try {
    // Fetch all transaction logs sorted by date
    const logs = await TransactionLog.find().sort({ date: 1 });

    // Extract unique product IDs
    const productIds = logs
      .filter((log) => log.productId)
      .map((log) => log.productId.toString());

    // Fetch product info (active + archived)
    const products = await Product.find({ _id: { $in: productIds } }).select(
      "name sku isActive"
    );

    // Create a lookup map for faster merge
    const productMap = {};
    products.forEach((p) => {
      productMap[p._id.toString()] = {
        name: p.name,
        sku: p.sku,
        isActive: p.isActive,
      };
    });

    // Merge product info into each log
    const enrichedLogs = logs.map((log) => {
      const info = productMap[log.productId?.toString()] || {};
      return {
        ...log._doc,
        productName: info.name || log.productName,
        sku: info.sku || log.sku,
        isActive: info.isActive ?? true, // default true
      };
    });

    res.json(enrichedLogs);
  } catch (err) {
    console.error("❌ Failed to fetch transactions:", err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});


// ✅ Get transactions for a specific product
router.get("/transactions/:id", auth(["admin", "staff"]), async (req, res) => {
  try {
    const logs = await TransactionLog.find({ productId: req.params.id }).sort({ date: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Export transactions as Excel (TransactionLog-based) — uses only updatedAt for column + sorting
router.get("/export", auth(["admin", "staff"]), async (req, res) => {
  try {
    const { type, start, end } = req.query;
    let filter = {};
    let rangeLabel = "";
    let startDate, endDate;

    // --- IST-based time setup ---
    const nowIST = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const currentIST = new Date(nowIST);

    switch (type) {
      case "today":
        startDate = new Date(currentIST.setHours(0, 0, 0, 0));
        endDate = new Date(currentIST.setHours(23, 59, 59, 999));
        rangeLabel = "Today";
        break;
      case "yesterday": {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        startDate = new Date(yesterday.setHours(0, 0, 0, 0));
        endDate = new Date(yesterday.setHours(23, 59, 59, 999));
        rangeLabel = "Yesterday";
        break;
      }
      case "this_month":
        startDate = new Date(currentIST.getFullYear(), currentIST.getMonth(), 1);
        endDate = new Date();
        rangeLabel = "This Month";
        break;
      case "last_3_months":
        startDate = new Date(currentIST.getFullYear(), currentIST.getMonth() - 2, 1);
        endDate = new Date();
        rangeLabel = "Last 3 Months";
        break;
      case "this_year":
        startDate = new Date(currentIST.getFullYear(), 0, 1);
        endDate = new Date();
        rangeLabel = "This Year";
        break;
      case "custom":
        if (start && end) {
          const startIST = new Date(
            new Date(start).toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
          );
          const endIST = new Date(
            new Date(end).toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
          );
          startDate = new Date(startIST.setHours(0, 0, 0, 0));
          endDate = new Date(endIST.setHours(23, 59, 59, 999));
          rangeLabel = `${start} → ${end}`;
        }
        break;
      default:
        rangeLabel = "All Data";
    }

    if (startDate && endDate)
      filter.updatedAt = { $gte: startDate, $lte: endDate }; // ✅ use updatedAt for date filtering

    // --- Aggregate TransactionLog + enrich with Product ---
    const pipeline = [
      { $match: filter },
      { $addFields: { productIdStr: { $toString: "$productId" } } },
      {
        $lookup: {
          from: "products",
          let: { pidStr: "$productIdStr" },
          pipeline: [
            { $addFields: { idStr: { $toString: "$_id" } } },
            { $match: { $expr: { $eq: ["$idStr", "$$pidStr"] } } },
            { $project: { sku: 1, name: 1, isActive: 1 } },
          ],
          as: "productInfo",
        },
      },
      { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          sku: { $ifNull: ["$productInfo.sku", "$sku"] },
          name: { $ifNull: ["$productInfo.name", "$productName"] },
          openingQty: 1,
          addedQty: 1,
          soldQty: 1,
          closingQty: 1,
          remarks: 1,
          updatedAt: 1, // ✅ only this date field used
          archived: {
            $cond: [{ $eq: ["$productInfo.isActive", false] }, "Yes", "No"],
          },
        },
      },
      { $sort: { updatedAt: 1 } }, // ✅ sort by updatedAt ascending
    ];

    const logs = await TransactionLog.aggregate(pipeline);

    if (!logs.length)
      return res.status(404).json({ error: "No transactions found in this range." });

    // --- Build rows for Excel ---
    const rows = logs.map((l) => ({
      SKU: l.sku || "",
      Name: l.name || "",
      Opening: l.openingQty ?? 0,
      Added: l.addedQty ?? 0,
      Sold: l.soldQty ?? 0,
      Closing: l.closingQty ?? 0,
      Remarks: l.remarks || "",
      "Updated At": new Date(l.updatedAt).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      }),
      Archived: l.archived || "No",
    }));

    // --- Generate Excel ---
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    const safeSheetName = `Transactions - ${rangeLabel}`.substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=transactions_${type || "all"}_${Date.now()}.xlsx`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.send(buffer);
  } catch (err) {
    console.error("❌ Export Error (TransactionLog)", err);
    res.status(500).json({ error: "Failed to export transaction data" });
  }
});
// ✅ Export transactions as PDF (TransactionLog-based) — uses only updatedAt for filter, sort & display
router.get("/export-pdf", auth(["admin", "staff"]), async (req, res) => {
  try {
    const { type, start, end } = req.query;
    let filter = {};
    let rangeLabel = "";
    let startDate, endDate;

    // --- IST time setup ---
    const nowIST = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const currentIST = new Date(nowIST);

    switch (type) {
      case "today":
        startDate = new Date(currentIST.setHours(0, 0, 0, 0));
        endDate = new Date(currentIST.setHours(23, 59, 59, 999));
        rangeLabel = "Today";
        break;
      case "yesterday": {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        startDate = new Date(yesterday.setHours(0, 0, 0, 0));
        endDate = new Date(yesterday.setHours(23, 59, 59, 999));
        rangeLabel = "Yesterday";
        break;
      }
      case "this_month":
        startDate = new Date(currentIST.getFullYear(), currentIST.getMonth(), 1);
        endDate = new Date();
        rangeLabel = "This Month";
        break;
      case "last_3_months":
        startDate = new Date(currentIST.getFullYear(), currentIST.getMonth() - 2, 1);
        endDate = new Date();
        rangeLabel = "Last 3 Months";
        break;
      case "this_year":
        startDate = new Date(currentIST.getFullYear(), 0, 1);
        endDate = new Date();
        rangeLabel = "This Year";
        break;
      case "custom":
        if (start && end) {
          const startIST = new Date(
            new Date(start).toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
          );
          const endIST = new Date(
            new Date(end).toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
          );
          startDate = new Date(startIST.setHours(0, 0, 0, 0));
          endDate = new Date(endIST.setHours(23, 59, 59, 999));
          rangeLabel = `${start} → ${end}`;
        }
        break;
      default:
        rangeLabel = "All Data";
    }

    if (startDate && endDate)
      filter.updatedAt = { $gte: startDate, $lte: endDate }; // ✅ use updatedAt for filtering

    // --- Aggregate TransactionLog and enrich with Product info ---
    const pipeline = [
      { $match: filter },
      { $addFields: { productIdStr: { $toString: "$productId" } } },
      {
        $lookup: {
          from: "products",
          let: { pidStr: "$productIdStr" },
          pipeline: [
            { $addFields: { idStr: { $toString: "$_id" } } },
            { $match: { $expr: { $eq: ["$idStr", "$$pidStr"] } } },
            { $project: { sku: 1, name: 1, isActive: 1 } },
          ],
          as: "productInfo",
        },
      },
      { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          sku: { $ifNull: ["$productInfo.sku", "$sku"] },
          name: { $ifNull: ["$productInfo.name", "$productName"] },
          openingQty: 1,
          addedQty: 1,
          soldQty: 1,
          closingQty: 1,
          remarks: 1,
          updatedAt: 1,
          archived: {
            $cond: [{ $eq: ["$productInfo.isActive", false] }, "Yes", "No"],
          },
        },
      },
      { $sort: { updatedAt: -1 } }, // ✅ sort by updatedAt descending (latest first)
    ];

    const logs = await TransactionLog.aggregate(pipeline);

    if (!logs.length)
      return res.status(404).json({ error: "No transactions found in this range." });

    // --- Prepare jsPDF ---
    const jsPDF = require("jspdf").jsPDF;
    const autoTable = require("jspdf-autotable").default || require("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "A4" });

    // Header
    doc.setFontSize(16);
    doc.text("Jewellery Inventory Transactions", 40, 40);
    doc.setFontSize(11);
    doc.text(`Range: ${rangeLabel}`, 40, 60);

    // --- Prepare table ---
    const tableHead = [
      ["SKU", "Name", "Opening", "Added", "Sold", "Closing", "Remarks", "Updated At", "Archived"],
    ];
    const tableBody = logs.map((t) => [
      t.sku || "",
      t.name || "",
      t.openingQty ?? 0,
      t.addedQty ?? 0,
      t.soldQty ?? 0,
      t.closingQty ?? 0,
      t.remarks || "",
      new Date(t.updatedAt).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      }),
      t.archived || "No",
    ]);

    // --- Generate table ---
    (autoTable.default || autoTable)(doc, {
      startY: 80,
      head: tableHead,
      body: tableBody,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    // Footer
    const generatedAt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    doc.setFontSize(9);
    doc.text(`Generated on: ${generatedAt}`, 40, doc.internal.pageSize.height - 20);

    // --- Send PDF file ---
    const pdfData = doc.output("arraybuffer");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=transactions_${type || "all"}_${Date.now()}.pdf`
    );
    res.contentType("application/pdf");
    res.send(Buffer.from(pdfData));
  } catch (err) {
    console.error("❌ PDF Export Error:", err);
    res.status(500).json({ error: "Failed to export PDF" });
  }
});

module.exports = router;
