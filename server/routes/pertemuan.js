import express from 'express';
import Pertemuan from '../models/Pertemuan.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Get all meetings
router.get('/', auth, async (req, res) => {
  try {
    const { kelas, mata_kuliah, dosen } = req.query;
    let query = {};
    
    if (kelas) query.kelas = kelas;
    if (mata_kuliah) query.mata_kuliah = mata_kuliah;
    if (dosen) query.dosen_id = dosen;

    const pertemuan = await Pertemuan.find(query)
      .populate('dosen_id', 'nama_lengkap')
      .populate('mata_kuliah_id', 'nama kode')
      .sort({ tanggal: -1 });
    
    res.json(pertemuan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get meeting by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const pertemuan = await Pertemuan.findById(req.params.id)
      .populate('dosen_id', 'nama_lengkap email departemen')
      .populate('mata_kuliah_id', 'nama kode sks');
    
    if (!pertemuan) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    res.json(pertemuan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new meeting
router.post('/', auth, async (req, res) => {
  try {
    const pertemuan = new Pertemuan(req.body);
    await pertemuan.save();
    await pertemuan.populate([
      { path: 'dosen_id', select: 'nama_lengkap' },
      { path: 'mata_kuliah_id', select: 'nama kode' }
    ]);
    res.status(201).json(pertemuan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update meeting
router.put('/:id', auth, async (req, res) => {
  try {
    const pertemuan = await Pertemuan.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate([
      { path: 'dosen_id', select: 'nama_lengkap' },
      { path: 'mata_kuliah_id', select: 'nama kode' }
    ]);
    
    if (!pertemuan) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    res.json(pertemuan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete meeting
router.delete('/:id', auth, async (req, res) => {
  try {
    const pertemuan = await Pertemuan.findByIdAndDelete(req.params.id);
    if (!pertemuan) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    res.json({ message: 'Meeting deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;