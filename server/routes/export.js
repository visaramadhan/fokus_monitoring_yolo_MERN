import express from 'express';
import LiveSession from '../models/LiveSession.js';
import Pertemuan from '../models/Pertemuan.js';
import SessionRecord from '../models/SessionRecord.js';
import Kelas from '../models/Kelas.js';
import MataKuliah from '../models/MataKuliah.js';
import { auth } from '../middleware/auth.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import mongoose from 'mongoose';

const router = express.Router();

function addAoaWorksheet(workbook, name, rows) {
  const ws = workbook.addWorksheet(name);
  (rows || []).forEach((r) => ws.addRow(Array.isArray(r) ? r : [r]));
  ws.columns.forEach((col) => {
    let max = 10;
    col.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell?.value;
      const len = v === null || v === undefined ? 0 : String(v).length;
      if (len > max) max = len;
    });
    col.width = Math.min(60, max + 2);
  });
  return ws;
}

function addJsonWorksheet(workbook, name, rows) {
  const ws = workbook.addWorksheet(name);
  const safeRows = Array.isArray(rows) ? rows : [];
  const keys = safeRows.length > 0 ? Object.keys(safeRows[0]) : [];
  ws.columns = keys.map((k) => ({ header: k, key: k, width: Math.min(60, Math.max(10, k.length + 2)) }));
  safeRows.forEach((r) => ws.addRow(r));
  ws.getRow(1).font = { bold: true };
  ws.columns.forEach((col) => {
    let max = col.width || 10;
    col.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell?.value;
      const len = v === null || v === undefined ? 0 : String(v).length;
      if (len > max) max = len;
    });
    col.width = Math.min(60, max + 2);
  });
  return ws;
}

const PDF_THEME = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  slate900: '#0F172A',
  slate700: '#334155',
  slate500: '#64748B',
  slate300: '#CBD5E1',
  slate200: '#E2E8F0',
  slate100: '#F1F5F9',
  green: '#16A34A',
  amber: '#D97706',
  red: '#DC2626',
  white: '#FFFFFF'
};

function formatPdfDate(value, options = {}) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    ...options
  });
}

function parseDateRangeQuery({ year, startDate, endDate }) {
  if (startDate || endDate) {
    if (!startDate || !endDate) {
      return { error: 'startDate and endDate must be provided together.' };
    }

    const start = new Date(`${String(startDate)}T00:00:00.000Z`);
    const end = new Date(`${String(endDate)}T23:59:59.999Z`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return { error: 'Invalid startDate or endDate. Use YYYY-MM-DD format.' };
    }
    if (start > end) {
      return { error: 'startDate must be earlier than or equal to endDate.' };
    }

    return { range: { $gte: start, $lte: end } };
  }

  if (!year) return { range: null };

  const rawYear = String(year).trim();
  if (!/^\d{4}$/.test(rawYear)) {
    return { error: 'Invalid year. Use YYYY format.' };
  }

  const start = new Date(`${rawYear}-01-01T00:00:00.000Z`);
  const end = new Date(`${Number(rawYear) + 1}-01-01T00:00:00.000Z`);
  return { range: { $gte: start, $lt: end } };
}

function formatPdfRangeLabel({ year, startDate, endDate }) {
  if (startDate && endDate) {
    return `${formatPdfDate(startDate)} - ${formatPdfDate(endDate)}`;
  }
  if (year) {
    return `Tahun ${year}`;
  }
  return 'Semua data';
}

function createPdfDoc(res, filename) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 42,
    bufferPages: true
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);
  return doc;
}

function ensurePdfSpace(doc, neededHeight = 80) {
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight > bottomLimit) {
    doc.addPage();
  }
}

function drawPdfHeader(doc, { title, subtitle = '', badge = '' }) {
  const x = doc.page.margins.left;
  const y = doc.y;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const height = 92;

  doc.save();
  doc.roundedRect(x, y, width, height, 18).fill(PDF_THEME.primary);
  doc.rect(x, y + height - 14, width, 14).fill(PDF_THEME.primaryDark);
  doc.restore();

  doc.fillColor(PDF_THEME.white).fontSize(22).font('Helvetica-Bold').text(title, x + 24, y + 20, {
    width: width - 48
  });

  if (subtitle) {
    doc.fillColor('#DBEAFE').fontSize(11).font('Helvetica').text(subtitle, x + 24, y + 50, {
      width: width - 180
    });
  }

  if (badge) {
    const badgeWidth = 120;
    doc.roundedRect(x + width - badgeWidth - 20, y + 18, badgeWidth, 28, 14).fill('#DBEAFE');
    doc.fillColor(PDF_THEME.primaryDark).fontSize(10).font('Helvetica-Bold').text(
      badge,
      x + width - badgeWidth - 20,
      y + 27,
      { width: badgeWidth, align: 'center' }
    );
  }

  doc.moveDown(4.8);
  doc.fillColor(PDF_THEME.slate900).font('Helvetica');
}

