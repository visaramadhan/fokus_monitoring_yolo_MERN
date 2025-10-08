import mongoose from 'mongoose';

const dataFokusSchema = new mongoose.Schema({
  id_siswa: {
    type: String,
    required: true
  },
  fokus: [{
    type: Number,
    min: 0,
    max: 1
  }],
  jumlah_sesi_fokus: {
    type: Number,
    default: 0
  },
  durasi_fokus: {
    type: Number,
    default: 0
  },
  waktu_hadir: {
    type: Number,
    default: 60
  },
  persen_fokus: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  persen_tidak_fokus: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  status: {
    type: String,
    enum: ['Baik', 'Cukup', 'Kurang'],
    default: 'Cukup'
  }
});

const pertemuanSchema = new mongoose.Schema({
  tanggal: {
    type: Date,
    required: true
  },
  pertemuan_ke: {
    type: Number,
    required: true,
    min: 1
  },
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
  durasi_pertemuan: {
    type: Number,
    default: 100,
    min: 30
  },
  topik: {
    type: String,
    default: ''
  },
  data_fokus: [dataFokusSchema],
  hasil_akhir_kelas: {
    fokus: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    tidak_fokus: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    jumlah_hadir: {
      type: Number,
      default: 0
    }
  },
  catatan: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

pertemuanSchema.pre('save', function(next) {
  if (this.data_fokus.length > 0) {
    const totalFokus = this.data_fokus.reduce((sum, data) => sum + data.persen_fokus, 0);
    const totalTidakFokus = this.data_fokus.reduce((sum, data) => sum + data.persen_tidak_fokus, 0);
    
    this.hasil_akhir_kelas.fokus = Number((totalFokus / this.data_fokus.length).toFixed(2));
    this.hasil_akhir_kelas.tidak_fokus = Number((totalTidakFokus / this.data_fokus.length).toFixed(2));
    this.hasil_akhir_kelas.jumlah_hadir = this.data_fokus.length;
  }
  next();
});

export default mongoose.model('Pertemuan', pertemuanSchema);