#!/usr/bin/env python
# coding: utf-8

# In[2]:


import cv2
from ultralytics import YOLO
import pandas as pd
from datetime import datetime

# Load model
model = YOLO('best.pt')

# Inisialisasi webcam
cap = cv2.VideoCapture(0)
report_data = []

print("Deteksi dimulai, tekan 'q' untuk keluar...")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    results = model.predict(frame, conf=0.5, verbose=False)
    boxes = results[0].boxes
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    for box in boxes:
        cls_id = int(box.cls)
        label = model.names[cls_id]
        confidence = float(box.conf)

        report_data.append({
            'timestamp': timestamp,
            'label': label,
            'confidence': round(confidence, 2)
        })

    annotated_frame = results[0].plot()
    cv2.imshow("Deteksi Gerak Siswa", annotated_frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()

# Buat DataFrame
df = pd.DataFrame(report_data)

# Hitung total per label
total_tidur = (df['label'] == 'tidur').sum()
total_main_hp = (df['label'] == 'main_hp').sum()
total_normal = (df['label'] == 'normal').sum()

# Hitung kategori kondusif vs tidak
total_kondusif = total_normal
total_tidak_kondusif = total_tidur + total_main_hp
total_semua = total_kondusif + total_tidak_kondusif

persen_kondusif = (total_kondusif / total_semua * 100) if total_semua > 0 else 0
persen_tidak_kondusif = 100 - persen_kondusif

status_dominan = "Kondusif" if persen_kondusif >= persen_tidak_kondusif else "Tidak Kondusif"

# Tambahkan baris rekap ke bawah DataFrame
rekap_df = pd.DataFrame([
    {'timestamp': '', 'label': 'TOTAL TIDUR', 'confidence': total_tidur},
    {'timestamp': '', 'label': 'TOTAL MAIN_HP', 'confidence': total_main_hp},
    {'timestamp': '', 'label': 'TOTAL NORMAL', 'confidence': total_normal},
    {'timestamp': '', 'label': 'TOTAL KONDISIF', 'confidence': total_kondusif},
    {'timestamp': '', 'label': 'TOTAL TIDAK KONDISIF', 'confidence': total_tidak_kondusif},
    {'timestamp': '', 'label': 'PERSEN KONDISIF (%)', 'confidence': round(persen_kondusif, 2)},
    {'timestamp': '', 'label': 'PERSEN TIDAK KONDISIF (%)', 'confidence': round(persen_tidak_kondusif, 2)},
    {'timestamp': '', 'label': 'STATUS DOMINAN', 'confidence': status_dominan}
])

df = pd.concat([df, rekap_df], ignore_index=True)

# Simpan ke Excel dengan tanggal
tanggal = datetime.now().strftime('%Y-%m-%d')
excel_filename = f'laporan_deteksi_siswa_{tanggal}.xlsx'
df.to_excel(excel_filename, index=False)

print(f"\n✅ Laporan disimpan ke: {excel_filename}")
print(f"📊 Dominasi Kelas: {status_dominan} ({persen_kondusif:.1f}% vs {persen_tidak_kondusif:.1f}%)")


# ## 
