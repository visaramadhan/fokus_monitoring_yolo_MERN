# Fokus Monitoring YOLO (MERN + Flask)

Sistem monitoring fokus mahasiswa berbasis:
- Frontend: React + Vite (TypeScript)
- Backend API: Node.js + Express + MongoDB (Mongoose)
- AI Service: Flask + Ultralytics YOLO (PyTorch)

Port default saat development:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5002
- Flask (YOLO): http://localhost:5001

## Arsitektur Singkat

1) Frontend memanggil API backend melalui proxy Vite:
- `/api/*` → `http://127.0.0.1:5002/*`
- `/flask/*` → `http://127.0.0.1:5001/*`

2) Live Monitoring:
- Video tetap berjalan di elemen `<video>`
- Frame di-capture ke canvas (resize) → dikirim ke Flask → terima JSON deteksi
- Bounding box digambar di overlay canvas di sisi frontend

3) Database:
- Data monitoring tersimpan sebagai data **Pertemuan** dan (untuk Live Monitoring) data **Session Records**
- Jadwal (Schedule) berubah status `scheduled → ongoing → completed`

## Kebutuhan (Prerequisites)

### Wajib
- Node.js (disarankan LTS terbaru)
- npm
- Python 3.10+ (disarankan 3.10/3.11)
- MongoDB lokal (atau MongoDB Atlas)

### Tambahan (untuk AI)
- Library Python pada `server/flask_server/requirements.txt`
- Model YOLO weights `.pt` (lihat bagian “Model YOLO”)

## Setup (Langkah Teknis)

### 1) Clone repo

```bash
git clone https://github.com/visaramadhan/fokus_monitoring_yolo_MERN.git
cd fokus_monitoring_yolo_MERN/project
```

### 2) Install dependency frontend + backend (Node)

Di folder `project`:

```bash
npm install
```

Ini akan menginstall dependency frontend dan juga dependency backend (server) saat menjalankan script dev.

### 3) Siapkan MongoDB

Default backend akan mencoba konek ke:
- `mongodb://127.0.0.1:27017/focus_monitoring`

Jika ingin memakai MongoDB Atlas / custom URI, set environment variable:
- `MONGODB_URI`

Jika tidak ada MongoDB yang bisa diakses, backend tidak akan melayani API (akan merespons 503 “Database initializing…”).

### 4) Siapkan Environment Variables (Backend)

Backend memiliki fallback untuk beberapa variabel, tetapi untuk implementasi yang rapi disarankan membuat `.env` di folder:

`project/server/.env`

Minimal yang disarankan:

```env
PORT=5002
JWT_SECRET=isi_dengan_secret_yang_aman
MONGODB_URI=mongodb://127.0.0.1:27017/focus_monitoring
```

Opsional:

```env
# Seed data dummy (default: false)
ENABLE_DUMMY_DATA=false

# Auto purge saat server start (default: false)
PURGE_ALL_DATA_ON_START=false
PURGE_DUMMY_DATA_ON_START=false

# Fallback Mongo in-memory (default: false)
ENABLE_IN_MEMORY=false
MONGOMS_REQUIRED_FREE_BYTES=800000000
```

Catatan:
- Dummy seeding default **nonaktif**. Aktifkan hanya jika dibutuhkan untuk demo awal.

### 5) Setup Flask (YOLO)

Masuk ke folder Flask:

```bash
cd server/flask_server
```

Buat virtual environment (disarankan):

```bash
python -m venv .venv
```

Aktifkan venv:
- Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install dependency:

```bash
pip install -r requirements.txt
```

Jalankan Flask:

```bash
python app.py
```

Health check:
- http://localhost:5001/health

### 6) Model YOLO (.pt)

Flask akan mencoba memuat model default dari folder:

`project/server/uploads/models/`

Pastikan ada file weights `.pt` di folder tersebut. Implementasi saat ini memilih salah satu kandidat default (lihat fungsi `_select_default_object_model_path()` pada `server/flask_server/app.py`).

Rekomendasi untuk implementasi cepat:
- Letakkan file model `.pt` di `project/server/uploads/models/`
- Jika nama file tidak sama dengan kandidat default, ubah kandidat path di `app.py` agar menunjuk ke model yang kamu pakai.

### 7) Jalankan sistem (Development)

Terminal A (Node: backend + frontend sekaligus):

```bash
cd project
npm run dev
```

Terminal B (Flask YOLO):

```bash
cd project/server/flask_server
python app.py
```

Buka:
- Frontend: http://localhost:5173

## Alur Monitoring (Singkat)

### Manual Monitoring
- Admin: pilih Dosen → Mata Kuliah → Kelas → Jadwal (Hari Ini) → buat layout → Start → Stop → Save to Database
- Dosen: pilih Mata Kuliah → Kelas → Jadwal (Hari Ini) → buat layout → Start → Stop → Save to Database

### Live Monitoring
- Admin: pilih Dosen → Mata Kuliah → Kelas → Jadwal (Hari Ini) → Start → Stop & Export
- Dosen: pilih Mata Kuliah → Kelas → Jadwal (Hari Ini) → Start → Stop & Export

Aturan jadwal:
- Monitoring hanya boleh dilakukan pada tanggal jadwal
- Saat start: jadwal jadi `ongoing` (hilang dari list “available”)
- Saat selesai/save/export: jadwal jadi `completed` (tidak muncul lagi)

## Lokasi Data Hasil

Setelah Save (Manual) atau Stop & Export (Live), data akan terlihat di:
- Meetings (rekap global pertemuan)
- Detail Mata Kuliah (rekap per mata kuliah)
- Detail Kelas (rekap per kelas)
- Halaman Jadwal (status berubah scheduled/ongoing/completed)

## Troubleshooting

- Flask status “disconnected” di Live Monitoring:
  - Pastikan Flask berjalan di port 5001
  - Buka `http://localhost:5001/health`
- API error 503 “Database initializing…”:
  - Pastikan MongoDB berjalan atau `MONGODB_URI` valid
  - Cek `http://localhost:5002/db/status`
- Tidak ada jadwal muncul saat monitoring:
  - Jadwal yang muncul hanya status `scheduled` dan tanggal “hari ini”
  - Pastikan memilih dosen (admin) lalu mata kuliah dan kelas terlebih dulu

