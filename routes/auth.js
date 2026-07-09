const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Professor = require('../models/Professor');

// Mock In-Memory Database Fallback
const mockProfessors = {}; // username_lowercase -> { _id, username, passwordHash }

// @route   POST api/auth/register
// @desc    Register a professor
// @access  Public
router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  const trimmedUsername = username.trim();

  if (trimmedUsername.length < 3 || password.length < 6) {
    return res.status(400).json({ message: 'Username must be >= 3 chars, password must be >= 6 chars' });
  }

  const isDbConnected = mongoose.connection.readyState === 1;

  try {
    if (isDbConnected) {
      // Use MongoDB
      let professor = await Professor.findOne({ username: { $regex: `^${trimmedUsername}$`, $options: 'i' } });
      if (professor) {
        return res.status(400).json({ message: 'Username already exists' });
      }

      professor = new Professor({
        username: trimmedUsername,
        password
      });

      await professor.save();
    } else {
      // Use Fallback Mock Database
      const key = trimmedUsername.toLowerCase();
      if (mockProfessors[key]) {
        return res.status(400).json({ message: 'Username already exists (Mock DB)' });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      mockProfessors[key] = {
        _id: new mongoose.Types.ObjectId().toString(),
        username: trimmedUsername,
        password: passwordHash
      };
      console.log(`Mock DB Registered: ${trimmedUsername}`);
    }

    res.status(201).json({ message: 'Registration successful' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/auth/login
// @desc    Authenticate professor & get token
// @access  Public
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  const trimmedUsername = username.trim();
  const isDbConnected = mongoose.connection.readyState === 1;

  try {
    let user_id = null;
    let passwordHash = null;
    let finalUsername = trimmedUsername;

    if (isDbConnected) {
      // Use MongoDB
      const professor = await Professor.findOne({ username: trimmedUsername });
      if (!professor) {
        return res.status(400).json({ message: 'Invalid username or password' });
      }

      const isMatch = await professor.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid username or password' });
      }

      user_id = professor._id.toString();
      finalUsername = professor.username;
    } else {
      // Use Fallback Mock Database
      const key = trimmedUsername.toLowerCase();
      const prof = mockProfessors[key];
      if (!prof) {
        return res.status(400).json({ message: 'Invalid username or password (Mock DB)' });
      }

      const isMatch = await bcrypt.compare(password, prof.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid username or password (Mock DB)' });
      }

      user_id = prof._id;
      finalUsername = prof.username;
    }

    // Generate JWT Token
    const payload = {
      sub: user_id
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'prof_attendance_dashboard_secret_key_default_12345',
      { expiresIn: '24h' },
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          username: finalUsername,
          message: 'Login successful'
        });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
// Export mock database reference so students route can verify professor exists if needed
module.exports.mockProfessors = mockProfessors;
