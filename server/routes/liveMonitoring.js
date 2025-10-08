

import express from 'express';
import LiveSession from '../models/LiveSession.js';
import { auth } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Start live monitoring session
router.post('/start', auth, async (req, res) => {
  try {
    const { kelas, mata_kuliah_id, mata_kuliah } = req.body;
    
    const sessionId = uuidv4();
    const liveSession = new LiveSession({
      sessionId,
      kelas,
      mata_kuliah,
      mata_kuliah_id,
      dosen_id: req.user._id
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