import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { auth } from '../middleware/auth.js';
import mongoose from 'mongoose';

const router = express.Router();
const DEBUG_SERVER_URL = 'http://127.0.0.1:7777/event';

async function reportDebugEvent(payload = {}) {
  try {
    await fetch(DEBUG_SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'login-failed',
        runId: 'pre-fix',
        source: 'server',
        ...payload,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {}
}

// Guard: ensure DB connection is ready before handling auth routes
router.use((req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: 'Database initializing, please retry shortly' });
  }
  next();
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role, nama_lengkap, nip, departemen } = req.body;

    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: 'User already exists with this email or username' 
      });
    }

    const user = new User({
      username,
      email,
      password,
      role: role || 'dosen',
      nama_lengkap,
      nip,
      departemen
    });

    await user.save();

    const secret = process.env.JWT_SECRET || 'development_fallback_secret';
    const token = jwt.sign(
      { userId: user._id },
      secret,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        nama_lengkap: user.nama_lengkap
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  // #region debug-point A:auth-login-entry
  try {
    const { username, password } = req.body;
    await reportDebugEvent({
      hypothesisId: 'A',
      message: '[DEBUG] auth.login.request',
      data: {
        usernameType: typeof username,
        usernameLength: typeof username === 'string' ? username.length : null,
        passwordProvided: Boolean(password),
        dbReadyState: mongoose.connection.readyState,
        dbName: mongoose.connection?.name || null,
        nodeEnv: process.env.NODE_ENV || null,
      },
    });
    
    // Mock logic removed to use real database authentication
    /*
    if (process.env.NODE_ENV !== 'production') {
      // ... mock logic removed ...
    }
    */
    
    // Production code path (will not be reached in development)
    const user = await User.findOne({ username });
    // #region debug-point B:user-lookup
    await reportDebugEvent({
      hypothesisId: 'B',
      message: '[DEBUG] auth.login.userLookup',
      data: {
        username,
        userFound: Boolean(user),
        userId: user?._id?.toString?.() || null,
      },
    });
    // #endregion debug-point B:user-lookup
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    // #region debug-point C:password-check
    await reportDebugEvent({
      hypothesisId: 'C',
      message: '[DEBUG] auth.login.passwordCheck',
      data: {
        username,
        isMatch,
        hashedPasswordPrefix: typeof user.password === 'string' ? user.password.slice(0, 10) : null,
      },
    });
    // #endregion debug-point C:password-check
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const secret = process.env.JWT_SECRET || 'development_fallback_secret';
    const token = jwt.sign(
      { userId: user._id },
      secret,
      { expiresIn: '7d' }
    );

    // #region debug-point D:auth-login-success
    await reportDebugEvent({
      hypothesisId: 'D',
      message: '[DEBUG] auth.login.success',
      data: {
        userId: user._id?.toString?.() || null,
        role: user.role,
        responseShape: ['message', 'token', 'user'],
      },
    });
    // #endregion debug-point D:auth-login-success
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        nama_lengkap: user.nama_lengkap,
        departemen: user.departemen
      }
    });
  } catch (error) {
    // #region debug-point C:auth-login-error
    await reportDebugEvent({
      hypothesisId: 'C',
      message: '[DEBUG] auth.login.error',
      data: {
        name: error?.name || null,
        message: error?.message || String(error),
        stack: error?.stack || null,
        dbReadyState: mongoose.connection.readyState,
        dbName: mongoose.connection?.name || null,
      },
    });
    // #endregion debug-point C:auth-login-error
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
  // #endregion debug-point A:auth-login-entry
});

// Get current user
router.get('/me', auth, async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role,
      nama_lengkap: req.user.nama_lengkap,
      nip: req.user.nip,
      departemen: req.user.departemen
    }
  });
});

export default router;
