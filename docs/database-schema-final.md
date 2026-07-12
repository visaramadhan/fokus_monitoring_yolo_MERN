# Database Schema Final

Dokumen ini menjadi acuan relasi final untuk fitur akademik dan monitoring pada sistem `fokus_monitoring_yolo_MERN`.

## Prinsip Desain

- `Jadwal` adalah pusat relasi akademik.
- `LiveSession` adalah artefak runtime saat monitoring sedang berjalan.
- `Pertemuan` dan `SessionRecord` adalah hasil final dari sesi monitoring.
- Field berbasis nama seperti `kelas`, `mata_kuliah`, dan `dosen_name` dipertahankan sementara sebagai snapshot tampilan, bukan sumber relasi utama.

## Relasi Utama

- `User (dosen)` 1..N `MataKuliah`
- `User (dosen)` 1..N `Jadwal`
- `Kelas` 1..N `Jadwal`
- `MataKuliah` 1..N `Jadwal`
- `Jadwal` 1..N `LiveSession`
- `Jadwal` 1..N `Pertemuan`
- `Jadwal` 1..N `SessionRecord`
- `LiveSession` 1..1 `Pertemuan`
- `LiveSession` 1..1 `SessionRecord`

## Model Final

### `User`

- `_id`: `ObjectId`
- `username`: `String`
- `email`: `String`
- `password`: `String`
- `role`: `String` (`dosen`, `admin`)
- `nama_lengkap`: `String`
- `nip`: `String`
- `departemen`: `String`
- `avatar`: `String`

### `Kelas`

- `_id`: `ObjectId`
- `nama_kelas`: `String`
- `mahasiswa[]`
- `jumlah_mahasiswa`: `Number`
- `tahun_ajaran`: `String`
- `semester`: `String`

### `MataKuliah`

- `_id`: `ObjectId`
- `nama`: `String`
- `kode`: `String`
- `sks`: `Number`
- `dosen_id`: `ObjectId -> User`
- `semester`: `Number`
- `deskripsi`: `String`
- `kelas`: `String[]`

Catatan:
- `kelas` dipertahankan sementara untuk kompatibilitas data lama.
- Relasi final mata kuliah ke kelas sebaiknya dibaca melalui `Jadwal`, bukan dari `kelas[]`.

### `Schedule`

- `_id`: `ObjectId`
- `kelas_id`: `ObjectId -> Kelas`
- `kelas`: `String`
- `mata_kuliah_id`: `ObjectId -> MataKuliah`
- `mata_kuliah`: `String`
- `dosen_id`: `ObjectId -> User`
- `dosen_name`: `String`
- `tanggal`: `Date`
- `jam_mulai`: `String`
- `jam_selesai`: `String`
- `durasi`: `Number`
- `pertemuan_ke`: `Number`
- `topik`: `String`
- `ruangan`: `String`
- `status`: `String`
- `seat_positions[]`

### `LiveSession`

- `_id`: `ObjectId`
- `sessionId`: `String`
- `jadwal_id`: `ObjectId -> Schedule`
- `kelas_id`: `ObjectId -> Kelas`
- `kelas`: `String`
- `mata_kuliah_id`: `ObjectId -> MataKuliah`
- `mata_kuliah`: `String`
- `dosen_id`: `ObjectId -> User`
- `startTime`: `Date`
- `endTime`: `Date`
- `isActive`: `Boolean`
- `state`: `Mixed`
- `detectionData[]`
- `summary`

### `Pertemuan`

- `_id`: `ObjectId`
- `sessionId`: `String`
- `jadwal_id`: `ObjectId -> Schedule`
- `live_session_id`: `ObjectId -> LiveSession`
- `kelas_id`: `ObjectId -> Kelas`
- `kelas`: `String`
- `mata_kuliah_id`: `ObjectId -> MataKuliah`
- `mata_kuliah`: `String`
- `dosen_id`: `ObjectId -> User`
- `tanggal`: `Date`
- `pertemuan_ke`: `Number`
- `durasi_pertemuan`: `Number`
- `topik`: `String`
- `data_fokus[]`
- `hasil_akhir_kelas`

### `SessionRecord`

- `_id`: `ObjectId`
- `sessionId`: `String`
- `live_session_id`: `ObjectId -> LiveSession`
- `jadwal_id`: `ObjectId -> Schedule`
- `kelas_id`: `ObjectId -> Kelas`
- `kelas`: `String`
- `mata_kuliah_id`: `ObjectId -> MataKuliah`
- `mata_kuliah`: `String`
- `dosen_id`: `ObjectId -> User`
- `tanggal`: `Date`
- `jam_mulai`: `Date`
- `jam_selesai`: `Date`
- `durasi`: `Number`
- `seat_data[]`
- `detection_summary`
- `gesture_analysis[]`

## Langkah Refactor

1. Tambah foreign key baru tanpa menghapus field lama.
2. Ubah endpoint backend agar mengisi foreign key baru secara otomatis.
3. Ubah frontend agar mengirim `jadwal_id` dan identifier relasional lain.
4. Setelah data baru stabil, siapkan migrasi data lama.
5. Baru kemudian hapus ketergantungan penuh pada field string lama.

## Menjalankan Migrasi

Jalankan dari folder `server`.

Dry-run:

```bash
npm run migrate:relations:dry
```

Apply perubahan ke database:

```bash
npm run migrate:relations
```

Perilaku script:

- Mengisi `kelas_id` pada `Schedule`, `LiveSession`, `Pertemuan`, dan `SessionRecord`
- Mengisi `jadwal_id` pada `LiveSession`, `Pertemuan`, dan `SessionRecord`
- Mengisi `live_session_id` pada `Pertemuan` dan `SessionRecord`
- Mengisi `mata_kuliah_id` pada `SessionRecord` bila masih kosong
- Berusaha mencocokkan data berdasarkan `sessionId`, `mata_kuliah_id`, `dosen_id`, `kelas`, `tanggal`, dan `pertemuan_ke`
