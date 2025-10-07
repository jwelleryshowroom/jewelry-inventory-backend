require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// ✅ Allow CORS for both local dev and deployed frontend
const allowedOrigins = [
  'http://localhost:3000',
  'https://your-frontend.vercel.app' // ← replace this AFTER frontend is deployed
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// ✅ Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Jewelry Inventory API is running!' });
});

// ✅ Product Routes
const productRoutes = require('./routes/productRoutes');
app.use('/api/products', productRoutes);

// ✅ MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
