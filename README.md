# Fokus Monitoring YOLO MERN

Sistem ini adalah aplikasi monitoring fokus siswa/mahasiswa berbasis kamera yang menggabungkan:
- frontend `React + Vite + TypeScript`
- backend `Node.js + Express + MongoDB`
- AI service `Python + FastAPI + Gradio + MediaPipe/OpenCV`

Fungsi utamanya adalah mengelola data akademik, menjalankan live monitoring dari kamera browser, menyimpan hasil deteksi fokus ke database, lalu menampilkan rekap dan export laporan dalam format `Excel` dan `PDF`.

## Ringkasan Sistem

Arsitektur proyek dibagi menjadi 4 lapisan utama:

1. `Frontend`
   - Menampilkan UI login, dashboard, master data, jadwal, monitoring, dan rekap.
   - Mengakses kamera browser dengan `getUserMedia`.
   - Mengirim request ke backend dengan `axios`.

2. `Backend API`
   - Menangani autentikasi JWT, CRUD data akademik, dashboard, export, dan orkestrasi monitoring.
   - Menjadi penghubung antara frontend, database MongoDB, dan AI service.

3. `AI Service`
   - Menerima frame kamera dalam bentuk base64.
   - Menjalankan analisis fokus per frame.
   - Menghasilkan `metrics`, `annotated image`, `record events`, dan `summary`.

4. `Database`
   - Menyimpan data user, kelas, mata kuliah, jadwal, sesi live, dan hasil akhir monitoring pada koleksi `Pertemuan`.

## Port Development

- Frontend: `http://localhost:5173`
- Backend Express: `http://localhost:5002`
- AI Service Python: `http://localhost:7861`

## Cara Kerja Singkat

1. User login dari frontend.
2. Frontend mengakses backend melalui `/api/*`.
3. Vite mem-proxy `/api/*` ke backend Express `5002`.
4. Saat live monitoring:
   - browser membuka kamera dengan `navigator.mediaDevices.getUserMedia`
   - video ditampilkan lokal di elemen `<video>`
   - frontend mengambil snapshot frame dari `<canvas>`
   - frame dikirim ke backend `/api/ai-service/focus/analyze-frame`
   - backend meneruskan ke AI service Python
   - AI service mengembalikan hasil deteksi dan preview beranotasi
5. Saat monitoring dihentikan:
   - AI service mengembalikan `events` dan `summary`
   - backend menyimpan rekap ke MongoDB sebagai data `Pertemuan`
   - jadwal diubah dari `scheduled/ongoing` menjadi `completed`

## Fitur Utama

- Login dan autentikasi JWT
- Role `admin` dan `dosen`
- Dashboard rekap performa monitoring
- Manajemen `Users`
- Manajemen `Kelas`
- Manajemen `Mata Kuliah`
- Manajemen `Jadwal`
- Halaman `Meetings` dan `Meeting Detail`
- Live Monitoring dengan kamera browser
- Preview hasil AI langsung di layar
- Timestamp table / record events selama monitoring
- Rekap hasil monitoring per pertemuan
- Rekap per kelas
- Rekap per mata kuliah
- Export `Excel`
- Export `PDF`
- Filter tahun pada halaman list dan rekap
- Pilihan rentang rekap untuk export laporan

## Halaman Yang Tersedia

- `Login`
- `Dashboard`
- `Users`
- `Classes`
- `Subjects`
- `Jadwal`
- `Meetings`
- `Meeting Detail`
- `Class Detail`
- `Subject Detail`
- `Live Monitoring`
- `Manual Monitoring`
- `Profile`
- `Settings`

## Struktur Folder Penting

```text
fokus_monitoring_yolo_MERN/
├── src/                     # frontend React + Vite
├── server/
│   ├── ai-service/          # AI service Python
│   ├── models/              # model Mongoose
│   ├── routes/              # route Express
│   ├── uploads/             # file upload / model
│   ├── app.js               # init express app
│   └── server.js            # bootstrap server backend
├── api/                     # entry serverless / integrasi deploy
├── README.md
└── package.json
```

## Kebutuhan Sistem

