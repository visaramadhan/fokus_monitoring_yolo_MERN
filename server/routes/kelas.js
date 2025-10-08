import express from 'express';
import Kelas from '../models/Kelas.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Get all classes
router.get('/', auth, async (req, res) => {
  try {
    const kelas = await Kelas.find().sort({ nama_kelas: 1 });
    res.json(kelas);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get class by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const kelas = await Kelas.findById(req.params.id);
    if (!kelas) {
      return res.status(404).json({ message: 'Class not found' });
    }
    res.json(kelas);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new class
router.post('/', auth, async (req, res) => {
  try {
    const kelas = new Kelas(req.body);
    await kelas.save();
    res.status(201).json(kelas);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update class
router.put('/:id', auth, async (req, res) => {
  try {
    const kelas = await Kelas.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!kelas) {
      return res.status(404).json({ message: 'Class not found' });
    }
    res.json(kelas);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete class
router.delete('/:id', auth, async (req, res) => {
  try {
    const kelas = await Kelas.findByIdAndDelete(req.params.id);
    if (!kelas) {
      return res.status(404).json({ message: 'Class not found' });
    }
    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;