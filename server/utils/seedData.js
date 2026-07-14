import User from '../models/User.js';
import Kelas from '../models/Kelas.js';
import MataKuliah from '../models/MataKuliah.js';
import Pertemuan from '../models/Pertemuan.js';
import LiveSession from '../models/LiveSession.js';
import SessionRecord from '../models/SessionRecord.js';
import Schedule from '../models/Schedule.js';
import mongoose from 'mongoose';

export async function purgeAllData() {
  const operations = [
    SessionRecord.deleteMany({}),
    LiveSession.deleteMany({}),
    Pertemuan.deleteMany({}),
    Schedule.deleteMany({}),
    MataKuliah.deleteMany({}),
    Kelas.deleteMany({}),
    User.deleteMany({})
  ];

  await Promise.allSettled(operations);
}

export async function purgeDummyData() {
  const dummyUsers = await User.find({
    $or: [
      { email: /@university\.ac\.id$/i },
      { username: /^dosen\d+$/i },
      { username: /^admin$/i, email: /@university\.ac\.id$/i }
    ]
  }).select('_id');
  const dummyUserIds = dummyUsers.map(u => u._id);

  if (dummyUserIds.length === 0) return;

  await Promise.allSettled([
    SessionRecord.deleteMany({ dosen_id: { $in: dummyUserIds } }),
    LiveSession.deleteMany({ dosen_id: { $in: dummyUserIds } }),
    Pertemuan.deleteMany({ dosen_id: { $in: dummyUserIds } }),
    MataKuliah.deleteMany({ dosen_id: { $in: dummyUserIds } }),
    Schedule.deleteMany({ dosen_id: { $in: dummyUserIds } })
  ]);

  await Promise.allSettled([
    Kelas.deleteMany({ tahun_ajaran: '2024/2025' }),
    User.deleteMany({ _id: { $in: dummyUserIds } })
  ]);
}

