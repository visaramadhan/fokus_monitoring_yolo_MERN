# Debug Session: webrtc-404-init
- **Status**: [OPEN]
- **Issue**: Roboflow WebRTC di Live Monitoring gagal start dengan error HTTP 404, model status inactive, state stopped.
- **Debug Server**: Not started yet
- **Log File**: .dbg/trae-debug-log-webrtc-404-init.ndjson

## Reproduction Steps
1. Login ke aplikasi.
2. Buka Live Monitoring.
3. Aktifkan kamera dan mulai monitoring dengan mode Roboflow WebRTC.
4. Perhatikan status berubah menjadi error dengan pesan `Request failed with status code 404`.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Endpoint SDK `initializeWebrtcWorker` yang dipanggil tidak cocok dengan `ROBOFLOW_API_URL=https://serverless.roboflow.com` | High | Low | Pending |
| B | `workspaceName` / `workflowId` valid untuk hosted inference, tetapi tidak valid untuk WebRTC worker init | High | Low | Pending |
| C | Payload `wrtcParams` yang dikirim frontend tidak sesuai bentuk yang diharapkan SDK/server Roboflow, sehingga server merespons 404 | Medium | Medium | Pending |
| D | SDK versi `@roboflow/inference-sdk` yang dipakai backend/frontend tidak cocok dengan endpoint WebRTC Roboflow yang aktif | Medium | Medium | Pending |
| E | Resource output workflow (`streamOutputNames` / `dataOutputNames`) ada mismatch dan server WebRTC memetakannya sebagai resource not found | Low | Medium | Pending |

## Log Evidence
- `fetchTurnConfig()` ke Roboflow berhasil dan mengembalikan 1 ICE/TURN server.
- Endpoint `https://serverless.roboflow.com/initialise_webrtc_worker` merespons `405` untuk `OPTIONS`, jadi endpoint ada.
- Instrumentasi sementara ditambahkan pada `server/routes/roboflowHosted.js` di catch `/webrtc/init` untuk mengembalikan detail error WebRTC yang lebih lengkap.

## Verification Conclusion
Sementara:
- **A (base URL salah total)**: melemah, karena endpoint `initialise_webrtc_worker` ada.
- **B (workflow/workspace tidak terlihat / tidak ada untuk WebRTC)**: masih kuat.
- **C (payload WebRTC tidak cocok)**: masih mungkin.
- **D (SDK mismatch)**: masih mungkin, tetapi belum ada bukti.
- **E (output workflow mismatch)**: masih mungkin, bukti belum cukup.
