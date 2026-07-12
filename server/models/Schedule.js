import mongoose from 'mongoose';

const seatPositionSchema = new mongoose.Schema({
  seat_id: { type: Number, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  student_id: { type: String, required: true }
}, { _id: false });

const scheduleSchema = new mongoose.Schema({
  kelas_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Kelas',
    default: null
  },
  kelas: {
    type: String,
    required: true,
    trim: true
  },
  mata_kuliah: {
    type: String,
    required: true,
    trim: true
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
    required: true,
    trim: true
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
  seat_positions: {
    type: [seatPositionSchema],
    default: []
  }
}, {
  timestamps: true
});

scheduleSchema.index({ dosen_id: 1, mata_kuliah_id: 1, kelas_id: 1, tanggal: 1, pertemuan_ke: 1 });

export default mongoose.models.Schedule || mongoose.model('Schedule', scheduleSchema);
