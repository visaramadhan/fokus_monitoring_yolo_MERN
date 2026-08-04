[OPEN] Debug Session: face-distance-detection

## Gejala
- Wajah tidak terdeteksi ketika jarak pengguna ke kamera lebih dari sekitar 50 cm.

## Dampak
- Monitoring fokus gagal mengenali orang pada jarak duduk yang lebih jauh.

## Hipotesis Awal
1. Resolusi frame yang dikirim dari frontend ke AI service terlalu kecil setelah resize/compression sehingga wajah jauh kehilangan detail.
2. Detektor wajah/landmark di AI service memiliki ambang minimum confidence atau minimum face size yang terlalu tinggi.
3. Pipeline preprocessing melakukan crop atau scaling yang membuat area wajah kecil terbuang sebelum inference.
4. Sistem hanya mendeteksi landmark/focus setelah face box ditemukan, dan detektor box gagal pada wajah kecil walaupun orang masih terlihat di frame.
5. Kamera/browser mengirim frame dengan rasio atau kualitas JPEG yang menurunkan akurasi pada subjek jauh.

## Rencana Bukti
- Tambahkan instrumentasi pada frontend capture dan AI service inference untuk mencatat ukuran frame, dimensi resize, jumlah face candidates, confidence, dan alasan gagal.
- Reproduksi pada jarak dekat vs >50 cm.
- Bandingkan log pre-fix untuk menentukan penyebab dominan.

## Bukti Terkumpul
- Frontend Live Monitoring mengirim frame tetap `640x480` ke AI service.
- Pada kondisi masih terdeteksi, ukuran bbox wajah sempat turun hingga sekitar `77x93` piksel (`bbox_w_norm ~0.12`, `bbox_h_norm ~0.19`).
- Pada kondisi gagal, log berubah menjadi `landmark_count: 0` dan `status: no_face`, artinya kegagalan terjadi di tahap deteksi face landmarks, bukan di klasifikasi fokus.
- Pola user terkonfirmasi: semakin jauh jarak wajah dari kamera, atau semakin kecil wajah di frame, face landmarks hilang total.
- Tracking ID belum di-reset saat `start_recording()`, sehingga sesi baru tidak dijamin mulai lagi dari `ID 1`.

## Kesimpulan Pre-Fix
1. Akar masalah utama adalah resolusi/ukuran wajah efektif yang terlalu kecil untuk pipeline face landmark saat input hanya `640x480`.
2. Detektor perlu fallback retry saat tidak menemukan landmark pada frame kecil.
3. Kestabilan ID perlu diperkuat dengan matching yang lebih sticky dan reset tracking di awal sesi.

## Fix Yang Dipasang
- Frontend kamera sekarang meminta resolusi ideal lebih tinggi (`1280x720`, max `1920x1080`).
- Saat sesi monitoring mulai, frontend memanggil reset AI state sebelum start recording.
- AI service sekarang me-reset tracking state saat `start_recording()`, sehingga sesi baru mulai dari `ID 1`.
- AI service menambahkan retry detection dengan upscale frame sampai `1280` pada sisi terpanjang jika landmark awal tidak ditemukan.
- Matching tracking ID diperkuat dengan kombinasi `bbox IoU + centroid distance` dan toleransi miss yang lebih longgar agar ID tidak mudah berganti.
