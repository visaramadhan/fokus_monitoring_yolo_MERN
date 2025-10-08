import express from 'express';
import MataKuliah from '../models/MataKuliah.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Get all subjects
router.get('/', auth, async (req, res) => {
  try {
    const mataKuliah = await MataKuliah.find()
      .populate('dosen_id', 'nama_lengkap')
      .sort({ nama: 1 });
    res.json(mataKuliah);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get subject by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const mataKuliah = await MataKuliah.findById(req.params.id)
      .populate('dosen_id', 'nama_lengkap email departemen');
    if (!mataKuliah) {
      return res.status(404).json({ message: 'Subject not found' });
    }
    res.json(mataKuliah);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new subject
router.post('/', auth, async (req, res) => {
  try {
    const mataKuliah = new MataKuliah(req.body);
    await mataKuliah.save();
    await mataKuliah.populate('dosen_id', 'nama_lengkap');
    res.status(201).json(mataKuliah);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update subject
router.put('/:id', auth, async (req, res) => {
  try {
    const mataKuliah = await MataKuliah.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('dosen_id', 'nama_lengkap');
    
    if (!mataKuliah) {
      return res.status(404).json({ message: 'Subject not found' });
    }
    res.json(mataKuliah);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete subject
router.delete('/:id', auth, async (req, res) => {
  try {
    const mataKuliah = await MataKuliah.findByIdAndDelete(req.params.id);
    if (!mataKuliah) {
      return res.status(404).json({ message: 'Subject not found' });
    }
    res.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;