import express from 'express';
import MataKuliah from '../models/MataKuliah.js';
import { auth } from '../middleware/auth.js';
import mongoose from 'mongoose';

const router = express.Router();

function buildYearRange(year) {
  const rawYear = String(year || '').trim();
  if (!/^\d{4}$/.test(rawYear)) {
    return { error: 'Invalid year. Use YYYY format.' };
  }

  const start = new Date(`${rawYear}-01-01T00:00:00.000Z`);
  const end = new Date(`${Number(rawYear) + 1}-01-01T00:00:00.000Z`);
  return { start, end };
}

// Get all subjects
router.get('/', auth, async (req, res) => {
  try {
    const { dosen_id, year } = req.query;
    const query = {};

    if (req.user.role === 'dosen') {
      query.dosen_id = req.user._id;
    } else if (dosen_id) {
      const raw = String(dosen_id);
      if (!mongoose.Types.ObjectId.isValid(raw)) {
        return res.status(400).json({ message: 'Invalid dosen_id' });
      }
      query.dosen_id = new mongoose.Types.ObjectId(raw);
    }

    if (year) {
      const yearRange = buildYearRange(year);
      if (yearRange.error) {
        return res.status(400).json({ message: yearRange.error });
      }
      query.createdAt = { $gte: yearRange.start, $lt: yearRange.end };
    }

    const mataKuliah = await MataKuliah.find(query)
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
