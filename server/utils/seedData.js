import User from '../models/User.js';
import Kelas from '../models/Kelas.js';
import MataKuliah from '../models/MataKuliah.js';
import Pertemuan from '../models/Pertemuan.js';
import mongoose from 'mongoose';

const Schedule = mongoose.model('Schedule');

export async function createDummyData() {
  try {
    // Check if data already exists
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log('Dummy data already exists');
      return;
    }

    console.log('Creating dummy data...');

    // Create varied dosen users with NIP as password
    const dosenData = [
      { nama: 'Dr. Ahmad Fauzi, M.Kom', departemen: 'Teknik Informatika', nip: '198501012010011001' },
      { nama: 'Prof. Dr. Siti Nurhaliza, M.T', departemen: 'Teknik Informatika', nip: '197803152005012002' },
      { nama: 'Dr. Budi Santoso, M.Sc', departemen: 'Sistem Informasi', nip: '198209201998031003' },
      { nama: 'Dr. Rina Kartika, M.Kom', departemen: 'Teknik Informatika', nip: '198712102012012004' },
      { nama: 'Prof. Dr. Hendro Wijaya, Ph.D', departemen: 'Sistem Informasi', nip: '197505251995121005' },
      { nama: 'Dr. Maya Sari, M.T', departemen: 'Teknik Informatika', nip: '198903182015032006' },
      { nama: 'Dr. Agus Prasetyo, M.Kom', departemen: 'Sistem Informasi', nip: '198406141999031007' },
      { nama: 'Dr. Dewi Lestari, M.Sc', departemen: 'Teknik Informatika', nip: '199001052018012008' }
    ];

    const dosenUsers = [];
    for (let i = 0; i < dosenData.length; i++) {
      const dosen = dosenData[i];
      const user = new User({
        username: `dosen${i + 1}`,
        email: `${dosen.nama.toLowerCase().replace(/[^a-z]/g, '')}@university.ac.id`,
        password: dosen.nip, // Use NIP as password
        role: 'dosen',
        nama_lengkap: dosen.nama,
        nip: dosen.nip,
        departemen: dosen.departemen
      });
      await user.save();
      dosenUsers.push(user);
    }

    // Create 1 admin user
    const adminUser = new User({
      username: 'admin',
      email: 'admin@university.ac.id',
      password: 'admin123',
      role: 'admin',
      nama_lengkap: 'Admin System',
      departemen: 'IT Support'
    });
    await adminUser.save();

    // Create 8 classes with varied names
    const kelasNames = ['TI-1A', 'TI-1B', 'TI-2A', 'TI-2B', 'SI-1A', 'SI-1B', 'SI-2A', 'SI-2B'];
    const kelasData = [];
    
    for (let i = 0; i < 8; i++) {
      const mahasiswa = [];
      for (let j = 1; j <= 30; j++) {
        mahasiswa.push({
          id_mahasiswa: `${kelasNames[i].replace('-', '')}${j.toString().padStart(3, '0')}`,
          nama: `Mahasiswa ${kelasNames[i]} ${j}`
        });
      }

      const kelas = new Kelas({
        nama_kelas: kelasNames[i],
        mahasiswa: mahasiswa,
        tahun_ajaran: '2024/2025',
        semester: i % 2 === 0 ? 'Ganjil' : 'Genap'
      });
      await kelas.save();
      kelasData.push(kelas);
    }

    // Create subjects with proper dosen assignment
    const subjects = [
      { nama: 'Pemrograman Web', kode: 'TI301', sks: 3, kelas: ['TI-1A', 'TI-1B'], semester: 3 },
      { nama: 'Database Management', kode: 'TI302', sks: 3, kelas: ['TI-2A', 'TI-2B'], semester: 4 },
      { nama: 'Algoritma dan Struktur Data', kode: 'TI201', sks: 4, kelas: ['TI-1A'], semester: 2 },
      { nama: 'Jaringan Komputer', kode: 'TI401', sks: 3, kelas: ['TI-2A'], semester: 5 },
      { nama: 'Sistem Informasi Manajemen', kode: 'SI301', sks: 3, kelas: ['SI-1A', 'SI-1B'], semester: 3 },
      { nama: 'Rekayasa Perangkat Lunak', kode: 'TI501', sks: 3, kelas: ['TI-2B'], semester: 6 },
      { nama: 'Analisis dan Perancangan Sistem', kode: 'SI401', sks: 4, kelas: ['SI-2A', 'SI-2B'], semester: 4 },
      { nama: 'Mobile Programming', kode: 'TI601', sks: 3, kelas: ['TI-1B'], semester: 7 }
    ];

    const mataKuliahData = [];
    for (let i = 0; i < 8; i++) {
      const subject = subjects[i];
      const mataKuliah = new MataKuliah({
        nama: subject.nama,
        kode: subject.kode,
        sks: subject.sks,
        dosen_id: dosenUsers[i]._id,
        kelas: subject.kelas,
        semester: subject.semester,
        deskripsi: `Mata kuliah ${subject.nama} untuk mahasiswa semester ${subject.semester}`
      });
      await mataKuliah.save();
      mataKuliahData.push(mataKuliah);
    }

    // Create meetings for each subject
    for (let subjectIndex = 0; subjectIndex < 8; subjectIndex++) {
      const mataKuliah = mataKuliahData[subjectIndex];
      const dosen = dosenUsers[subjectIndex];
      
      // Create meetings for each class in the subject
      for (const kelasName of mataKuliah.kelas) {
        for (let pertemuanKe = 1; pertemuanKe <= 6; pertemuanKe++) {
          const dataFokus = [];
          
          // Get students from the class
          const kelas = kelasData.find(k => k.nama_kelas === kelasName);
          if (!kelas) continue;
          
          // Generate focus data for each student
          for (let mahasiswaIndex = 0; mahasiswaIndex < 25; mahasiswaIndex++) { // Random attendance
            const mahasiswa = kelas.mahasiswa[mahasiswaIndex];
            
            // Generate random focus pattern (12 sessions of 5 minutes each)
            const fokusPattern = [];
            for (let session = 0; session < 12; session++) {
              fokusPattern.push(Math.random() > 0.25 ? 1 : 0); // 75% chance of being focused
            }
            
            const jumlahSesiFokus = fokusPattern.filter(f => f === 1).length;
            const persenFokus = Math.round((jumlahSesiFokus / 12) * 100);
            const persenTidakFokus = 100 - persenFokus;
            
            let status = 'Kurang';
            if (persenFokus >= 80) status = 'Baik';
            else if (persenFokus >= 60) status = 'Cukup';

            dataFokus.push({
              id_siswa: mahasiswa.id_mahasiswa,
              fokus: fokusPattern,
              jumlah_sesi_fokus: jumlahSesiFokus,
              durasi_fokus: jumlahSesiFokus * 5,
              waktu_hadir: 60,
              persen_fokus: persenFokus,
              persen_tidak_fokus: persenTidakFokus,
              status: status
            });
          }

          const meetingDate = new Date(2024, 2, (pertemuanKe - 1) * 7 + (subjectIndex * 2)); // Spread meetings
          
          const pertemuan = new Pertemuan({
            tanggal: meetingDate,
            pertemuan_ke: pertemuanKe,
            kelas: kelasName,
            mata_kuliah: mataKuliah.nama,
            mata_kuliah_id: mataKuliah._id,
            dosen_id: dosen._id,
            durasi_pertemuan: 100,
            topik: `Pertemuan ${pertemuanKe} - ${mataKuliah.nama}`,
            data_fokus: dataFokus,
            catatan: `Pertemuan ${pertemuanKe} berjalan dengan baik. Materi disampaikan dengan interaktif.`
          });
          
          await pertemuan.save();
        }
      }
    }

    // Create schedule data
    const scheduleData = [];
    for (let subjectIndex = 0; subjectIndex < 8; subjectIndex++) {
      const mataKuliah = mataKuliahData[subjectIndex];
      const dosen = dosenUsers[subjectIndex];
      
      for (const kelasName of mataKuliah.kelas) {
        for (let week = 1; week <= 4; week++) { // 4 weeks of schedules
          const scheduleDate = new Date(2024, 3, week * 7 + subjectIndex); // April 2024
          
          const schedule = new Schedule({
            kelas: kelasName,
            mata_kuliah: mataKuliah.nama,
            mata_kuliah_id: mataKuliah._id,
            dosen_id: dosen._id,
            dosen_name: dosen.nama_lengkap,
            tanggal: scheduleDate,
            jam_mulai: `${8 + (subjectIndex % 4) * 2}:00`,
            jam_selesai: `${9 + (subjectIndex % 4) * 2}:40`,
            durasi: 100,
            pertemuan_ke: week + 6, // Continue from existing meetings
            topik: `Materi Minggu ${week} - ${mataKuliah.nama}`,
            ruangan: `R${101 + subjectIndex}`,
            status: week <= 2 ? 'completed' : 'scheduled'
          });
          
          await schedule.save();
          scheduleData.push(schedule);
        }
      }
    }

    console.log('Dummy data created successfully!');
    console.log('Login credentials:');
    console.log('Admin: admin / admin123');
    console.log('Dosen credentials (username / password):');
    dosenUsers.forEach((dosen, index) => {
      console.log(`dosen${index + 1} / ${dosen.nip} (${dosen.nama_lengkap})`);
    });

  } catch (error) {
    console.error('Error creating dummy data:', error);
  }
}