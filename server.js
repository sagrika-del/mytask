const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dns = require('dns');
require('dotenv').config();

// Force Google's public DNS so SRV lookups for MongoDB Atlas work on Render
dns.setServers(['8.8.8.8', '8.8.4.4']);

const app = express();
const PORT = process.env.PORT || 5000;

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'https://cheerful-platypus-53b5dc.netlify.app',
  'http://localhost:3000',
  'http://localhost:5173'
];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ─── Body Parser ─────────────────────────────────────────────────────────────
app.use(express.json());

// ─── Health Check (keeps Render from returning 404 on root) ──────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'EduTrack API is running ✅' });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/students', require('./routes/students'));

// ─── 404 for unknown API routes ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

// ─── MongoDB Connection ───────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI environment variable is not set! Set it in Render → Environment.');
  process.exit(1);
}

console.log('Attempting to connect to MongoDB Atlas...');
mongoose
  .connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 })
  .then(() => {
    console.log(`✅ Connected to MongoDB Atlas: ${mongoose.connection.name}`);
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });
