# Fokus Monitoring YOLO (MERN + Roboflow)

Sistem monitoring fokus mahasiswa berbasis:
- Frontend: React + Vite (TypeScript)
- Backend API: Node.js + Express + MongoDB (Mongoose)
- AI Service:
  - Roboflow Hosted Workflow (utama)
  - Roboflow WebRTC (utama untuk webcam lokal real-time)
  - Python inference runner (legacy / opsional)

Port default saat development:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5002
- Python inference runner (opsional): http://localhost:5001

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
- Mode realtime (opsi A): browser webcam → backend Node proxy → Roboflow WebRTC worker
- Mode snapshot per detik (opsi B): browser capture frame → backend Node → FastAPI proxy → Roboflow Model API
- Workflow Hosted API tetap tersedia untuk kebutuhan workflow image (opsional)
- Python inference runner lokal adalah jalur lama dan tidak lagi menjadi alur utama
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
ROBOFLOW_API_URL=https://serverless.roboflow.com
ROBOFLOW_API_KEY=isi_dengan_api_key
ROBOFLOW_WORKSPACE_NAME=visa-ramadhan
ROBOFLOW_WORKFLOW_ID=fokusdetection-vfocus-rdwkd-logic
ROBOFLOW_IMAGE_INPUT=image
ROBOFLOW_REQUESTED_PLAN=webrtc-gpu-medium
ROBOFLOW_REQUESTED_REGION=us
ROBOFLOW_PROCESSING_TIMEOUT_SEC=3600
ROBOFLOW_STREAM_OUTPUT=output_image
ROBOFLOW_DATA_OUTPUT=focus_monitoring_json,frame_time,people
ROBOFLOW_WORKFLOW_PARAMETERS_JSON={}

# Hanya untuk mode pipeline Python lama / lokal
ROBOFLOW_MODEL_ID=project/version
USE_ROBOFLOW_WORKFLOW=true
```

Catatan:
- Dummy seeding default **nonaktif**. Aktifkan hanya jika dibutuhkan untuk demo awal.
- Untuk production/Vercel, gunakan MongoDB Atlas / URI database publik yang bisa diakses dari cloud.
- `ROBOFLOW_WORKFLOW_PARAMETERS_JSON` dipakai untuk mengirim parameter workflow image/WebRTC tanpa hard-code di frontend/backend.
- Output image dari workflow akan disimpan ke `server/uploads/roboflow/` dan dilayani lewat `/uploads/...`, bukan dikembalikan sebagai base64 besar di response.

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

### 5b) Setup FastAPI (Roboflow Model Proxy)

FastAPI dipakai untuk membungkus Roboflow Model API (endpoint `https://serverless.roboflow.com/<project>/<version>`).

1. Masuk ke folder FastAPI:

```bash
cd server/fastapi_server
```

2. Buat virtual environment (disarankan):

```bash
python -m venv .venv
```

3. Aktifkan venv:
- Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

4. Install dependency:

```bash
pip install -r requirements.txt
```

5. Pastikan env di `project/server/.env` sudah ada:
- `ROBOFLOW_API_URL=https://serverless.roboflow.com`
- `ROBOFLOW_API_KEY=...`
- `ROBOFLOW_MODEL_ID=<project>/<version>` (contoh: `focus-detection/1`)
- Atau jika memakai Workflow API seperti contoh:
  - `ROBOFLOW_WORKFLOW_WORKSPACE=sastyus-workspace`
  - `ROBOFLOW_WORKFLOW_ID=general-segmentation-api-2`
  - `ROBOFLOW_WORKFLOW_CLASSES=fokus, tidak fokus`
- `FASTAPI_URL=http://127.0.0.1:8000` (untuk backend Node, opsional)

6. Jalankan FastAPI:

```bash
uvicorn main:app --host 127.0.0.1 --port 8000
```

Endpoint:
- http://127.0.0.1:8000/health
- http://127.0.0.1:8000/detect

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

Terminal C (FastAPI Roboflow Model Proxy, jika memakai mode snapshot):

```bash
cd project/server/fastapi_server
uvicorn main:app --host 127.0.0.1 --port 8000
```

### 8) Roboflow Webcam / Workflow Smoke Test

Untuk validasi integrasi Roboflow image workflow:

1. Jalankan smoke test:

```bash
cd project/server
npm run smoke:roboflow
```

2. Pastikan env berikut valid di `project/server/.env`:
- `ROBOFLOW_API_KEY`
- `ROBOFLOW_API_URL`
- `ROBOFLOW_WORKSPACE_NAME`
- `ROBOFLOW_WORKFLOW_ID`
- `ROBOFLOW_IMAGE_INPUT`
- `ROBOFLOW_WORKFLOW_PARAMETERS_JSON` (opsional)

Catatan penting:
- smoke test akan menganggap integrasi valid bila:
  - workflow mengembalikan response sukses berbentuk list dengan output keys, atau
  - workflow mengembalikan structured workflow error yang detailnya bisa ditindaklanjuti

### 8b) Roboflow Model API Smoke Test

Untuk validasi koneksi langsung ke Roboflow Model API (tanpa FastAPI):

```bash
cd project/server
npm run smoke:roboflow-model
```

### 9) Webcam lokal dengan Roboflow WebRTC

Live Monitoring sekarang diarahkan ke jalur WebRTC:

1. Jalankan backend:

```bash
cd project/server
npm run dev
```

2. Jalankan frontend:

```bash
cd project
npm run client
```

3. Login, buka halaman Live Monitoring, aktifkan kamera lokal, lalu klik `Start Monitoring`.

Catatan penting:
- status WebRTC dibaca dari backend `/roboflow/webrtc/status`, sehingga frontend tidak lagi mengunci `workspace`, `workflow`, atau output names secara manual
- jika workflow Roboflow sendiri gagal di serverless (mis. step Gemini error), pesan error detail akan diteruskan ke UI

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
- Roboflow WebRTC / Hosted API gagal walau koneksi hidup:
  - Jalankan `cd server && npm run smoke:roboflow`
  - Jika hasil menunjukkan `structured_error`, artinya request sudah sampai ke workflow, tetapi ada kegagalan di definisi workflow Roboflow
  - Contoh yang teramati saat ini: step `scene_activity_check` dari Gemini berhenti karena `max_tokens` di workflow terlalu kecil
