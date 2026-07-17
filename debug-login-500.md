# Debug Session: login-500

Status: [OPEN]

## Symptom
- Endpoint `POST /api/auth/login` gagal di server deployed dengan HTTP 500.

## Expected
- Login mengembalikan token / user info atau error validasi yang terkontrol, bukan 500.

## Hypotheses
1. Koneksi MongoDB di environment server gagal sehingga route auth melempar exception saat query user.
2. Environment variable penting untuk auth atau database di server tidak terpasang atau nilainya salah.
3. Model `User` atau proses seed/fallback berjalan berbeda antara local dan server deployment.
4. Middleware / startup app di server tidak me-mount route atau dependency auth dengan benar setelah perubahan Roboflow/FastAPI.
5. Ada exception runtime spesifik di route `auth/login` yang belum terlihat karena logging server kurang informatif.

## Evidence Plan
- Baca implementasi login, startup app, dan konfigurasi DB/auth saat ini.
- Tambahkan instrumentasi minimal di jalur login dan koneksi DB bila perlu.
- Minta / cek log runtime server untuk membuktikan hipotesis.

## Current Evidence
- `api/index.js` di deploy path memanggil `initDatabase()` lalu meneruskan request ke Express app.
- `server/app.js` dan `server/routes/auth.js` sama-sama mengembalikan `503` saat DB belum ready, jadi `500` mengarah ke exception di dalam handler login atau adapter deploy.
- Seeding dummy user default hanya aktif di non-production, jadi akun `admin/admin123` tidak otomatis ada di server production kecuali `ENABLE_DUMMY_DATA=true`.
- Instrumentasi sudah ditambahkan di `api/index.js` dan `server/routes/auth.js` untuk menangkap route, status DB, hasil lookup user, dan stack error.

## Notes
- Belum ada perubahan logic bisnis; baru instrumentasi runtime.