function drawSectionTitle(doc, title, subtitle = '') {
  ensurePdfSpace(doc, 44);
  doc.moveDown(0.4);
  doc.fillColor(PDF_THEME.slate900).fontSize(15).font('Helvetica-Bold').text(title);
  if (subtitle) {
    doc.moveDown(0.15);
    doc.fillColor(PDF_THEME.slate500).fontSize(9).font('Helvetica').text(subtitle);
  }
  doc.moveDown(0.6);
}

function drawInfoGrid(doc, items = [], columns = 2) {
  if (!items.length) return;
  const gap = 12;
  const x = doc.page.margins.left;
  const boxWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right - gap * (columns - 1)) / columns;
  const boxHeight = 56;
  const rows = Math.ceil(items.length / columns);

  ensurePdfSpace(doc, rows * (boxHeight + gap));
  let cursorY = doc.y;

  items.forEach((item, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const boxX = x + col * (boxWidth + gap);
    const boxY = cursorY + row * (boxHeight + gap);

    doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 12).fill(PDF_THEME.slate100);
    doc.fillColor(PDF_THEME.slate500).fontSize(8).font('Helvetica-Bold').text(item.label, boxX + 14, boxY + 12, {
      width: boxWidth - 28
    });
    doc.fillColor(PDF_THEME.slate900).fontSize(11).font('Helvetica').text(item.value, boxX + 14, boxY + 28, {
      width: boxWidth - 28,
      ellipsis: true
    });
  });

  doc.y = cursorY + rows * (boxHeight + gap);
  doc.moveDown(0.3);
}

function drawStatCards(doc, cards = [], columns = 3) {
  if (!cards.length) return;
  const gap = 12;
  const x = doc.page.margins.left;
  const cardWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right - gap * (columns - 1)) / columns;
  const cardHeight = 74;
  const rows = Math.ceil(cards.length / columns);

  ensurePdfSpace(doc, rows * (cardHeight + gap));
  let cursorY = doc.y;

  cards.forEach((card, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const cardX = x + col * (cardWidth + gap);
    const cardY = cursorY + row * (cardHeight + gap);

    doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 14).fill(card.bgColor || PDF_THEME.slate100);
    doc.fillColor(card.accent || PDF_THEME.primary).fontSize(8).font('Helvetica-Bold').text(card.label, cardX + 14, cardY + 12, {
      width: cardWidth - 28
    });
    doc.fillColor(PDF_THEME.slate900).fontSize(20).font('Helvetica-Bold').text(card.value, cardX + 14, cardY + 30, {
      width: cardWidth - 28
    });
    if (card.helper) {
      doc.fillColor(PDF_THEME.slate500).fontSize(8).font('Helvetica').text(card.helper, cardX + 14, cardY + 56, {
        width: cardWidth - 28
      });
    }
  });

  doc.y = cursorY + rows * (cardHeight + gap);
  doc.moveDown(0.25);
}

function drawParagraphBox(doc, text) {
  if (!text) return;
  ensurePdfSpace(doc, 70);
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const boxY = doc.y;
  const textHeight = doc.heightOfString(text, { width: width - 28, align: 'left' });
  const boxHeight = Math.max(48, textHeight + 24);
  doc.roundedRect(x, boxY, width, boxHeight, 12).fill(PDF_THEME.slate100);
  doc.fillColor(PDF_THEME.slate700).fontSize(10).font('Helvetica').text(text, x + 14, boxY + 12, {
    width: width - 28,
    align: 'left'
  });
  doc.y = boxY + boxHeight + 10;
}

