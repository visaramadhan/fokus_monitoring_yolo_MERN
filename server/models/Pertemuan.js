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
  focus_score: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  average_confidence: {
    type: Number,
    default: 0,
    min: 0,
    max: 1
  },
  status: {
    type: String,
    enum: ['Baik', 'Cukup', 'Kurang'],
    default: 'Cukup'
  }
});

const recordEventSchema = new mongoose.Schema({
  timestamp: {
    type: String,
    default: ''
  },
  id: {
    type: String,
    default: ''
  },
  label: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    default: ''
  },
  confidence: {
    type: Number,
    default: 0
  }
}, { _id: false });

const pertemuanSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    unique: true,
    sparse: true
  },
  jadwal_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Schedule',
    default: null
  },
  live_session_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LiveSession',
    default: null
  },
  kelas_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Kelas',
    default: null
  },
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
    default: 100
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
    },
    fokus_count: {
      type: Number,
      default: 0
    },
    tidak_fokus_count: {
      type: Number,
      default: 0
    },
    sleeping_count: {
      type: Number,
      default: 0
    },
    phone_count: {
      type: Number,
      default: 0
    },
    yawning_count: {
      type: Number,
      default: 0
    },
    turning_back_count: {
      type: Number,
      default: 0
    },
    average_focus_score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },
  detection_model_type: {
    type: String,
    enum: ['model_1', 'model_2'],
    default: 'model_1'
  },
  catatan: {
    type: String,
    default: ''
  },
  record_events: {
    type: [recordEventSchema],
    default: []
  }
}, {
  timestamps: true
});

pertemuanSchema.index({ jadwal_id: 1, tanggal: -1 });
pertemuanSchema.index({ live_session_id: 1 }, { sparse: true });

pertemuanSchema.pre('save', function(next) {
  if (this.data_fokus.length > 0) {
    const totalFokus = this.data_fokus.reduce((sum, data) => sum + data.persen_fokus, 0);
    const totalTidakFokus = this.data_fokus.reduce((sum, data) => sum + data.persen_tidak_fokus, 0);
    const totalWeighted = this.data_fokus.reduce((sum, data) => sum + (Number(data.focus_score || 0) * Math.max(1, Number(data.waktu_hadir || 1))), 0);
    const weightSum = this.data_fokus.reduce((sum, data) => sum + Math.max(1, Number(data.waktu_hadir || 1)), 0);

    this.hasil_akhir_kelas.fokus = Number((totalFokus / this.data_fokus.length).toFixed(2));
    this.hasil_akhir_kelas.tidak_fokus = Number((totalTidakFokus / this.data_fokus.length).toFixed(2));
    this.hasil_akhir_kelas.jumlah_hadir = this.data_fokus.length;
    if (!this.hasil_akhir_kelas.average_focus_score || this.hasil_akhir_kelas.average_focus_score === 0) {
      this.hasil_akhir_kelas.average_focus_score = weightSum > 0 ? Number((totalWeighted / weightSum).toFixed(2)) : 0;
    }
  }
  next();
});

export default mongoose.model('Pertemuan', pertemuanSchema);
