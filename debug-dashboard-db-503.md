[OPEN] Debug Session: dashboard-db-503

## Ringkasan Masalah
- Gejala: frontend dashboard menampilkan `503` untuk overview, classes, subjects, dan focus trends.
- Pesan UI: `Database Belum Siap` / `Database initializing, please retry shortly`.
- Area terdampak: `Dashboard`, fetch kelas, fetch mata kuliah, fetch tren fokus.

## Hipotesis
1. Middleware readiness database masih memblokir route dashboard/kelas/mata kuliah saat startup.
2. Status koneksi MongoDB backend memang belum mencapai `connected`.
3. Frontend memanggil endpoint terlalu cepat sebelum backend menyatakan database siap.
4. Guard database terlalu agresif sehingga route yang semestinya boleh lewat tetap terkena `503`.

## Rencana Bukti
1. Identifikasi middleware/route yang menghasilkan pesan `Database initializing`.
2. Tambahkan instrumentasi minimal pada titik guard database dan route terkait.
3. Reproduksi request dashboard dan amati log runtime.
4. Tentukan akar masalah berdasarkan bukti lalu terapkan perbaikan minimal.

## Bukti Runtime
- Sumber `503` ditemukan di guard global `server/app.js` yang mengembalikan `Database initializing, please retry shortly` saat `mongoose.connection.readyState !== 1`.
- Log debug menunjukkan startup masuk dengan `readyState: 0` lalu baru menjadi `readyState: 1` setelah koneksi Atlas selesai:
  - `server/app.js:initDatabase:entry`
  - `server/app.js:initDatabase:connectAttempt`
  - `server/app.js:initDatabase:connectSuccess`
- Uji langsung ke backend aktif `http://127.0.0.1:5002/db/status` menghasilkan `{"readyState":1,"stateText":"connected"}`.
- Uji langsung ke `http://127.0.0.1:5002/dashboard/overview` setelah backend siap menghasilkan `401`, bukan `503`, yang menandakan route dashboard sendiri sehat saat DB sudah ready.

## Kesimpulan Sementara
- Hipotesis 1 terbukti: guard readiness database memang bisa memblokir route dashboard.
- Hipotesis 2 tidak terbukti sebagai kondisi permanen: DB aktif saat diuji.
- Hipotesis 3 paling kuat: ada race saat startup, karena server menerima request sebelum koneksi DB selesai.
- Hipotesis 4 tidak dominan: masalah bukan route dashboard spesifik, tetapi bootstrap server.

## Fix Minimal
- `server/server.js` diubah agar `server.listen(...)` hanya dijalankan setelah `await initDatabase()` selesai dan `mongoose.connection.readyState === 1`.
- Jika database tetap tidak siap setelah bootstrap, proses server dihentikan dengan exit code non-zero agar tidak hidup dalam kondisi selalu membalas `503`.

## Verifikasi
- Pre-fix reproduction: request dashboard pengguna dapat menerima `503 Database initializing`.
- Post-fix reproduction pada server uji port `5005`:
  - sebelum DB siap: `ERR CONNECT Unable to connect to the remote server`
  - setelah DB siap: `ERR 401 {"message":"No token, authorization denied"}`
- Tidak ada lagi fase `503 Database initializing` setelah server mulai menerima request.
