# Debug Session: data-fetch-failed
- **Status**: [OPEN]
- **Issue**: Frontend menampilkan pesan umum "Gagal mengambil data"
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: .dbg/trae-debug-log-data-fetch-failed.ndjson

## Reproduction Steps
1. Buka halaman yang memuat data dari backend.
2. Amati saat UI menampilkan pesan "Gagal mengambil data".
3. Periksa request frontend, respons backend, dan status koneksi database.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Backend route untuk data mengembalikan error 5xx sehingga frontend jatuh ke pesan umum. | High | Low | Pending |
| B | Token auth hilang atau tidak valid sehingga request ditolak sebelum data diambil. | Med | Low | Pending |
| C | Backend hidup tetapi database belum siap, sehingga route data gagal pada middleware/readiness check. | High | Med | Pending |
| D | Frontend memanggil endpoint/proxy yang salah atau service target belum aktif. | Med | Med | Pending |

## Log Evidence
- Frontend `axios` interceptor akan mengirim status request gagal, URL, method, dan pesan respons backend.
- Backend `auth` middleware akan mengirim alasan penolakan token untuk membedakan `401` karena token hilang, token invalid, atau user tidak ditemukan.
- Bukti `pre-fix` terkumpul:
  - `GET /api/users` gagal dengan `503`
  - pesan backend: `Database initializing, please retry shortly`
  - token ada (`hasToken: true`)
- Ini menunjukkan kegagalan Live Monitoring terjadi sebelum data dosen/kelas/jadwal dimuat, dan penyebab dominannya adalah backend belum siap sesaat saat halaman melakukan fetch awal.
- Bukti tambahan setelah reproduksi di Live Monitoring:
  - `GET /api/ai-service/focus/record/status` gagal dengan `503`
  - `POST /api/ai-service/focus/analyze-frame` gagal dengan `503`
  - pesan backend sama: `Database initializing, please retry shortly`
- Ini mengonfirmasi bahwa middleware readiness database ikut memblokir proxy `ai-service`, padahal endpoint AI tidak membutuhkan MongoDB untuk inferensi/polling status.

## Verification Conclusion
- Fix minimal diterapkan di `src/pages/LiveMonitoring.tsx`:
  - fetch `users` dan `jadwal` sekarang retry singkat otomatis jika backend membalas `503 Database initializing`
  - tujuan fix adalah mengatasi kegagalan transien saat backend baru warm-up tanpa mengubah logika bisnis jadwal
- Fix backend diterapkan di `server/app.js`:
  - seluruh path `/ai-service...` kini dilewatkan dari database readiness guard
  - tujuan fix adalah mencegah inferensi AI, polling status, dan route proxy AI lain ikut terblokir oleh status MongoDB
- Validasi statis:
  - `npm run build` sukses setelah perubahan frontend
  - `node --check server/app.js` lolos