function drawTable(doc, columns = [], rows = [], options = {}) {
  if (!columns.length) return;
  const tableX = doc.page.margins.left;
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const headerHeight = options.headerHeight || 24;
  const rowHeight = options.rowHeight || 22;
  const fontSize = options.fontSize || 9;

  const computedWidths = (() => {
    const fixed = columns.reduce((sum, column) => sum + (column.width || 0), 0);
    const autoColumns = columns.filter((column) => !column.width);
    const autoWidth = autoColumns.length > 0 ? Math.max(60, (tableWidth - fixed) / autoColumns.length) : 0;
    return columns.map((column) => column.width || autoWidth);
  })();

  const drawHeaderRow = () => {
    ensurePdfSpace(doc, headerHeight + rowHeight);
    const headerY = doc.y;
    doc.roundedRect(tableX, headerY, tableWidth, headerHeight, 8).fill(PDF_THEME.slate100);
    let cursorX = tableX;
    columns.forEach((column, index) => {
      const width = computedWidths[index];
      doc.fillColor(PDF_THEME.slate700).fontSize(8).font('Helvetica-Bold').text(column.label, cursorX + 8, headerY + 8, {
        width: width - 16,
        align: column.align || 'left'
      });
      cursorX += width;
    });
    doc.y = headerY + headerHeight;
  };

  drawHeaderRow();

  rows.forEach((row, rowIndex) => {
    ensurePdfSpace(doc, rowHeight + 8);
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeaderRow();
    }

    const rowY = doc.y;
    if (rowIndex % 2 === 0) {
      doc.roundedRect(tableX, rowY, tableWidth, rowHeight, 6).fill('#FAFCFF');
    }

    let cursorX = tableX;
    columns.forEach((column, index) => {
      const width = computedWidths[index];
      const rawValue = typeof row === 'object' && !Array.isArray(row) ? row[column.key] : row[index];
      const value = rawValue === null || rawValue === undefined ? '-' : String(rawValue);
      doc.fillColor(PDF_THEME.slate900).fontSize(fontSize).font('Helvetica').text(value, cursorX + 8, rowY + 7, {
        width: width - 16,
        align: column.align || 'left',
        ellipsis: true
      });
      cursorX += width;
    });
    doc.y = rowY + rowHeight + 4;
  });

  doc.moveDown(0.3);
}

