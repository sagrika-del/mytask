const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dns = require('dns');
require('dotenv').config();

// Force Google's public DNS to bypass restrictive lab/corp network DNS
// that blocks SRV lookups required by MongoDB Atlas (mongodb+srv://)
dns.setServers(['8.8.8.8', '8.8.4.4']);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors());

// Body parser middleware
app.use(express.json());

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/students', require('./routes/students'));

// Serve static assets in production (React frontend)
const clientBuildPath = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientBuildPath));

// Fallback to React index.html for SPA router
app.get('*', (req, res) => {
  // If request is for api, return 404 instead of index.html
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ message: 'API endpoint not found' });
  }
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/attendance_db';

console.log('Attempting to connect to MongoDB Atlas...');
console.log('URI:', MONGO_URI.replace(/:([^:@]+)@/, ':****@')); // log URI with hidden password
mongoose
  .connect(MONGO_URI, { serverSelectionTimeoutMS: 8000 })
  .then(() => {
    console.log(`✅ Connected to MongoDB Atlas: ${mongoose.connection.name}`);
    // Start Express server only after successful DB connection
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    console.error('Common causes:');
    console.error('  1. Atlas cluster is PAUSED — resume it at https://cloud.mongodb.com/');
    console.error('  2. Your IP is not whitelisted — add it in Network Access');
    console.error('  3. Wrong username/password in MONGO_URI');
    process.exit(1);
  });
