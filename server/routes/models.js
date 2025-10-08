import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { auth } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Get list of available models from uploads/models directory
router.get('/list', auth, async (req, res) => {
  try {
    const modelsDir = path.join(__dirname, '../uploads/models');
    
    // Check if directory exists
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true });
      return res.json([]);
    }

    const files = fs.readdirSync(modelsDir);
    const modelFiles = files
      .filter(file => file.endsWith('.py'))
      .map(file => {
        const filePath = path.join(modelsDir, file);
        const stats = fs.statSync(filePath);
        
        return {
          name: file.replace(/\.[^/.]+$/, ""), // Remove extension for display
          path: filePath,
          size: stats.size,
          uploadedAt: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    res.json(modelFiles);
  } catch (error) {
    console.error('Error listing models:', error);
    res.status(500).json({ message: 'Failed to list models', error: error.message });
  }
});

// Get model info by path
router.get('/info', auth, async (req, res) => {
  try {
    const { modelPath } = req.query;
    
    if (!modelPath || !fs.existsSync(modelPath)) {
      return res.status(404).json({ message: 'Model file not found' });
    }

    const stats = fs.statSync(modelPath);
    const fileName = path.basename(modelPath);
    
    res.json({
      name: fileName.replace(/\.[^/.]+$/, ""),
      path: modelPath,
      size: stats.size,
      uploadedAt: stats.mtime.toISOString(),
      exists: true
    });
  } catch (error) {
    console.error('Error getting model info:', error);
    res.status(500).json({ message: 'Failed to get model info', error: error.message });
  }
});

export default router;