import express from 'express';
import SessionRecord from '../models/SessionRecord.js';
import LiveSession from '../models/LiveSession.js';
import Schedule from '../models/Schedule.js';
import { auth } from '../middleware/auth.js';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';

const router = express.Router();

function toObjectIdOrNull(value) {
  const raw = typeof value === 'string' ? value : value?._id || value?.id;
  if (!raw) return null;
  if (!mongoose.Types.ObjectId.isValid(String(raw))) return null;
  return new mongoose.Types.ObjectId(String(raw));
}

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

function parseTimeOnDate(baseDate, timeValue) {
  if (!timeValue) return null;
  if (timeValue instanceof Date) return isNaN(timeValue.getTime()) ? null : timeValue;

  const base = baseDate ? new Date(baseDate) : new Date();
  if (isNaN(base.getTime())) return null;

  if (typeof timeValue === 'number') {
    const dt = new Date(timeValue);
    return isNaN(dt.getTime()) ? null : dt;
  }

  if (typeof timeValue === 'string') {
    const trimmed = timeValue.trim();
    const asDate = new Date(trimmed);
    if (!isNaN(asDate.getTime())) return asDate;

    const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (match) {
      const hours = Number(match[1]);
      const minutes = Number(match[2]);
      const seconds = match[3] ? Number(match[3]) : 0;
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59) {
        const dt = new Date(base);
        dt.setHours(hours, minutes, seconds, 0);
        return dt;
      }
    }
  }

  return null;
}

function normalizeDurationMs(value, fallbackMs) {
  const v = Number(value);
  if (!Number.isFinite(v) || v <= 0) return fallbackMs;
  if (v < 1000) return Math.round(v * 60000);
  return Math.round(v);
}

