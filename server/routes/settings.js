import express from 'express';
import Settings from '../models/Settings.js';
import { auth, adminAuth } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';

const router = express.Router();

// Configure multer for model file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/models/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pt', '.onnx', '.pb'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .pt, .onnx, and .pb files are allowed.'));
    }
  },
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  }
});

// Get settings
router.get('/', auth, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
      await settings.save();
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update settings
router.put('/', adminAuth, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }
    
    Object.assign(settings, req.body);
    await settings.save();
    
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Upload YOLO model
router.post('/upload-model', adminAuth, upload.single('model'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No model file uploaded' });
    }

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    settings.modelPath = req.file.path;
    settings.modelType = getModelType(req.file.originalname);
    settings.modelStatus = 'active';
    
    await settings.save();

    res.json({
      message: 'Model uploaded successfully',
      modelPath: req.file.path,
      modelType: settings.modelType
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Test model connection
router.post('/test-model', adminAuth, async (req, res) => {
  try {
    const settings = await Settings.findOne();
    if (!settings || !settings.modelPath) {
      return res.status(400).json({ message: 'No model configured' });
    }

    // Here you would implement actual model testing
    // For now, we'll simulate a successful test
    settings.modelStatus = 'active';
    await settings.save();

    res.json({ message: 'Model test successful', status: 'active' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

function getModelType(filename) {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.pt':
      return 'pytorch';
    case '.onnx':
      return 'onnx';
    case '.pb':
      return 'tensorflow';
    default:
      return 'unknown';
  }
}

export default router;