# Debug Session: login-failed
- **Status**: [OPEN]
- **Issue**: Login dari halaman web gagal dan frontend menampilkan pesan "Login failed".
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: .dbg/trae-debug-log-login-failed.ndjson

## Reproduction Steps
1. Jalankan backend dan frontend.
2. Buka halaman `/login`.
3. Masukkan username dan password yang valid.
4. Klik tombol login.
5. Amati response API `/api/auth/login` dan log backend.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Request login tidak sampai ke backend atau payload frontend tidak sesuai | High | Low | Rejected untuk admin dan dosen1; request dan payload masuk normal |
| B | User ditemukan tetapi verifikasi password gagal | High | Low | Rejected untuk admin dan dosen1; `isMatch=true` |
| C | Backend melempar error saat query user atau compare password | Medium | Low | Rejected untuk admin dan dosen1; tidak ada error backend |
| D | Response login sukses tetapi shape data tidak sesuai yang diharapkan frontend | Medium | Medium | Rejected untuk admin; frontend menerima sukses dan navigasi ke dashboard |

## Log Evidence
- Admin browser run:
  - log line 1: frontend submit terkirim
  - log line 2: backend menerima payload login
  - log line 3: user `admin` ditemukan
  - log line 4: `comparePassword()` berhasil
  - log line 5: backend mengirim respons sukses dengan shape `message/token/user`
  - log line 6: frontend menerima sukses dan navigasi ke `/dashboard`
- Dosen direct backend run:
  - backend merespons `200 OK` untuk `dosen1 / 198501012010011001`
  - log menunjukkan user dosen ditemukan dan password match

## Verification Conclusion
- Issue belum dapat direproduksi sebagai kegagalan login umum.
- Jalur login sistem valid untuk akun `admin` dan `dosen1`.
- Dugaan saat ini bergeser ke kasus spesifik akun/kredensial tertentu, atau percobaan login di browser menggunakan data yang berbeda dari kredensial bawaan.