// Export live session to Excel
router.get('/excel/session/:sessionId', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await LiveSession.findOne({ sessionId })
      .populate('mata_kuliah_id', 'nama kode')
      .populate('dosen_id', 'nama_lengkap');

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Prepare data for Excel
    const excelData = session.detectionData.map((data, index) => ({
      'Time': data.timestamp.toLocaleString(),
      'Total Detections': data.totalDetections,
      'Focused Count': data.focusedCount,
      'Not Focused Count': data.notFocusedCount,
      'Sleeping Count': data.sleepingCount,
      'Phone Using Count': data.phoneUsingCount,
      'Chatting Count': data.chattingCount,
      'Focus Percentage': data.focusPercentage + '%'
    }));

    // Create workbook
    const wb = new ExcelJS.Workbook();
    
    // Add session info sheet
    const sessionInfo = [
      ['Session ID', session.sessionId],
      ['Class', session.kelas],
      ['Subject', session.mata_kuliah],
      ['Instructor', session.dosen_id.nama_lengkap],
      ['Start Time', session.startTime.toLocaleString()],
      ['End Time', session.endTime ? session.endTime.toLocaleString() : 'Ongoing'],
      ['Average Focus', session.summary.averageFocus.toFixed(2) + '%'],
      ['Peak Focus', session.summary.peakFocus.toFixed(2) + '%'],
      ['Lowest Focus', session.summary.lowestFocus.toFixed(2) + '%']
    ];
    
    addAoaWorksheet(wb, 'Session Info', sessionInfo);
    addJsonWorksheet(wb, 'Detection Data', excelData);
    
    // Add student data if available
    if (session.studentData && session.studentData.length > 0) {
      const studentData = session.studentData.map(student => ({
        'Student ID': student.studentId,
        'Attendance Duration (min)': student.attendanceDuration,
        'Focus Percentage': student.focusPercentage + '%',
        'Focus Minutes': student.focusMinutes,
        'Not Focus Minutes': student.notFocusMinutes,
        'Status': student.status
      }));
      
      addJsonWorksheet(wb, 'Student Data', studentData);
    }

    // Generate buffer
    const out = await wb.xlsx.writeBuffer();
    const buffer = Buffer.isBuffer(out) ? out : Buffer.from(out);

    res.setHeader('Content-Disposition', `attachment; filename="focus-session-${sessionId}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Export meeting report to PDF
router.get('/pdf/meeting/:meetingId', auth, async (req, res) => {
  try {
    const { meetingId } = req.params;
    
    const meeting = await Pertemuan.findById(meetingId)
      .populate('mata_kuliah_id', 'nama kode')
      .populate('dosen_id', 'nama_lengkap departemen');

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    const doc = createPdfDoc(res, `meeting-report-${meetingId}.pdf`);
    const averageFocusDuration = (meeting.data_fokus || []).length > 0
      ? Math.round((meeting.data_fokus || []).reduce((sum, student) => sum + Number(student.durasi_fokus || 0), 0) / meeting.data_fokus.length)
      : 0;

    drawPdfHeader(doc, {
      title: 'Rekap Pertemuan',
      subtitle: `${meeting.mata_kuliah} • ${meeting.kelas}`,
      badge: `Meeting ${meeting.pertemuan_ke}`
    });

    drawInfoGrid(doc, [
      { label: 'Tanggal', value: formatPdfDate(meeting.tanggal, { weekday: 'long' }) },
      { label: 'Dosen', value: meeting.dosen_id?.nama_lengkap || '-' },
      { label: 'Departemen', value: meeting.dosen_id?.departemen || '-' },
      { label: 'Durasi', value: `${meeting.durasi_pertemuan} menit` },
      { label: 'Mata Kuliah', value: `${meeting.mata_kuliah} (${meeting.mata_kuliah_id?.kode || '-'})` },
      { label: 'Topik', value: meeting.topik || 'Belum diisi' }
    ], 2);

    drawSectionTitle(doc, 'Ringkasan Fokus', 'Diringkas dari hasil monitoring pertemuan ini.');
    drawStatCards(doc, [
      {
        label: 'Fokus Kelas',
        value: `${Number(meeting.hasil_akhir_kelas?.fokus || 0).toFixed(1)}%`,
        helper: 'Proporsi fokus keseluruhan',
        bgColor: '#DBEAFE',
        accent: PDF_THEME.primary
      },
      {
        label: 'Tidak Fokus',
        value: `${Number(meeting.hasil_akhir_kelas?.tidak_fokus || 0).toFixed(1)}%`,
        helper: 'Kebalikan dari fokus kelas',
        bgColor: '#FEE2E2',
        accent: PDF_THEME.red
      },
      {
        label: 'Kehadiran',
        value: `${Number(meeting.hasil_akhir_kelas?.jumlah_hadir || 0)} siswa`,
        helper: 'Jumlah siswa terdeteksi',
        bgColor: '#DCFCE7',
        accent: PDF_THEME.green
      },
      {
        label: 'Rata-rata Durasi Fokus',
        value: `${averageFocusDuration} menit`,
        helper: 'Rata-rata fokus per siswa',
        bgColor: '#FEF3C7',
        accent: PDF_THEME.amber
      }
    ], 2);

    if (meeting.catatan) {
      drawSectionTitle(doc, 'Catatan');
      drawParagraphBox(doc, meeting.catatan);
    }

    drawSectionTitle(doc, 'Detail Fokus Siswa', 'Tabel rekap fokus siswa sesuai halaman detail pertemuan.');
    drawTable(
      doc,
      [
        { label: 'ID Siswa', key: 'id_siswa', width: 120 },
        { label: 'Fokus', key: 'persen_fokus', width: 85, align: 'center' },
        { label: 'Tidak Fokus', key: 'persen_tidak_fokus', width: 95, align: 'center' },
        { label: 'Durasi', key: 'durasi_fokus', width: 80, align: 'center' },
        { label: 'Sesi', key: 'jumlah_sesi_fokus', width: 70, align: 'center' },
        { label: 'Status', key: 'status', width: 80, align: 'center' }
      ],
      (meeting.data_fokus || []).map((student) => ({
        id_siswa: student.id_siswa,
        persen_fokus: `${Number(student.persen_fokus || 0).toFixed(1)}%`,
        persen_tidak_fokus: `${Number(student.persen_tidak_fokus || 0).toFixed(1)}%`,
        durasi_fokus: `${Number(student.durasi_fokus || 0)} m`,
        jumlah_sesi_fokus: Number(student.jumlah_sesi_fokus || 0),
        status: student.status
      }))
    );

    if (Array.isArray(meeting.record_events) && meeting.record_events.length > 0) {
      drawSectionTitle(doc, 'Timestamp Monitoring', 'Event AI yang tercatat selama monitoring berlangsung.');
      drawTable(
        doc,
        [
          { label: 'Timestamp', key: 'timestamp', width: 130 },
          { label: 'ID', key: 'id', width: 70, align: 'center' },
          { label: 'Label', key: 'label', width: 95 },
          { label: 'Status', key: 'status', width: 120 },
          { label: 'Confidence', key: 'confidence', width: 80, align: 'center' }
        ],
        meeting.record_events.map((event) => ({
          timestamp: event.timestamp || '-',
          id: event.id || '-',
          label: event.label || '-',
          status: event.status || '-',
          confidence: Number(event.confidence || 0).toFixed(3)
        })),
        { fontSize: 8, rowHeight: 20 }
      );
    }

    doc.end();

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Export meeting report to Excel
router.get('/excel/meeting/:meetingId', auth, async (req, res) => {
  try {
    const { meetingId } = req.params;

    const meeting = await Pertemuan.findById(meetingId)
      .populate('mata_kuliah_id', 'nama kode')
      .populate('dosen_id', 'nama_lengkap departemen');

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    const wb = new ExcelJS.Workbook();

    const meetingInfo = [
      ['Meeting Information'],
      ['Subject', meeting.mata_kuliah],
      ['Class', meeting.kelas],
      ['Meeting', meeting.pertemuan_ke],
      ['Date', meeting.tanggal.toLocaleDateString()],
      ['Instructor', meeting.dosen_id?.nama_lengkap || ''],
      ['Department', meeting.dosen_id?.departemen || ''],
      ['Duration (min)', meeting.durasi_pertemuan],
      ['Overall Focus Rate (%)', Number(meeting.hasil_akhir_kelas?.fokus || 0)],
      ['Students Present', Number(meeting.hasil_akhir_kelas?.jumlah_hadir || 0)]
    ];
    addAoaWorksheet(wb, 'Meeting Info', meetingInfo);

    const studentRows = (meeting.data_fokus || []).map((s) => ({
      student_id: s.id_siswa,
      persen_fokus: s.persen_fokus,
      persen_tidak_fokus: s.persen_tidak_fokus,
      durasi_fokus_min: s.durasi_fokus,
      jumlah_sesi_fokus: s.jumlah_sesi_fokus,
      status: s.status
    }));
    addJsonWorksheet(wb, 'Student Focus', studentRows);

    const out = await wb.xlsx.writeBuffer();
    const buffer = Buffer.isBuffer(out) ? out : Buffer.from(out);

    res.setHeader('Content-Disposition', `attachment; filename="meeting-report-${meetingId}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Export class performance to PDF
router.get('/pdf/class/:classId', auth, async (req, res) => {
  try {
    const { classId } = req.params;
    const { year, startDate, endDate } = req.query;
    let className = classId;
    let kelasDoc = null;

    const dateRange = parseDateRangeQuery({ year, startDate, endDate });
    if (dateRange.error) {
      return res.status(400).json({ message: dateRange.error });
    }

    if (mongoose.Types.ObjectId.isValid(classId)) {
      kelasDoc = await Kelas.findById(classId).select('nama_kelas jumlah_mahasiswa tahun_ajaran semester createdAt');
      if (kelasDoc?.nama_kelas) {
        className = kelasDoc.nama_kelas;
      }
    }

    const meetingQuery = { kelas: className };
    if (dateRange.range) {
      meetingQuery.tanggal = dateRange.range;
    }

    const meetings = await Pertemuan.find(meetingQuery)
      .populate('mata_kuliah_id', 'nama kode')
      .populate('dosen_id', 'nama_lengkap')
      .sort({ tanggal: -1 });

    if (meetings.length === 0) {
      return res.status(404).json({ message: 'No meetings found for this class' });
    }
    const averageFocus = meetings.reduce((sum, m) => sum + Number(m.hasil_akhir_kelas?.fokus || 0), 0) / meetings.length;
    const totalStudents = Math.max(0, ...meetings.map(m => Number(m.hasil_akhir_kelas?.jumlah_hadir || 0)));
    const focusThreshold = 70;
    const meetingsAboveThreshold = meetings.filter((meeting) => Number(meeting.hasil_akhir_kelas?.fokus || 0) >= focusThreshold).length;
    const meetingsBelowThreshold = meetings.length - meetingsAboveThreshold;
    const reportRangeLabel = formatPdfRangeLabel({ year, startDate, endDate });
    const insightText =
      meetings.length === 0
        ? 'Belum ada pertemuan untuk dianalisis.'
        : averageFocus >= focusThreshold && meetingsBelowThreshold <= Math.ceil(meetings.length * 0.3)
          ? 'Kelas cenderung kondusif. Rata-rata fokus berada di atas threshold dan mayoritas pertemuan memenuhi standar.'
          : averageFocus < focusThreshold && meetingsBelowThreshold >= Math.ceil(meetings.length * 0.5)
            ? 'Kelas cenderung perlu perhatian. Rata-rata fokus di bawah threshold dan cukup banyak pertemuan berada di bawah standar.'
            : 'Kondisi kelas fluktuatif. Ada variasi tingkat fokus yang cukup besar antar pertemuan.';

    const doc = createPdfDoc(res, `class-report-${className}.pdf`);

    drawPdfHeader(doc, {
      title: 'Rekap Kelas',
      subtitle: `Ringkasan performa fokus untuk kelas ${className}`,
      badge: className
    });

    drawInfoGrid(doc, [
      { label: 'Nama Kelas', value: className },
      { label: 'Tahun Ajaran', value: kelasDoc?.tahun_ajaran || '-' },
      { label: 'Semester', value: kelasDoc?.semester || '-' },
      { label: 'Tanggal Export', value: formatPdfDate(new Date()) },
      { label: 'Rentang Rekap', value: reportRangeLabel },
      { label: 'Jumlah Mahasiswa', value: `${kelasDoc?.jumlah_mahasiswa || totalStudents} siswa` },
      { label: 'Dibuat', value: kelasDoc?.createdAt ? formatPdfDate(kelasDoc.createdAt) : '-' }
    ], 2);

    drawSectionTitle(doc, 'Analitik Kekondusifan', 'Disusun mengikuti metrik utama pada halaman detail kelas.');
    drawStatCards(doc, [
      {
        label: 'Total Pertemuan',
        value: `${meetings.length}`,
        helper: 'Riwayat pertemuan yang terdata',
        bgColor: '#DBEAFE',
        accent: PDF_THEME.primary
      },
      {
        label: 'Rata-rata Fokus',
        value: `${averageFocus.toFixed(1)}%`,
        helper: 'Akumulasi rata-rata kelas',
        bgColor: '#DCFCE7',
        accent: PDF_THEME.green
      },
      {
        label: '>= Threshold',
        value: `${meetingsAboveThreshold}`,
        helper: `Threshold ${focusThreshold}%`,
        bgColor: '#FEF3C7',
        accent: PDF_THEME.amber
      },
      {
        label: '< Threshold',
        value: `${meetingsBelowThreshold}`,
        helper: 'Butuh evaluasi lanjutan',
        bgColor: '#FEE2E2',
        accent: PDF_THEME.red
      }
    ], 2);

    drawSectionTitle(doc, 'Insight Kelas');
    drawParagraphBox(doc, insightText);

    drawSectionTitle(doc, 'Riwayat Pertemuan', 'Tabel ringkas pertemuan seperti pada halaman detail kelas.');
    drawTable(
      doc,
      [
        { label: 'Pertemuan', key: 'meeting', width: 80, align: 'center' },
        { label: 'Mata Kuliah', key: 'subject', width: 120 },
        { label: 'Dosen', key: 'instructor', width: 110 },
        { label: 'Fokus', key: 'focus', width: 70, align: 'center' },
        { label: 'Hadir', key: 'attendance', width: 60, align: 'center' },
        { label: 'Tanggal', key: 'date', width: 95, align: 'center' }
      ],
      meetings.map((meeting) => ({
        meeting: `#${meeting.pertemuan_ke}`,
        subject: meeting.mata_kuliah,
        instructor: meeting.dosen_id?.nama_lengkap || '-',
        focus: `${Number(meeting.hasil_akhir_kelas?.fokus || 0).toFixed(1)}%`,
        attendance: Number(meeting.hasil_akhir_kelas?.jumlah_hadir || 0),
        date: formatPdfDate(meeting.tanggal)
      }))
    );

    doc.end();

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Export class performance to Excel
router.get('/excel/class/:classId', auth, async (req, res) => {
  try {
    const { classId } = req.params;
    const { year, startDate, endDate } = req.query;
    const dateRange = parseDateRangeQuery({ year, startDate, endDate });

    if (dateRange.error) {
      return res.status(400).json({ message: dateRange.error });
    }

    let className = classId;
    let kelasDoc = null;

    if (mongoose.Types.ObjectId.isValid(classId)) {
      kelasDoc = await Kelas.findById(classId).select('nama_kelas jumlah_mahasiswa tahun_ajaran semester createdAt');
      if (kelasDoc?.nama_kelas) {
        className = kelasDoc.nama_kelas;
      }
    }

    const meetingQuery = { kelas: className };
    if (dateRange.range) {
      meetingQuery.tanggal = dateRange.range;
    }

    const meetings = await Pertemuan.find(meetingQuery)
      .populate('mata_kuliah_id', 'nama kode')
      .populate('dosen_id', 'nama_lengkap')
      .sort({ tanggal: -1 });

    if (meetings.length === 0) {
      return res.status(404).json({ message: 'No meetings found for this class' });
    }

    const averageFocus = meetings.reduce((sum, m) => sum + Number(m.hasil_akhir_kelas?.fokus || 0), 0) / meetings.length;
    const totalStudents = Math.max(0, ...meetings.map((meeting) => Number(meeting.hasil_akhir_kelas?.jumlah_hadir || 0)));
    const wb = new ExcelJS.Workbook();

    const classInfo = [
      ['Class Information'],
      ['Class', className],
      ['Academic Year', kelasDoc?.tahun_ajaran || '-'],
      ['Semester', kelasDoc?.semester || '-'],
      ['Report Range', formatPdfRangeLabel({ year, startDate, endDate })],
      ['Total Meetings', meetings.length],
      ['Average Focus (%)', Number(averageFocus.toFixed(2))],
      ['Max Attendance', kelasDoc?.jumlah_mahasiswa || totalStudents],
      ['Generated At', new Date().toLocaleString('id-ID')]
    ];
    addAoaWorksheet(wb, 'Class Info', classInfo);

    const meetingRows = meetings.map((meeting) => ({
      meeting: meeting.pertemuan_ke,
      subject: meeting.mata_kuliah,
      subject_code: meeting.mata_kuliah_id?.kode || '',
      instructor: meeting.dosen_id?.nama_lengkap || '',
      date: meeting.tanggal?.toLocaleDateString('id-ID'),
      topic: meeting.topik || '',
      focus_rate: Number(meeting.hasil_akhir_kelas?.fokus || 0).toFixed(2),
      not_focus_rate: Number(meeting.hasil_akhir_kelas?.tidak_fokus || 0).toFixed(2),
      attendance: Number(meeting.hasil_akhir_kelas?.jumlah_hadir || 0)
    }));
    addJsonWorksheet(wb, 'Meeting Data', meetingRows);

    const out = await wb.xlsx.writeBuffer();
    const buffer = Buffer.isBuffer(out) ? out : Buffer.from(out);

    res.setHeader('Content-Disposition', `attachment; filename="class-${className}-report.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Export subject performance to PDF
router.get('/pdf/subject/:subjectId', auth, async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { year, startDate, endDate } = req.query;
    const dateRange = parseDateRangeQuery({ year, startDate, endDate });

    if (dateRange.error) {
      return res.status(400).json({ message: dateRange.error });
    }
    
    const subject = await MataKuliah.findById(subjectId)
      .populate('dosen_id', 'nama_lengkap departemen');
    
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    const meetingQuery = { mata_kuliah_id: subjectId };
    if (dateRange.range) {
      meetingQuery.tanggal = dateRange.range;
    }

    const meetings = await Pertemuan.find(meetingQuery)
      .populate('dosen_id', 'nama_lengkap')
      .sort({ tanggal: -1 });

    const averageFocus = meetings.length > 0
      ? meetings.reduce((sum, meeting) => sum + Number(meeting.hasil_akhir_kelas?.fokus || 0), 0) / meetings.length
      : 0;
    const totalStudents = meetings.length > 0
      ? Math.max(0, ...meetings.map((meeting) => Number(meeting.hasil_akhir_kelas?.jumlah_hadir || 0)))
      : 0;
    const reportRangeLabel = formatPdfRangeLabel({ year, startDate, endDate });
    const doc = createPdfDoc(res, `subject-${subject.nama}-report.pdf`);

    drawPdfHeader(doc, {
      title: 'Rekap Mata Kuliah',
      subtitle: `${subject.nama} (${subject.kode})`,
      badge: `${subject.sks} SKS`
    });

    drawInfoGrid(doc, [
      { label: 'Nama Mata Kuliah', value: subject.nama },
      { label: 'Kode', value: subject.kode },
      { label: 'Dosen', value: subject.dosen_id?.nama_lengkap || '-' },
      { label: 'Departemen', value: subject.dosen_id?.departemen || '-' },
      { label: 'Semester', value: `Semester ${subject.semester}` },
      { label: 'Kelas', value: Array.isArray(subject.kelas) && subject.kelas.length > 0 ? subject.kelas.join(', ') : '-' },
      { label: 'Rentang Rekap', value: reportRangeLabel }
    ], 2);

    drawSectionTitle(doc, 'Ringkasan Performa', 'Disusun agar selaras dengan kartu statistik pada halaman detail mata kuliah.');
    drawStatCards(doc, [
      {
        label: 'Total Pertemuan',
        value: `${meetings.length}`,
        helper: 'Riwayat pertemuan terdaftar',
        bgColor: '#DBEAFE',
        accent: PDF_THEME.primary
      },
      {
        label: 'Rata-rata Fokus',
        value: `${averageFocus.toFixed(1)}%`,
        helper: 'Rerata dari seluruh pertemuan',
        bgColor: '#DCFCE7',
        accent: PDF_THEME.green
      },
      {
        label: 'Maks. Kehadiran',
        value: `${totalStudents} siswa`,
        helper: 'Kehadiran tertinggi yang tercatat',
        bgColor: '#FEF3C7',
        accent: PDF_THEME.amber
      },
      {
        label: 'Jumlah Kelas',
        value: `${Array.isArray(subject.kelas) ? subject.kelas.length : 0}`,
        helper: 'Kelas yang diampu',
        bgColor: '#EDE9FE',
        accent: '#7C3AED'
      }
    ], 2);

    if (subject.deskripsi) {
      drawSectionTitle(doc, 'Deskripsi');
      drawParagraphBox(doc, subject.deskripsi);
    }

    if (meetings.length > 0) {
      drawSectionTitle(doc, 'Riwayat Pertemuan', 'Daftar pertemuan untuk seluruh kelas pada mata kuliah ini.');
      drawTable(
        doc,
        [
          { label: 'Pertemuan', key: 'meeting', width: 80, align: 'center' },
          { label: 'Kelas', key: 'kelas', width: 80, align: 'center' },
          { label: 'Topik', key: 'topik', width: 150 },
          { label: 'Fokus', key: 'focus', width: 70, align: 'center' },
          { label: 'Hadir', key: 'attendance', width: 60, align: 'center' },
          { label: 'Tanggal', key: 'date', width: 95, align: 'center' }
        ],
        meetings.map((meeting) => ({
          meeting: `#${meeting.pertemuan_ke}`,
          kelas: meeting.kelas,
          topik: meeting.topik || 'Belum diisi',
          focus: `${Number(meeting.hasil_akhir_kelas?.fokus || 0).toFixed(1)}%`,
          attendance: Number(meeting.hasil_akhir_kelas?.jumlah_hadir || 0),
          date: formatPdfDate(meeting.tanggal)
        }))
      );
    } else {
      drawSectionTitle(doc, 'Riwayat Pertemuan');
      drawParagraphBox(doc, 'Belum ada pertemuan yang tercatat untuk mata kuliah ini.');
    }

    doc.end();

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Export subject data to Excel
router.get('/excel/subject/:subjectId', auth, async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { year, startDate, endDate } = req.query;
    const dateRange = parseDateRangeQuery({ year, startDate, endDate });

    if (dateRange.error) {
      return res.status(400).json({ message: dateRange.error });
    }
    
    const subject = await MataKuliah.findById(subjectId)
      .populate('dosen_id', 'nama_lengkap departemen');
    
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    const meetingQuery = { mata_kuliah_id: subjectId };
    if (dateRange.range) {
      meetingQuery.tanggal = dateRange.range;
    }

    const meetings = await Pertemuan.find(meetingQuery)
      .populate('dosen_id', 'nama_lengkap')
      .sort({ tanggal: -1 });

    // Prepare data for Excel
    const meetingData = meetings.map(meeting => ({
      'Meeting': meeting.pertemuan_ke,
      'Class': meeting.kelas,
      'Date': meeting.tanggal.toLocaleDateString(),
      'Topic': meeting.topik || 'No topic',
      'Duration (min)': meeting.durasi_pertemuan,
      'Focus Rate (%)': meeting.hasil_akhir_kelas.fokus.toFixed(2),
      'Not Focused (%)': meeting.hasil_akhir_kelas.tidak_fokus.toFixed(2),
      'Attendance': meeting.hasil_akhir_kelas.jumlah_hadir,
      'Instructor': meeting.dosen_id.nama_lengkap
    }));

    // Create workbook
    const wb = new ExcelJS.Workbook();
    
    // Subject info sheet
    const subjectInfo = [
      ['Subject Information'],
      ['Name', subject.nama],
      ['Code', subject.kode],
      ['Credits', subject.sks + ' SKS'],
      ['Instructor', subject.dosen_id.nama_lengkap],
      ['Department', subject.dosen_id.departemen],
      ['Classes', subject.kelas.join(', ')],
      ['Report Range', formatPdfRangeLabel({ year, startDate, endDate })],
      ['Total Meetings', meetings.length],
      ['Report Generated', new Date().toLocaleDateString()]
    ];
    
    addAoaWorksheet(wb, 'Subject Info', subjectInfo);
    
    // Meeting data sheet
    if (meetingData.length > 0) {
      addJsonWorksheet(wb, 'Meeting Data', meetingData);
    }

    // Generate buffer
    const out = await wb.xlsx.writeBuffer();
    const buffer = Buffer.isBuffer(out) ? out : Buffer.from(out);

    res.setHeader('Content-Disposition', `attachment; filename="subject-${subject.nama}-data.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
