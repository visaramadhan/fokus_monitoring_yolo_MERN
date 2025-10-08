import mongoose from 'mongoose';

const kelasSchema = new mongoose.Schema({
  nama_kelas: {
    type: String,
    required: true,
    unique: true
  },
  mahasiswa: [{
    id_mahasiswa: {
      type: String,
      required: true
    },
    nama: {
      type: String,
      default: ''
    }
  }],
  jumlah_mahasiswa: {
    type: Number,
    default: 0
  },
  tahun_ajaran: {
    type: String,
    default: '2024/2025'
  },
  semester: {
    type: String,
    enum: ['Ganjil', 'Genap'],
    default: 'Ganjil'
  }
}, {
  timestamps: true
});

kelasSchema.pre('save', function(next) {
  this.jumlah_mahasiswa = this.mahasiswa.length;
  next();
});

export default mongoose.model('Kelas', kelasSchema);