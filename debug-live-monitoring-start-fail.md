# Debug Session: live-monitoring-start-fail

- Status: OPEN
- Symptom: Live monitoring gagal memulai. User juga mengharapkan preview layar dan tabel timestamp, tetapi UI saat ini tidak menampilkannya.
- Expected: Monitoring bisa dimulai, preview tampil, dan ada section tabel timestamp.

## Hipotesis

1. Payload `POST /api/live-monitoring/start` tidak cocok dengan kebutuhan backend.
2. Data jadwal yang dipilih tidak mengandung field relasi yang dibutuhkan backend.
3. `LiveMonitoring.tsx` yang aktif sudah tergantikan versi sederhana sehingga preview dan tabel timestamp memang tidak dirender.
4. Route AI service yang dipanggil frontend tidak cocok dengan proxy/backend yang aktif.
5. Start session berhasil, tetapi gagal di langkah berikutnya saat memulai recording AI service.

## Rencana Evidence

1. Baca implementasi frontend `LiveMonitoring.tsx`.
2. Baca route backend `liveMonitoring` dan `aiServiceProxy`.
3. Cocokkan payload request frontend vs kebutuhan backend.
4. Verifikasi gejala UI hilangnya preview dan tabel timestamp dari kode render aktif.
5. Setelah akar masalah terbukti, baru lakukan patch minimal.

## Evidence Terkumpul

1. Frontend aktif `LiveMonitoring.tsx` memang versi sederhana dan tidak merender preview kamera ataupun tabel timestamp.
2. Request runtime `POST /api/ai-service/focus/record/start` gagal `404` karena Vite me-rewrite `/api/*` menjadi `/*`, sedangkan Express mendaftarkan route AI service di `/api/ai-service`.
3. Konfigurasi backend `server/.env` masih menunjuk `AI_SERVICE_URL=http://127.0.0.1:7861`, padahal FastAPI aktif di `8001`.
4. Setelah patch route Express dan port `AI_SERVICE_URL`, endpoint `http://127.0.0.1:5002/ai-service/health` merespons `{"status":"ok"}`.
5. Verifikasi user setelah patch menyatakan gejala berubah menjadi `gagal login`, sejalan dengan log backend yang masih gagal konek MongoDB Atlas lalu fallback ke in-memory MongoDB.
