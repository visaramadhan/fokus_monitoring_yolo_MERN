

import express from 'express';
import axios from 'axios';
import LiveSession from '../models/LiveSession.js';
import { auth } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';

const router = express.Router();

const INFERENCE_URL = process.env.INFERENCE_URL || 'http://127.0.0.1:5001';
const latestFrames = new Map();

router.post('/frame', (req, res) => {
  try {
    const { session_id, frame, predictions, timestamp } = req.body || {};
    const sid = String(session_id || '');
    if (!sid) return res.status(400).json({ message: 'session_id is required' });
    if (typeof frame !== 'string') return res.status(400).json({ message: 'frame must be a base64 string' });
    const preds = Array.isArray(predictions) ? predictions : [];
    latestFrames.set(sid, { frame, predictions: preds, timestamp: Number(timestamp) || Date.now() });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to store frame' });
  }
});

router.get('/frame/:sessionId', auth, (req, res) => {
  const { sessionId } = req.params;
  const data = latestFrames.get(String(sessionId));
  if (!data) return res.json({ frame: null, predictions: [], timestamp: null });
  res.json(data);
});

router.post('/pipeline/start', auth, async (req, res) => {
  try {
    const {
      camera_index = 0,
      seats = [],
      session_id,
      confidence = 0.5,
      max_fps = 10,
      record_interval = 5,
      jpeg_quality = 72
    } = req.body || {};

    const sid = String(session_id || '');
    if (!sid) return res.status(400).json({ message: 'session_id is required' });

    const response = await axios.post(
      `${INFERENCE_URL}/start`,
      {
        camera_index,
        seats: Array.isArray(seats) ? seats : [],
        session_id: sid,
        confidence,
        max_fps,
        record_interval,
        jpeg_quality
      },
      { timeout: 15000 }
    );
    res.json(response.data);
  } catch (error) {
    const err = error;
    const status = err?.response?.status || 500;
    const message = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to start inference pipeline';
    res.status(status).json({ message });
  }
});

router.post('/pipeline/stop', auth, async (req, res) => {
  try {
    const { session_id } = req.body || {};
    const sid = session_id ? String(session_id) : '';
    const response = await axios.post(
      `${INFERENCE_URL}/stop`,
      sid ? { session_id: sid } : {},
      { timeout: 15000 }
    );
    if (sid) latestFrames.delete(sid);
    res.json(response.data);
  } catch (error) {
    const err = error;
    const status = err?.response?.status || 500;
    const message = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to stop inference pipeline';
    res.status(status).json({ message });
  }
});

router.get('/pipeline/health', auth, async (req, res) => {
  try {
    const response = await axios.get(`${INFERENCE_URL}/health`, { timeout: 5000 });
    res.json({ ok: true, inference_url: INFERENCE_URL, health: response.data });
  } catch (error) {
    const err = error;
    const status = err?.response?.status || 500;
    const message = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Inference runner not reachable';
    res.status(status).json({ ok: false, inference_url: INFERENCE_URL, message });
  }
});

router.get('/pipeline/status', auth, async (req, res) => {
  try {
    const response = await axios.get(`${INFERENCE_URL}/status`, { timeout: 5000 });
    res.json({ ok: true, inference_url: INFERENCE_URL, ...response.data });
  } catch (error) {
    const err = error;
    const status = err?.response?.status || 500;
    const message = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to get inference runner status';
    res.status(status).json({ ok: false, inference_url: INFERENCE_URL, message });
  }
});

// Start live monitoring session
router.post('/start', auth, async (req, res) => {
  try {
    const { kelas, mata_kuliah_id, mata_kuliah, dosen_id } = req.body;

    let dosenIdToUse = req.user._id;
    if (req.user.role === 'admin' && dosen_id) {
      const raw = String(dosen_id);
      if (!mongoose.Types.ObjectId.isValid(raw)) {
        return res.status(400).json({ message: 'Invalid dosen_id' });
      }
      dosenIdToUse = new mongoose.Types.ObjectId(raw);
    }
    
    const sessionId = uuidv4();
    const liveSession = new LiveSession({
      sessionId,
      kelas,
      mata_kuliah,
      mata_kuliah_id,
      dosen_id: dosenIdToUse
    });

    await liveSession.save();
    await liveSession.populate('mata_kuliah_id', 'nama kode');
    await liveSession.populate('dosen_id', 'nama_lengkap');

    res.status(201).json(liveSession);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Stop live monitoring session
router.post('/stop/:sessionId', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const liveSession = await LiveSession.findOne({ sessionId });
    if (!liveSession) {
      return res.status(404).json({ message: 'Session not found' });
    }

    liveSession.endTime = new Date();
    liveSession.isActive = false;
    liveSession.summary.totalDuration = Math.floor((liveSession.endTime - liveSession.startTime) / 1000 / 60); // in minutes

    await liveSession.save();
    res.json(liveSession);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add detection data to live session
router.post('/detection/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const detectionData = req.body;

    const liveSession = await LiveSession.findOne({ sessionId });
    if (!liveSession) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Calculate focus percentage
    const totalDetections = detectionData.totalDetections || 0;
    const focusedCount = detectionData.focusedCount || 0;
    const focusPercentage = totalDetections > 0 ? Math.round((focusedCount / totalDetections) * 100) : 0;

    const newDetection = {
      ...detectionData,
      focusPercentage,
      timestamp: new Date()
    };

    liveSession.detectionData.push(newDetection);
    await liveSession.save();

    res.json({ message: 'Detection data added successfully', focusPercentage });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Save session state
router.post('/saveState/:sessionId', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { state } = req.body;
    
    const liveSession = await LiveSession.findOne({ sessionId });
    if (!liveSession) {
      return res.status(404).json({ message: 'Session not found' });
    }
    
    liveSession.state = state;
    await liveSession.save();
    
    res.json({ message: 'Session state saved successfully', state });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get live session data
router.get('/session/:sessionId', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const liveSession = await LiveSession.findOne({ sessionId })
      .populate('mata_kuliah_id', 'nama kode')
      .populate('dosen_id', 'nama_lengkap');

    if (!liveSession) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json(liveSession);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all live sessions
router.get('/sessions', auth, async (req, res) => {
  try {
    const sessions = await LiveSession.find()
      .populate('mata_kuliah_id', 'nama kode')
      .populate('dosen_id', 'nama_lengkap')
      .sort({ startTime: -1 });

    res.json(sessions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get active sessions
router.get('/active', auth, async (req, res) => {
  try {
    const activeSessions = await LiveSession.find({ isActive: true })
      .populate('mata_kuliah_id', 'nama kode')
      .populate('dosen_id', 'nama_lengkap');

    res.json(activeSessions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
