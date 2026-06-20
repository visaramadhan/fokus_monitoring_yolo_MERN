# Fokus Monitoring YOLO (MERN + Roboflow/Flask)

Sistem monitoring fokus mahasiswa berbasis:
- Frontend: React + Vite (TypeScript)
- Backend API: Node.js + Express + MongoDB (Mongoose)
- AI Service:
  - Flask + Ultralytics YOLO (legacy/local)
  - Roboflow Workflow / Python inference runner (opsional, untuk live pipeline)

Port default saat development:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5002
- Flask (YOLO): http://localhost:5001

## Arsitektur Singkat

1) Saat development, frontend memanggil API backend melalui proxy Vite:
- `/api/*` → `http://127.0.0.1:5002/*`
- `/flask/*` → `http://127.0.0.1:5001/*`

2) Saat production di Vercel, frontend dan backend bisa berjalan dalam **satu project yang sama**:
- Frontend build dari Vite
- Backend Node/Express diekspos lewat function `api/[...route].js`
- Frontend tetap memanggil `/api/*` pada domain yang sama

3) Live Monitoring:
- Video tetap berjalan di elemen `<video>`
- Mode legacy: frame di-capture → dikirim ke Flask → terima JSON deteksi
- Mode pipeline: inference runner / workflow Roboflow mengirim hasil ke backend
- Bounding box / hasil deteksi dirender di sisi frontend

4) Database:
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

# Live pipeline / inference runner
INFERENCE_URL=http://127.0.0.1:5001
EXPRESS_URL=http://127.0.0.1:5002
INFERENCE_PORT=5001
ROBOFLOW_API_KEY=isi_dengan_api_key
ROBOFLOW_MODEL_ID=project/version
USE_ROBOFLOW_WORKFLOW=true
ROBOFLOW_WORKFLOW_URL=https://serverless.roboflow.com/infer/workflows/visa-ramadhan/detect-and-classify
```

Catatan:
- Dummy seeding default **nonaktif**. Aktifkan hanya jika dibutuhkan untuk demo awal.
- Untuk production/Vercel, gunakan MongoDB Atlas / URI database publik yang bisa diakses dari cloud.

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

### 8) Live Pipeline Roboflow (Opsional)

Jika ingin memakai mode pipeline/Roboflow:

1. Jalankan backend:

```bash
cd project
npm run dev
```

2. Jalankan Python inference runner:

```bash
cd project/server
python inference_runner.py
```

3. Pastikan env berikut valid di `project/server/.env`:
- `ROBOFLOW_API_KEY`
- `ROBOFLOW_MODEL_ID` atau `ROBOFLOW_WORKFLOW_URL`
- `INFERENCE_URL`
- `EXPRESS_URL`

Catatan penting:
- mode live pipeline berbasis Python ini **cocok untuk lokal/dev**
- proses long-running inference **tidak cocok dijalankan penuh di Vercel serverless**

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

## Deploy Vercel (Satu Repo, FE + BE)

Project ini sudah disesuaikan agar frontend dan backend Node bisa dideploy dalam **satu project Vercel** dari repo yang sama:

- frontend: React + Vite
- backend: Express melalui `api/[...route].js`
- rewrite SPA: `vercel.json`

### Build Settings

Gunakan project root:

```text
project
```

Build command:

```bash
npm run build
```

Output directory:

```text
dist
```

### Environment Variables Vercel

Wajib:

```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=isi_dengan_secret_yang_aman
```

Disarankan:

```env
ENABLE_DUMMY_DATA=false
ENABLE_IN_MEMORY=false
```

Jangan isi jika ingin frontend memakai same-origin API pada project Vercel yang sama:

```env
VITE_API_BASE_URL=
```

Catatan:
- jika `VITE_API_BASE_URL` diisi placeholder/salah, browser bisa error `ERR_NAME_NOT_RESOLVED`
- jika frontend memanggil API domain yang salah, request bisa berakhir `404` atau `405`
- backend Express pada Vercel tetap membutuhkan `MONGODB_URI` yang valid

### Batasan di Vercel

Yang cocok:
- auth/login/register
- dashboard
- users / classes / subjects / meetings / jadwal
- export dan API CRUD biasa

Yang tidak cocok dijalankan penuh di Vercel serverless:
- Python inference runner long-running
- kamera live processing lokal
- proses live monitoring yang butuh worker persisten

Untuk fitur live inference, gunakan service terpisah atau jalankan inference runner secara lokal / pada server terpisah.

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
- Vercel `ERR_NAME_NOT_RESOLVED` pada `/api/...`:
  - Pastikan `VITE_API_BASE_URL` tidak diisi placeholder seperti `url_backend_kamu`
  - Jika FE dan BE satu project Vercel, kosongkan `VITE_API_BASE_URL`
- Vercel `404` / `405` pada endpoint API:
  - Pastikan deploy sudah memakai file `vercel.json`
  - Pastikan request menuju `/api/...` pada domain project yang sama
  - Pastikan backend function berhasil build dan `MONGODB_URI` valid
- Live pipeline tidak menghasilkan deteksi:
  - Cek `http://localhost:5001/status`
  - Periksa `pipeline_error`, `last_workflow_error`, dan `camera_read_failures`