function averageFocusPercentage(detectionData) {
  if (!Array.isArray(detectionData) || detectionData.length === 0) return 0;
  const values = detectionData
    .map(d => Number(d?.focusPercentage))
    .filter(n => Number.isFinite(n));
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

async function enrichSessionRecordPayload(payload = {}) {
  const next = { ...payload };
  const liveSessionObjectId = toObjectIdOrNull(next.liveSessionId || next.live_session_id);
  const liveSession =
    liveSessionObjectId
      ? await LiveSession.findById(liveSessionObjectId)
      : next.sessionId
        ? await LiveSession.findOne({ sessionId: String(next.sessionId) })
        : null;

  const jadwalObjectId = toObjectIdOrNull(next.jadwalId || next.jadwal_id) || liveSession?.jadwal_id || null;
  const scheduleDoc = jadwalObjectId ? await Schedule.findById(jadwalObjectId) : null;

  const kelasObjectId = toObjectIdOrNull(next.kelasId || next.kelas_id) || liveSession?.kelas_id || scheduleDoc?.kelas_id || null;
  const mataKuliahObjectId = toObjectIdOrNull(next.mataKuliahId || next.mata_kuliah_id) || liveSession?.mata_kuliah_id || scheduleDoc?.mata_kuliah_id || null;
  const dosenObjectId = toObjectIdOrNull(next.dosenId || next.dosen_id) || liveSession?.dosen_id || scheduleDoc?.dosen_id || null;

  return {
    ...next,
    live_session_id: liveSession?._id || liveSessionObjectId || null,
    jadwal_id: scheduleDoc?._id || jadwalObjectId || null,
    kelas_id: kelasObjectId,
    mata_kuliah_id: mataKuliahObjectId,
    dosen_id: dosenObjectId,
    kelas: String(next.className || next.kelas || liveSession?.kelas || scheduleDoc?.kelas || '').trim(),
    mata_kuliah: String(next.subjectName || next.mata_kuliah || liveSession?.mata_kuliah || scheduleDoc?.mata_kuliah || '').trim()
  };
}

function analyzeLabels(detectionData) {
  const totals = new Map();
  let totalDetections = 0;

  if (Array.isArray(detectionData)) {
    detectionData.forEach(d => {
      const td = Number(d?.totalDetections);
      if (Number.isFinite(td) && td > 0) totalDetections += td;

      const lc = d?.label_counts || d?.labelCounts || null;
      if (lc && typeof lc === 'object') {
        Object.entries(lc).forEach(([label, count]) => {
          const c = Number(count);
          if (!Number.isFinite(c) || c <= 0) return;
          totals.set(label, (totals.get(label) || 0) + c);
        });
      }
    });
  }

  if (totals.size === 0 && Array.isArray(detectionData)) {
    const known = [
      ['focused', 'focusedCount'],
      ['not_focused', 'notFocusedCount'],
      ['yawning', 'yawningCount'],
      ['sleeping', 'sleepingCount'],
      ['using_phone', 'phoneUsingCount'],
      ['chatting', 'chattingCount'],
      ['writing', 'writingCount']
    ];

    known.forEach(([label, key]) => {
      const sum = detectionData.reduce((acc, d) => {
        const v = Number(d?.[key]);
        return Number.isFinite(v) ? acc + v : acc;
      }, 0);
      if (sum > 0) totals.set(label, sum);
    });
    totalDetections = Math.max(
      totalDetections,
      detectionData.reduce((acc, d) => {
        const v = Number(d?.totalDetections);
        return Number.isFinite(v) ? acc + v : acc;
      }, 0)
    );
  }

  return Array.from(totals.entries())
    .map(([label, count]) => ({
      gesture_type: label,
      total_count: count,
      average_duration: 0,
      percentage_of_session: totalDetections > 0 ? (count / totalDetections) * 100 : 0
    }))
    .sort((a, b) => b.total_count - a.total_count);
}

// Create new session record
router.post('/', auth, async (req, res) => {
  try {
    const enriched = await enrichSessionRecordPayload(req.body || {});
    const {
      sessionId,
      sessionName,
      seatData,
      detectionData,
      summary,
      tanggal,
      jamMulai,
      jamSelesai,
      durasi
    } = req.body;

    const baseDate = tanggal ? new Date(tanggal) : new Date();
    const jamMulaiDate = parseTimeOnDate(baseDate, jamMulai) || new Date(baseDate);
    const jamSelesaiDate = parseTimeOnDate(baseDate, jamSelesai) || new Date(jamMulaiDate);

    const safeSeatData = Array.isArray(seatData) ? seatData : [];
    const safeDetectionData = Array.isArray(detectionData) ? detectionData : [];

    const durationFromSummaryMs = Number(summary?.sessionDuration);
    const sessionDurationMs = Number.isFinite(durationFromSummaryMs) && durationFromSummaryMs > 0
      ? durationFromSummaryMs
      : Math.max(1, jamSelesaiDate.getTime() - jamMulaiDate.getTime());
    const durasiMs = normalizeDurationMs(durasi, sessionDurationMs);

    const peakFocusTime = safeSeatData.length > 0
      ? Math.max(...safeSeatData.map(s => Number(s?.total_focus_duration) || 0))
      : 0;

    const avgFocusPct = averageFocusPercentage(safeDetectionData);

    const payload = {
      sessionId,
      live_session_id: enriched.live_session_id,
      jadwal_id: enriched.jadwal_id,
      kelas_id: enriched.kelas_id,
      sessionName,
      kelas: enriched.kelas,
      mata_kuliah: enriched.mata_kuliah,
      mata_kuliah_id: enriched.mata_kuliah_id,
      dosen_id: enriched.dosen_id || req.user._id,
      tanggal: baseDate,
      jam_mulai: jamMulaiDate,
      jam_selesai: jamSelesaiDate,
      durasi: durasiMs,
      seat_data: safeSeatData.map(seat => ({
        seat_id: Number(seat.seat_id),
        student_id: seat.student_id || `Student-${seat.seat_id}`,
        position: {
          x: seat.x,
          y: seat.y,
          width: seat.width,
          height: seat.height
        },
        focus_duration: seat.total_focus_duration,
        focus_percentage: seat.total_focus_duration > 0
          ? Math.round((seat.total_focus_duration / sessionDurationMs) * 100)
          : 0,
        gesture_history: generateGestureHistory(seat, safeDetectionData),
        final_status: seat.is_occupied ? (seat.total_focus_duration > 0 ? 'Focused' : 'Not Focused') : 'Absent'
      })),
      detection_summary: {
        total_detections: safeDetectionData.length,
        average_focus_percentage: avgFocusPct,
        peak_focus_time: peakFocusTime,
        total_session_duration: sessionDurationMs
      },
      gesture_analysis: analyzeLabels(safeDetectionData)
    };

    const existing = await SessionRecord.findOne({ sessionId });
    if (existing) {
      Object.assign(existing, payload);
      await existing.save();
      return res.status(200).json(existing);
    }

    const sessionRecord = new SessionRecord(payload);
    await sessionRecord.save();
    return res.status(201).json(sessionRecord);
  } catch (error) {
    console.error('Error creating session record:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all session records
router.get('/', auth, async (req, res) => {
  try {
    const records = await SessionRecord.find()
      .populate('jadwal_id', 'tanggal jam_mulai jam_selesai pertemuan_ke status')
      .populate('live_session_id', 'sessionId startTime endTime isActive')
      .populate('kelas_id', 'nama_kelas tahun_ajaran semester')
      .populate('mata_kuliah_id', 'nama kode sks')
      .populate('dosen_id', 'nama_lengkap')
      .sort({ tanggal: -1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get session record by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const record = await SessionRecord.findById(req.params.id)
      .populate('jadwal_id', 'tanggal jam_mulai jam_selesai pertemuan_ke status')
      .populate('live_session_id', 'sessionId startTime endTime isActive')
      .populate('kelas_id', 'nama_kelas tahun_ajaran semester')
      .populate('mata_kuliah_id', 'nama kode sks')
      .populate('dosen_id', 'nama_lengkap departemen');
    
    if (!record) {
      return res.status(404).json({ message: 'Session record not found' });
    }
    
    res.json(record);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Export session record to Excel
router.get('/export/:id', auth, async (req, res) => {
  try {
    const record = await SessionRecord.findById(req.params.id)
      .populate('dosen_id', 'nama_lengkap');

    if (!record) {
      return res.status(404).json({ message: 'Session record not found' });
    }

    // Create workbook
    const wb = new ExcelJS.Workbook();

    // Session Info Sheet
    const sessionInfo = [
      ['Session Information'],
      ['Session Name', record.sessionName],
      ['Class', record.kelas],
      ['Subject', record.mata_kuliah],
      ['Instructor', record.dosen_id.nama_lengkap],
      ['Date', record.tanggal.toLocaleDateString()],
      ['Start Time', record.jam_mulai.toLocaleTimeString()],
      ['End Time', record.jam_selesai.toLocaleTimeString()],
      ['Duration (minutes)', Math.round(record.durasi / 60000)],
      [],
      ['Summary'],
      ['Total Students', record.seat_data.length],
      ['Average Focus %', record.detection_summary.average_focus_percentage.toFixed(2)],
      ['Peak Focus Duration (seconds)', Math.round(record.detection_summary.peak_focus_time / 1000)],
      ['Total Session Duration (minutes)', Math.round(record.detection_summary.total_session_duration / 60000)]
    ];

    // Student Data Sheet
    const studentData = record.seat_data.map(seat => ({
      'Seat ID': seat.seat_id,
      'Student ID': seat.student_id,
      'Position X': seat.position.x,
      'Position Y': seat.position.y,
      'Focus Duration (seconds)': Math.round(seat.focus_duration / 1000),
      'Focus Percentage': seat.focus_percentage,
      'Final Status': seat.final_status,
      'Dominant Gesture': seat.gesture_history.length > 0 ? 
        seat.gesture_history.reduce((a, b) => a.count > b.count ? a : b).gesture : 'None',
      'Gesture Changes': seat.gesture_history.length
    }));

    // Gesture Analysis Sheet
    const gestureData = record.gesture_analysis.map(analysis => ({
      'Gesture Type': analysis.gesture_type,
      'Total Occurrences': analysis.total_count,
      'Average Duration (seconds)': Math.round(analysis.average_duration / 1000),
      'Percentage of Session': analysis.percentage_of_session.toFixed(2)
    }));

    // Add sheets to workbook
    addAoaWorksheet(wb, 'Session Info', sessionInfo);
    addJsonWorksheet(wb, 'Student Data', studentData);
    addJsonWorksheet(wb, 'Gesture Analysis', gestureData);

    // Generate buffer
    const out = await wb.xlsx.writeBuffer();
    const buffer = Buffer.isBuffer(out) ? out : Buffer.from(out);

    res.setHeader('Content-Disposition', `attachment; filename="session-${record.sessionName}-${record.tanggal.toISOString().split('T')[0]}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Helper function to generate gesture history
function generateGestureHistory(seat, detectionData) {
  const gestures = ['focused', 'looking_away', 'sleeping', 'using_phone', 'chatting'];
  const history = [];
  
  // Simulate gesture detection based on seat data
  if (seat.face_detected) {
    history.push({ gesture: 'focused', count: Math.floor(Math.random() * 10) + 5, duration: seat.total_focus_duration });
  }
  
  if (seat.is_occupied && !seat.face_detected) {
    const randomGesture = gestures[Math.floor(Math.random() * (gestures.length - 1)) + 1];
    history.push({ gesture: randomGesture, count: Math.floor(Math.random() * 5) + 1, duration: Math.random() * 30000 });
  }
  
  return history;
}

export default router;
