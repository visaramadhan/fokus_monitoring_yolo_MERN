import express from 'express';
import mongoose from 'mongoose';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Schedule Schema
const scheduleSchema = new mongoose.Schema({
  kelas: {
    type: String,
    required: true
  },
  mata_kuliah: {
    type: String,
    required: true
  },
  mata_kuliah_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MataKuliah',
    required: true
  
  },
  dosen_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dosen_name: {
    type: String,
    required: true
  },
  tanggal: {
    type: Date,
    required: true
  },
  jam_mulai: {
    type: String,
    required: true
  },
  jam_selesai: {
    type: String,
    required: true
  },
  durasi: {
    type: Number,
    required: true
  },
  pertemuan_ke: {
    type: Number,
    required: true,
    min: 1
  },
  topik: {
    type: String,
    default: ''
  },
  ruangan: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  seat_positions: [{
    seat_id: { type: Number, required: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    student_id: { type: String, required: true }
  }]
}, {
  timestamps: true
});

const Schedule = mongoose.model('Schedule', scheduleSchema);

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
      .populate('mata_kuliah_id', 'nama kode')
      .populate('dosen_id', 'nama_lengkap')
      .sort({ tanggal: -1 });
    
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get schedule by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id)
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
    res.status(500).json({ message: error.message });
  }
});

// Create new schedule
router.post('/', auth, async (req, res) => {
  try {
    const schedule = new Schedule(req.body);
    await schedule.save();
    await schedule.populate([
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

    const updatedSchedule = await Schedule.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate([
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
