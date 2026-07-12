import express from 'express';
import mongoose from 'mongoose';
import { auth } from '../middleware/auth.js';
import Schedule from '../models/Schedule.js';
import Kelas from '../models/Kelas.js';
import MataKuliah from '../models/MataKuliah.js';
import User from '../models/User.js';

const router = express.Router();

function toObjectIdOrNull(value) {
  const raw = typeof value === 'string' ? value : value?._id || value?.id;
  if (!raw) return null;
  if (!mongoose.Types.ObjectId.isValid(String(raw))) return null;
  return new mongoose.Types.ObjectId(String(raw));
}

async function enrichSchedulePayload(payload = {}, existing = null) {
  const next = { ...payload };

  const mataKuliahObjectId = toObjectIdOrNull(next.mata_kuliah_id) || toObjectIdOrNull(existing?.mata_kuliah_id);
  if (!mataKuliahObjectId) {
    const error = new Error('Invalid mata_kuliah_id');
    error.status = 400;
    throw error;
  }

  const mataKuliahDoc = await MataKuliah.findById(mataKuliahObjectId).select('nama kode dosen_id');
  if (!mataKuliahDoc) {
    const error = new Error('Mata kuliah not found');
    error.status = 404;
    throw error;
  }
  next.mata_kuliah_id = mataKuliahObjectId;
  next.mata_kuliah = mataKuliahDoc.nama;

  let dosenObjectId = toObjectIdOrNull(next.dosen_id) || toObjectIdOrNull(existing?.dosen_id);
  if (!dosenObjectId && mataKuliahDoc.dosen_id) {
    dosenObjectId = new mongoose.Types.ObjectId(String(mataKuliahDoc.dosen_id));
  }
  if (!dosenObjectId) {
    const error = new Error('Invalid dosen_id');
    error.status = 400;
    throw error;
  }

  const dosenDoc = await User.findById(dosenObjectId).select('nama_lengkap');
  if (!dosenDoc) {
    const error = new Error('Dosen not found');
    error.status = 404;
    throw error;
  }
  next.dosen_id = dosenObjectId;
  next.dosen_name = dosenDoc.nama_lengkap;

  let kelasDoc = null;
  const kelasObjectId = toObjectIdOrNull(next.kelas_id) || toObjectIdOrNull(existing?.kelas_id);
  if (kelasObjectId) {
    kelasDoc = await Kelas.findById(kelasObjectId).select('nama_kelas');
    if (!kelasDoc) {
      const error = new Error('Kelas not found');
      error.status = 404;
      throw error;
    }
  } else {
    const kelasName = String(next.kelas || existing?.kelas || '').trim();
    if (!kelasName) {
      const error = new Error('kelas is required');
      error.status = 400;
      throw error;
    }
    kelasDoc = await Kelas.findOne({ nama_kelas: kelasName }).select('nama_kelas');
  }

  next.kelas_id = kelasDoc?._id || null;
  next.kelas = kelasDoc?.nama_kelas || String(next.kelas || existing?.kelas || '').trim();

  return next;
}

// Get all schedules
router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    const { status, date, dosen_id, mata_kuliah_id, kelas } = req.query;
    
    // Filter by user role
    if (req.user.role === 'dosen') {
      query.dosen_id = req.user._id;
    } else if (dosen_id) {
      const raw = String(dosen_id);
      if (!mongoose.Types.ObjectId.isValid(raw)) {
        return res.status(400).json({ message: 'Invalid dosen_id' });
      }
      query.dosen_id = new mongoose.Types.ObjectId(raw);
    }
    if (status) {
      if (status === 'pending') {
        query.status = { $in: ['scheduled', 'ongoing'] };
      } else if (status === 'available') {
        query.status = 'scheduled';
      } else if (status === 'completed' || status === 'cancelled' || status === 'scheduled' || status === 'ongoing') {
        query.status = status;
      }
    }
    if (mata_kuliah_id) {
      const raw = String(mata_kuliah_id);
      if (!mongoose.Types.ObjectId.isValid(raw)) {
        return res.status(400).json({ message: 'Invalid mata_kuliah_id' });
      }
      query.mata_kuliah_id = new mongoose.Types.ObjectId(raw);
    }
    if (kelas) {
      query.kelas = String(kelas);
    }
    if (date) {
      const d = new Date(String(date));
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ message: 'Invalid date. Use YYYY-MM-DD' });
      }
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      query.tanggal = { $gte: start, $lt: end };
    }

    const schedules = await Schedule.find(query)
      .populate('kelas_id', 'nama_kelas tahun_ajaran semester')
      .populate('mata_kuliah_id', 'nama kode')
      .populate('dosen_id', 'nama_lengkap')
      .sort({ tanggal: -1 });
    
    res.json(schedules);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

// Get schedule by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id)
      .populate('kelas_id', 'nama_kelas tahun_ajaran semester')
      .populate('mata_kuliah_id', 'nama kode sks')
      .populate('dosen_id', 'nama_lengkap email departemen');
    
    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    // Check access for dosen role
    if (req.user.role === 'dosen' && schedule.dosen_id._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json(schedule);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

// Create new schedule
router.post('/', auth, async (req, res) => {
  try {
    const payload = await enrichSchedulePayload(req.body);
    const schedule = new Schedule(payload);
    await schedule.save();
    await schedule.populate([
      { path: 'kelas_id', select: 'nama_kelas tahun_ajaran semester' },
      { path: 'mata_kuliah_id', select: 'nama kode' },
      { path: 'dosen_id', select: 'nama_lengkap' }
    ]);
    res.status(201).json(schedule);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update schedule
router.put('/:id', auth, async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);
    
    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    // Check access for dosen role
    if (req.user.role === 'dosen' && schedule.dosen_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (req.body?.status === 'ongoing' || req.body?.status === 'completed') {
      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const scheduleDate = new Date(schedule.tanggal);
      if (!(scheduleDate >= start && scheduleDate < end)) {
        return res.status(400).json({ message: 'Monitoring hanya boleh dilakukan pada tanggal jadwal.' });
      }
    }

    const payload = await enrichSchedulePayload(req.body, schedule);
    const updatedSchedule = await Schedule.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true, runValidators: true }
    ).populate([
      { path: 'kelas_id', select: 'nama_kelas tahun_ajaran semester' },
      { path: 'mata_kuliah_id', select: 'nama kode' },
      { path: 'dosen_id', select: 'nama_lengkap' }
    ]);
    
    res.json(updatedSchedule);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete schedule
router.delete('/:id', auth, async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);
    
    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    // Check access for dosen role
    if (req.user.role === 'dosen' && schedule.dosen_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await Schedule.findByIdAndDelete(req.params.id);
    res.json({ message: 'Schedule deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
