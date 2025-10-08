import mongoose from 'mongoose';

const mataKuliahSchema = new mongoose.Schema({
  nama: {
    type: String,
    required: true
  },
  kode: {
    type: String,
    required: true,
    unique: true
  },
  sks: {
    type: Number,
    required: true,
    min: 1,
    max: 6
  },
  dosen_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  kelas: [{
    type: String,
    required: true
  }],
  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 8
  },
  deskripsi: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

export default mongoose.model('MataKuliah', mataKuliahSchema);