export async function createDummyData() {
  try {
    const seedFlag = String(process.env.ENABLE_DUMMY_DATA || '').toLowerCase();
    const shouldSeed =
      seedFlag === 'true' ||
      (seedFlag === '' && String(process.env.NODE_ENV || 'development').toLowerCase() !== 'production');

    if (!shouldSeed) {
      console.log('Dummy data seeding is disabled (set ENABLE_DUMMY_DATA=true to enable)');
      return;
    }

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

    // Create meetings and schedules for each subject
    // Define semester start date (e.g., roughly 4 months ago to simulate a full semester)
    // Environment date is 2026-01-07, so let's say semester started August 2025 (as requested)
    const semesterStart = new Date('2025-08-04T08:00:00');

    for (let subjectIndex = 0; subjectIndex < 8; subjectIndex++) {
      const mataKuliah = mataKuliahData[subjectIndex];
      const dosen = dosenUsers[subjectIndex];
      
      // Assign a specific weekday for this subject (Mon-Fri) to be realistic
      // subjectIndex 0 -> Mon, 1 -> Tue, 2 -> Wed, 3 -> Thu, 4 -> Fri, 5 -> Mon, etc.
      const dayOffset = (subjectIndex % 5); 
      
      // Create meetings for each class in the subject
      for (const kelasName of mataKuliah.kelas) {
        
        // Generate 14 meetings (14 weeks)
        for (let pertemuanKe = 1; pertemuanKe <= 14; pertemuanKe++) {
          const dataFokus = [];
          
          // Get students from the class
          const kelas = kelasData.find(k => k.nama_kelas === kelasName);
          if (!kelas) continue;
          
          // Determine baseline by subject
          const subjectBaselineMap = {
            'Pemrograman Web': 0.75,
            'Database Management': 0.70,
            'Algoritma dan Struktur Data': 0.65, // Harder subject, lower focus
            'Jaringan Komputer': 0.68,
            'Sistem Informasi Manajemen': 0.78,
            'Rekayasa Perangkat Lunak': 0.74,
            'Analisis dan Perancangan Sistem': 0.72,
            'Mobile Programming': 0.80 // Fun subject, higher focus
          };
          const subjectBaseline = subjectBaselineMap[mataKuliah.nama] ?? 0.72;
          
          // VARIATION LOGIC:
          // 1. Week Trend: Sine wave to simulate "Naik Turun" over the semester
          //    Cycles every ~7 weeks, so 14 weeks has 2 peaks/valleys
          const weekTrend = Math.sin((pertemuanKe / 14) * Math.PI * 3) * 0.12; 
          
          // 2. Class Factor: Slight variation per class
          const kelasFactor = kelasName.includes('A') ? 0.03 : -0.02;
          
          // 3. Daily Random Noise: Weather, mood, etc.
          const dailyNoise = (Math.random() * 0.1) - 0.05;

          // Calculate target probability for this meeting
          let targetProbability = subjectBaseline + weekTrend + kelasFactor + dailyNoise;
          targetProbability = Math.max(0.3, Math.min(0.95, targetProbability)); // Clamp 0.3 - 0.95

          // Random attendance between 20-30
          const attendanceCount = 20 + Math.floor(Math.random() * 11);
          
          // Generate focus data for each student
          for (let mahasiswaIndex = 0; mahasiswaIndex < attendanceCount; mahasiswaIndex++) {
            const mahasiswa = kelas.mahasiswa[mahasiswaIndex];
            
            // Student personal variation
            const studentAbility = (Math.random() * 0.2) - 0.1;
            
            // Generate random focus pattern (12 sessions of 5 minutes each)
            const fokusPattern = [];
            for (let session = 0; session < 12; session++) {
              // Session fatigue: students focus less at the end of class
              const fatigue = session > 8 ? -0.1 : 0;
              
              const sessionChance = targetProbability + studentAbility + fatigue + ((Math.random() * 0.1) - 0.05);
              fokusPattern.push(Math.random() < sessionChance ? 1 : 0);
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

          // Date Calculation: Start Date + (Week * 7) + DayOffset
          // Also add random hour (08:00, 10:00, 13:00)
          const meetingDate = new Date(semesterStart);
          meetingDate.setDate(semesterStart.getDate() + ((pertemuanKe - 1) * 7) + dayOffset);
          
          // Set time
          const startHour = 8 + (subjectIndex % 3) * 3; // 8, 11, 14
          meetingDate.setHours(startHour, 0, 0, 0);

          const jamMulai = `${startHour.toString().padStart(2, '0')}:00`;
          const jamSelesai = `${(startHour + 2).toString().padStart(2, '0')}:00`; // 2 hours duration

          // Create Pertemuan (Historical Data)
          const pertemuan = new Pertemuan({
            tanggal: meetingDate,
            pertemuan_ke: pertemuanKe,
            kelas: kelasName,
            mata_kuliah: mataKuliah.nama,
            mata_kuliah_id: mataKuliah._id,
            dosen_id: dosen._id,
            durasi_pertemuan: 100, // minutes
            topik: `Pertemuan ${pertemuanKe} - ${mataKuliah.nama} - Minggu ${pertemuanKe}`,
            data_fokus: dataFokus,
            catatan: `Catatan pertemuan minggu ke-${pertemuanKe}. Partisipasi siswa ${targetProbability > 0.7 ? 'aktif' : 'cukup'}.`
          });
          
          await pertemuan.save();

          // Create Schedule (Calendar Data) - mirroring the meeting
          // If date is in past, status = completed. If future, scheduled.
          const isPast = meetingDate < new Date();
          
          const schedule = new Schedule({
            kelas_id: kelas._id,
            kelas: kelasName,
            mata_kuliah: mataKuliah.nama,
            mata_kuliah_id: mataKuliah._id,
            dosen_id: dosen._id,
            dosen_name: dosen.nama_lengkap,
            tanggal: meetingDate,
            jam_mulai: jamMulai,
            jam_selesai: jamSelesai,
            durasi: 100,
            pertemuan_ke: pertemuanKe,
            topik: `Materi Minggu ${pertemuanKe} - ${mataKuliah.nama}`,
            ruangan: `R${200 + (subjectIndex % 5)}`,
            status: isPast ? 'completed' : 'scheduled'
          });
          
          await schedule.save();
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
