import express from 'express';
import Pertemuan from '../models/Pertemuan.js';
import LiveSession from '../models/LiveSession.js';
import Schedule from '../models/Schedule.js';
import { auth } from '../middleware/auth.js';
import mongoose from 'mongoose';

const router = express.Router();

function toObjectIdOrNull(value) {
  const raw = typeof value === 'string' ? value : value?._id || value?.id;
  if (!raw) return null;
  if (!mongoose.Types.ObjectId.isValid(String(raw))) return null;
  return new mongoose.Types.ObjectId(String(raw));
}

async function enrichPertemuanPayload(payload = {}) {
  const next = { ...payload };
  const liveSessionObjectId = toObjectIdOrNull(next.live_session_id);
  const liveSession =
    liveSessionObjectId
      ? await LiveSession.findById(liveSessionObjectId)
      : next.sessionId
        ? await LiveSession.findOne({ sessionId: String(next.sessionId) })
        : null;

  const jadwalObjectId = toObjectIdOrNull(next.jadwal_id) || liveSession?.jadwal_id || null;
  const scheduleDoc = jadwalObjectId ? await Schedule.findById(jadwalObjectId) : null;

  next.live_session_id = liveSession?._id || liveSessionObjectId || null;
  next.jadwal_id = scheduleDoc?._id || jadwalObjectId || null;
  next.kelas_id = toObjectIdOrNull(next.kelas_id) || liveSession?.kelas_id || scheduleDoc?.kelas_id || null;
  next.mata_kuliah_id = toObjectIdOrNull(next.mata_kuliah_id) || liveSession?.mata_kuliah_id || scheduleDoc?.mata_kuliah_id || null;
  next.dosen_id = toObjectIdOrNull(next.dosen_id) || liveSession?.dosen_id || scheduleDoc?.dosen_id || next.dosen_id;
  next.kelas = String(next.kelas || liveSession?.kelas || scheduleDoc?.kelas || '').trim();
  next.mata_kuliah = String(next.mata_kuliah || liveSession?.mata_kuliah || scheduleDoc?.mata_kuliah || '').trim();

  if (!next.tanggal && scheduleDoc?.tanggal) next.tanggal = scheduleDoc.tanggal;
  if (!next.pertemuan_ke && scheduleDoc?.pertemuan_ke) next.pertemuan_ke = scheduleDoc.pertemuan_ke;

  return next;
}

// Get all meetings
router.get('/', auth, async (req, res) => {
  try {
    const { kelas, mata_kuliah, dosen, mata_kuliah_id } = req.query;
    let query = {};
    
    if (kelas) query.kelas = kelas;
    if (mata_kuliah) query.mata_kuliah = mata_kuliah;
    if (dosen) query.dosen_id = dosen;
    if (mata_kuliah_id) {
      const raw = String(mata_kuliah_id);
      if (!mongoose.Types.ObjectId.isValid(raw)) {
        return res.status(400).json({ message: 'Invalid mata_kuliah_id' });
      }
      query.mata_kuliah_id = new mongoose.Types.ObjectId(raw);
    }

    const pertemuan = await Pertemuan.find(query)
      .populate('jadwal_id', 'tanggal jam_mulai jam_selesai pertemuan_ke status')
      .populate('live_session_id', 'sessionId startTime endTime isActive')
      .populate('kelas_id', 'nama_kelas tahun_ajaran semester')
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
      .populate('jadwal_id', 'tanggal jam_mulai jam_selesai pertemuan_ke status')
      .populate('live_session_id', 'sessionId startTime endTime isActive')
      .populate('kelas_id', 'nama_kelas tahun_ajaran semester')
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
    const payload = await enrichPertemuanPayload(req.body || {});

    if (payload.sessionId) {
      const pertemuan = await Pertemuan.findOneAndUpdate(
        { sessionId: payload.sessionId },
        payload,
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
      ).populate([
        { path: 'jadwal_id', select: 'tanggal jam_mulai jam_selesai pertemuan_ke status' },
        { path: 'live_session_id', select: 'sessionId startTime endTime isActive' },
        { path: 'kelas_id', select: 'nama_kelas tahun_ajaran semester' },
        { path: 'dosen_id', select: 'nama_lengkap' },
        { path: 'mata_kuliah_id', select: 'nama kode' }
      ]);
      return res.status(200).json(pertemuan);
    }

    const pertemuan = new Pertemuan(payload);
    await pertemuan.save();
    await pertemuan.populate([
      { path: 'jadwal_id', select: 'tanggal jam_mulai jam_selesai pertemuan_ke status' },
      { path: 'live_session_id', select: 'sessionId startTime endTime isActive' },
      { path: 'kelas_id', select: 'nama_kelas tahun_ajaran semester' },
      { path: 'dosen_id', select: 'nama_lengkap' },
      { path: 'mata_kuliah_id', select: 'nama kode' }
    ]);
    return res.status(201).json(pertemuan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update meeting
router.put('/:id', auth, async (req, res) => {
  try {
    const payload = await enrichPertemuanPayload(req.body || {});
    const pertemuan = await Pertemuan.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true, runValidators: true }
    ).populate([
      { path: 'jadwal_id', select: 'tanggal jam_mulai jam_selesai pertemuan_ke status' },
      { path: 'live_session_id', select: 'sessionId startTime endTime isActive' },
      { path: 'kelas_id', select: 'nama_kelas tahun_ajaran semester' },
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