### Wajib

- `Node.js` versi LTS terbaru
- `npm`
- `Python` 3.10 atau 3.11
- `MongoDB` lokal atau `MongoDB Atlas`
- Browser modern yang mendukung `getUserMedia`

### Disarankan

- Windows 10/11
- Kamera webcam aktif
- Koneksi internet stabil jika menggunakan MongoDB Atlas

## Library Yang Digunakan

### Frontend

Dependensi utama dari [package.json](file:///c:/Users/LENOVO/Documents/fokus_monitoring_yolo_MERN/package.json):

- `react`
- `react-dom`
- `react-router-dom`
- `axios`
- `framer-motion`
- `lucide-react`
- `react-hook-form`
- `recharts`
- `jwt-decode`
- `jspdf`
- `jspdf-autotable`
- `xlsx`

Tooling frontend:

- `vite`
- `typescript`
- `tailwindcss`
- `eslint`

### Backend

Dependensi utama dari [server/package.json](file:///c:/Users/LENOVO/Documents/fokus_monitoring_yolo_MERN/server/package.json):

- `express`
- `mongoose`
- `jsonwebtoken`
- `bcryptjs`
- `axios`
- `cors`
- `dotenv`
- `exceljs`
- `pdfkit`
- `multer`
- `mongodb-memory-server`
- `check-disk-space`

### AI Service Python

Dependensi utama dari [requirements.txt](file:///c:/Users/LENOVO/Documents/fokus_monitoring_yolo_MERN/server/ai-service/requirements.txt):

- `gradio`
- `mediapipe`
- `opencv-python`
- `numpy`
- `scikit-learn`
- `joblib`
- `openpyxl`

Tambahan runtime:

- `fastapi`
- `uvicorn`
- `pydantic`

## Setup Environment

Buat file `.env` di folder `server/`.

Contoh minimal:

```env
PORT=5002
MONGODB_URI=mongodb://127.0.0.1:27017/focus_monitoring
JWT_SECRET=isi_dengan_secret_yang_aman
AI_SERVICE_URL=http://127.0.0.1:7861
```

Contoh yang umum dipakai pada proyek ini:

```env
PORT=5002
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/student-focus-monitoring?retryWrites=true&w=majority
JWT_SECRET=rahasia_negara_123
AI_SERVICE_URL=http://127.0.0.1:7861
INFERENCE_URL=http://127.0.0.1:5001
EXPRESS_URL=http://127.0.0.1:5002
INFERENCE_PORT=5001
USE_ROBOFLOW_WORKFLOW=true
```

Catatan:

- `AI_SERVICE_URL` harus sesuai dengan port AI service Python.
- Jika backend tidak bisa connect ke DB, API akan gagal sampai database siap.
- Untuk development lokal, MongoDB Atlas lebih praktis jika tidak menjalankan MongoDB lokal.

## Cara Install

### 1. Clone Repository

```bash
git clone https://github.com/visaramadhan/fokus_monitoring_yolo_MERN.git
cd fokus_monitoring_yolo_MERN
```

### 2. Install Dependensi Frontend

Di root project:

```bash
npm install
```

### 3. Install Dependensi Backend

Masuk ke folder backend:

```bash
cd server
npm install
cd ..
```

### 4. Install Dependensi AI Service Python

Masuk ke folder AI service:

```bash
cd server/ai-service
python -m venv .venv
```

Aktifkan virtual environment:

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Jika muncul error `Activate.ps1 is not recognized`, artinya virtual environment belum terbentuk di folder `server/ai-service` atau terminal sedang berada di folder yang salah.

Pastikan urutannya seperti ini:

```powershell
cd server/ai-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Catatan penting:

- Virtual environment lama yang ada di `server/fastapi_server/.venv` adalah sisa struktur lama dan bukan environment utama untuk service yang aktif sekarang.
- Jika tidak ingin memakai virtual environment, Anda tetap bisa menjalankan AI service dengan Python global setelah menginstall dependency yang dibutuhkan.

Install dependency:

```bash
pip install -r requirements.txt
pip install fastapi uvicorn pydantic
```

Kembali ke root project setelah selesai.

## Cara Menjalankan Sistem

Sistem dijalankan dengan 3 terminal terpisah.

### Terminal 1: Backend Express

```bash
cd server
npm run start
```

Atau untuk mode watch:

```bash
cd server
npm run dev
```

### Terminal 2: Frontend React

```bash
npm run client
```

Atau jalankan frontend + backend sekaligus dari root:

```bash
npm run dev
```

Catatan:

- `npm run dev` di root menjalankan frontend dan backend.
- AI service tetap harus dijalankan terpisah.

### Terminal 3: AI Service Python

```bash
cd server/ai-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python app.py
```

Alternatif:

```bash
cd server/ai-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
uvicorn app:app --host 0.0.0.0 --port 7861
```

Jika `.venv` sudah pernah dibuat sebelumnya, langkah `python -m venv .venv` cukup dijalankan sekali saja.

## Cara Mengecek Bahwa Semua Service Sudah Aktif

- Frontend aktif: buka `http://localhost:5173`
- Backend aktif: buka `http://localhost:5002/health`
- Status database backend: buka `http://localhost:5002/db/status`
- AI service aktif: buka `http://localhost:7861/health`
- UI Gradio AI service: buka `http://localhost:7861/gradio`

## Akun Login Default

Untuk development, akun yang biasa tersedia:

- `admin` / `admin123`
- `dosen1` / `NIP dosen`

Jika seed data berbeda di database Anda, sesuaikan dengan data yang tersimpan.

## Cara Menggunakan Sistem

### 1. Login

1. Buka aplikasi frontend.
2. Masukkan username dan password.
3. Setelah login, sistem akan mengarahkan ke dashboard.

### 2. Kelola Data Master

Sebelum monitoring, pastikan data berikut sudah tersedia:

- `Users`
- `Kelas`
- `Mata Kuliah`
- `Jadwal`

Urutan yang disarankan:

1. Tambahkan user dosen
2. Tambahkan kelas
3. Tambahkan mata kuliah
4. Buat jadwal sesuai dosen, kelas, dan mata kuliah

### 3. Jalankan Live Monitoring

1. Masuk ke halaman `Live Monitoring`
2. Jika login sebagai `admin`, pilih dosen
3. Pilih kelas
4. Pilih jadwal yang tersedia untuk hari ini
5. Pilih kamera
6. Klik `Buka Kamera`
7. Pastikan preview kamera tampil
8. Klik `Mulai Monitoring`
9. Sistem mulai mengirim frame ke AI service
10. Lihat:
   - preview hasil AI
   - jumlah orang
   - focused / not focused
   - timestamp table
11. Klik `Selesaikan Monitoring`
12. Sistem menyimpan hasil ke database dan menyiapkan rekap

### 4. Unduh Laporan

Setelah monitoring selesai:

- klik `Unduh Excel` pada halaman monitoring, atau
- buka halaman detail kelas / mata kuliah / meeting lalu export `PDF` atau `Excel`

### 5. Lihat Rekap

Rekap dapat dilihat dari:

- `Meetings`
- `Meeting Detail`
- `Class Detail`
- `Subject Detail`
- `Jadwal`
- `Dashboard`

## Aturan Monitoring

- Kamera harus aktif sebelum monitoring dimulai
- Jadwal harus dipilih terlebih dahulu
- Jadwal yang bisa dimonitor hanya jadwal yang valid untuk hari ini
- Saat monitoring dimulai, status jadwal berubah menjadi `ongoing`
- Saat monitoring selesai, status jadwal berubah menjadi `completed`
- Hasil monitoring disimpan ke `Pertemuan`

## Fitur Filter Dan Rekap

Sistem saat ini sudah mendukung:

- filter tahun pada halaman `Classes`
- filter tahun pada halaman `Subjects`
- filter tahun pada halaman `Meetings`
- filter tahun pada halaman `Jadwal`
- filter tahun / rentang rekap pada `Dashboard`
- rentang rekap `Semua Data`, `Per Tahun`, dan `Rentang Tanggal` untuk export laporan tertentu

## Export Yang Tersedia

- `Excel` dari hasil live monitoring
- `PDF` rekap kelas
- `PDF` rekap mata kuliah
- `Excel` rekap kelas
- `Excel` rekap mata kuliah

Beberapa export mendukung:

- `Semua Data`
- `Per Tahun`
- `Rentang Tanggal`

## Alur Data Monitoring

Berikut alur data live monitoring:

1. Kamera dibuka di browser
2. Video tampil di elemen `<video>`
3. Frontend mengambil frame dengan `<canvas>`
4. Frame diubah menjadi base64 JPEG
5. Frame dikirim ke backend `/api/ai-service/focus/analyze-frame`
6. Backend meneruskan ke AI service Python
7. AI service menganalisis frame
8. AI service mengembalikan:
   - `metrics`
   - `annotated image`
   - `people count`
   - `status fokus`
9. Frontend menampilkan hasil secara real-time
10. Saat stop, backend menyimpan hasil akhir ke MongoDB

## Cara Kerja Kamera

Sistem kamera memakai API browser native:

- daftar kamera diambil dengan `navigator.mediaDevices.enumerateDevices()`
- akses kamera dilakukan dengan `navigator.mediaDevices.getUserMedia()`
- stream kamera ditempel ke elemen `<video>`
- frame video digambar ke `<canvas>` secara berkala
- hasil canvas dikirim ke AI service untuk dianalisis

Artinya:

- video asli tetap lokal di browser
- yang dikirim ke AI adalah snapshot frame, bukan stream mentah penuh

## Daftar Endpoint Penting

### Backend

- `GET /health`
- `GET /db/status`
- `POST /auth/login`
- `GET /dashboard/overview`
- `GET /kelas`
- `GET /mata-kuliah`
- `GET /jadwal`
- `GET /pertemuan`
- `POST /live-monitoring/start`
- `POST /live-monitoring/stop/:sessionId`

### AI Service

- `GET /health`
- `POST /focus/analyze-frame`
- `POST /focus/record/start`
- `POST /focus/record/stop`
- `GET /focus/record/status`
- `GET /focus/record/export`
- `GET /gradio`

## Troubleshooting

### Frontend tidak bisa dibuka

- Pastikan frontend berjalan di `5173`
- jalankan `npm run client`

### Backend error atau API gagal

- pastikan backend berjalan di `5002`
- cek `http://localhost:5002/health`

### Database belum siap

- cek `http://localhost:5002/db/status`
- pastikan `MONGODB_URI` valid
- pastikan koneksi internet stabil jika memakai MongoDB Atlas

### AI service tidak merespons

- pastikan AI service berjalan di `7861`
- cek `http://localhost:7861/health`
- pastikan `AI_SERVICE_URL` pada `.env` backend sesuai

### Kamera tidak muncul

- izinkan akses kamera pada browser
- cek apakah kamera sedang dipakai aplikasi lain
- refresh halaman lalu buka kamera kembali

### Jadwal tidak bisa dipilih

- hanya jadwal valid yang bisa dimonitor
- jadwal lama akan tampil sebagai `Done`
- jadwal masa depan tampil pudar dan tidak bisa dipilih

### Export gagal

- pastikan backend aktif
- pastikan data monitoring sudah tersimpan
- ulangi setelah monitoring dihentikan dengan benar

## Catatan Deploy

Untuk development lokal, jalankan frontend, backend, dan AI service secara terpisah.

Untuk deploy production:

- frontend dan backend dapat digabung dalam satu repo
- AI service Python sebaiknya dijalankan sebagai service terpisah
- pastikan database production memakai MongoDB Atlas atau database yang dapat diakses publik

## Ringkas Perintah Penting

Install frontend:

```bash
npm install
```

Install backend:

```bash
cd server
npm install
```

Jalankan frontend:

```bash
npm run client
```

Jalankan frontend + backend:

```bash
npm run dev
```

Jalankan backend saja:

```bash
cd server
npm run start
```

Jalankan AI service:

```bash
cd server/ai-service
.\.venv\Scripts\Activate.ps1
python app.py
```
