require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// ✅ Allow CORS for local dev + deployed frontend
const allowedOrigins = [
  'http://localhost:3000',
  'https://jewelleryshowroom.netlify.app' // ✅ your actual Netlify frontend URL
  'https://omjewellersinventory.netlify.app' // client url
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
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

// ✅ Auth Routes  🔐  <-- ADD THIS
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// ✅ MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
