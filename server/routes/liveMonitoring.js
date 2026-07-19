

import express from 'express';
import axios from 'axios';
import LiveSession from '../models/LiveSession.js';
import Schedule from '../models/Schedule.js';
import Kelas from '../models/Kelas.js';
import Pertemuan from '../models/Pertemuan.js';
import { auth } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';

const router = express.Router();

const INFERENCE_URL = process.env.INFERENCE_URL || 'http://127.0.0.1:5001';
const latestFrames = new Map();

function toObjectIdOrNull(value) {
  const raw = typeof value === 'string' ? value : value?._id || value?.id;
  if (!raw) return null;
  if (!mongoose.Types.ObjectId.isValid(String(raw))) return null;
  return new mongoose.Types.ObjectId(String(raw));
}

function toDateOrNow(value) {
  const next = value ? new Date(value) : new Date();
  return Number.isNaN(next.getTime()) ? new Date() : next;
}

function normalizeSummaryRows(summaryRows = []) {
  if (!Array.isArray(summaryRows)) return [];
  return summaryRows.map((row, index) => {
    if (Array.isArray(row)) {
      return {
        id: String(row?.[0] ?? `person-${index + 1}`),
        label: String(row?.[1] ?? `Person ${index + 1}`),
        focused: Number(row?.[2] ?? 0),
        not_focused: Number(row?.[3] ?? 0),
        total: Number(row?.[4] ?? 0),
        first_seen: String(row?.[5] ?? ''),
        last_seen: String(row?.[6] ?? ''),
      };
    }
    return {
      id: String(row?.id ?? `person-${index + 1}`),
      label: String(row?.label ?? `Person ${index + 1}`),
      focused: Number(row?.focused ?? 0),
      not_focused: Number(row?.notFocused ?? row?.not_focused ?? 0),
      total: Number(row?.total ?? 0),
      first_seen: String(row?.firstSeen ?? row?.first_seen ?? ''),
      last_seen: String(row?.lastSeen ?? row?.last_seen ?? ''),
    };
  });
}

function normalizeEventRows(eventRows = []) {
  if (!Array.isArray(eventRows)) return [];
  return eventRows.map((row, index) => {
    if (Array.isArray(row)) {
      return {
        timestamp: String(row?.[0] ?? ''),
        id: String(row?.[1] ?? `person-${index + 1}`),
        label: String(row?.[2] ?? `Person ${index + 1}`),
        status: String(row?.[3] ?? ''),
        confidence: Number(row?.[4] ?? 0),
      };
    }
    return {
      timestamp: String(row?.timestamp ?? ''),
      id: String(row?.id ?? `person-${index + 1}`),
      label: String(row?.label ?? `Person ${index + 1}`),
      status: String(row?.status ?? ''),
      confidence: Number(row?.confidence ?? 0),
    };
  });
}

function buildPertemuanMetrics(summaryRows = [], eventRows = []) {
  const totalFocused = summaryRows.reduce((sum, row) => sum + Number(row.focused || 0), 0);
  const totalNotFocused = summaryRows.reduce((sum, row) => sum + Number(row.not_focused || 0), 0);
  const totalMoments = totalFocused + totalNotFocused;
  const focusPct = totalMoments > 0 ? Number(((totalFocused / totalMoments) * 100).toFixed(2)) : 0;
  const notFocusPct = totalMoments > 0 ? Number(((totalNotFocused / totalMoments) * 100).toFixed(2)) : 0;

  const dataFokus = summaryRows.map((row) => {
    const rowTotal = Number(row.total || (row.focused || 0) + (row.not_focused || 0));
    const persenFokus = rowTotal > 0 ? Number(((Number(row.focused || 0) / rowTotal) * 100).toFixed(2)) : 0;
    const persenTidakFokus = rowTotal > 0 ? Number(((Number(row.not_focused || 0) / rowTotal) * 100).toFixed(2)) : 0;
    let status = 'Kurang';
    if (persenFokus >= 80) status = 'Baik';
    else if (persenFokus >= 60) status = 'Cukup';

    return {
      id_siswa: row.label || row.id,
      fokus: eventRows
        .filter((event) => String(event.id) === String(row.id))
        .map((event) => Number(event.confidence || 0)),
      jumlah_sesi_fokus: Number(row.focused || 0),
      durasi_fokus: Number(row.focused || 0),
      waktu_hadir: rowTotal,
      persen_fokus: persenFokus,
      persen_tidak_fokus: persenTidakFokus,
      status,
    };
  });

  return {
    dataFokus,
    hasilAkhirKelas: {
      fokus: focusPct,
      tidak_fokus: notFocusPct,
      jumlah_hadir: summaryRows.length,
      fokus_count: totalFocused,
      tidak_fokus_count: totalNotFocused,
    },
  };
}

router.post('/frame', (req, res) => {
  try {
    const { session_id, frame, predictions, timestamp } = req.body || {};
    const sid = String(session_id || '');
    if (!sid) return res.status(400).json({ message: 'session_id is required' });
    if (typeof frame !== 'string') return res.status(400).json({ message: 'frame must be a base64 string' });
    const preds = Array.isArray(predictions) ? predictions : [];
    latestFrames.set(sid, { frame, predictions: preds, timestamp: Number(timestamp) || Date.now() });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to store frame' });
  }
});

router.get('/frame/:sessionId', auth, (req, res) => {
  const { sessionId } = req.params;
  const data = latestFrames.get(String(sessionId));
  if (!data) return res.json({ frame: null, predictions: [], timestamp: null });
  res.json(data);
});

router.post('/pipeline/start', auth, async (req, res) => {
  try {
    const {
      camera_index = 0,
      seats = [],
      session_id,
      confidence = 0.5,
      max_fps = 10,
      record_interval = 5,
      jpeg_quality = 72
    } = req.body || {};

    const sid = String(session_id || '');
    if (!sid) return res.status(400).json({ message: 'session_id is required' });

    const response = await axios.post(
      `${INFERENCE_URL}/start`,
      {
        camera_index,
        seats: Array.isArray(seats) ? seats : [],
        session_id: sid,
        confidence,
        max_fps,
        record_interval,
        jpeg_quality
      },
      { timeout: 60000 }
    );
    res.json(response.data);
  } catch (error) {
    const err = error;
    const status = err?.code === 'ECONNABORTED' ? 504 : (err?.response?.status || 500);
    const message = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to start inference pipeline';
    res.status(status).json({ message });
  }
});

router.post('/pipeline/stop', auth, async (req, res) => {
  try {
    const { session_id } = req.body || {};
    const sid = session_id ? String(session_id) : '';
    const response = await axios.post(
      `${INFERENCE_URL}/stop`,
      sid ? { session_id: sid } : {},
      { timeout: 15000 }
    );
    if (sid) latestFrames.delete(sid);
    res.json(response.data);
  } catch (error) {
    const err = error;
    const status = err?.response?.status || 500;
    const message = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to stop inference pipeline';
    res.status(status).json({ message });
  }
});

router.get('/pipeline/health', auth, async (req, res) => {
  try {
    const response = await axios.get(`${INFERENCE_URL}/health`, { timeout: 5000 });
    res.json({ ok: true, inference_url: INFERENCE_URL, health: response.data });
  } catch (error) {
    const err = error;
    const status = err?.response?.status || 500;
    const message = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Inference runner not reachable';
    res.status(status).json({ ok: false, inference_url: INFERENCE_URL, message });
  }
});

router.get('/pipeline/status', auth, async (req, res) => {
  try {
    const response = await axios.get(`${INFERENCE_URL}/status`, { timeout: 5000 });
    res.json({ ok: true, inference_url: INFERENCE_URL, ...response.data });
  } catch (error) {
    const err = error;
    const status = err?.response?.status || 500;
    const message = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to get inference runner status';
    res.status(status).json({ ok: false, inference_url: INFERENCE_URL, message });
  }
});

// Start live monitoring session
router.post('/start', auth, async (req, res) => {
  try {
    const { jadwal_id, kelas, mata_kuliah_id, mata_kuliah, dosen_id } = req.body || {};

    let scheduleDoc = null;
    let kelasIdToUse = null;
    let kelasStr = String(kelas || '').trim();
    let mataKuliahStr = String(mata_kuliah || '').trim();
    let mkObjectId = toObjectIdOrNull(mata_kuliah_id);
    let dosenIdToUse = req.user._id;

    const jadwalObjectId = toObjectIdOrNull(jadwal_id);
    if (jadwalObjectId) {
      scheduleDoc = await Schedule.findById(jadwalObjectId);
      if (!scheduleDoc) {
        return res.status(404).json({ message: 'Schedule not found' });
      }
      if (req.user.role === 'dosen' && String(scheduleDoc.dosen_id) !== String(req.user._id)) {
        return res.status(403).json({ message: 'Access denied' });
      }
      kelasIdToUse = scheduleDoc.kelas_id || null;
      kelasStr = String(scheduleDoc.kelas || '').trim();
      mataKuliahStr = String(scheduleDoc.mata_kuliah || '').trim();
      mkObjectId = scheduleDoc.mata_kuliah_id ? new mongoose.Types.ObjectId(String(scheduleDoc.mata_kuliah_id)) : null;
      dosenIdToUse = new mongoose.Types.ObjectId(String(scheduleDoc.dosen_id));
    } else {
      if (!kelasStr) return res.status(400).json({ message: 'kelas is required' });
      if (!mataKuliahStr) return res.status(400).json({ message: 'mata_kuliah is required' });
      if (!mkObjectId) {
        return res.status(400).json({ message: 'Invalid mata_kuliah_id' });
      }

      if (req.user.role === 'admin') {
        const adminDosenId = toObjectIdOrNull(dosen_id);
        if (!adminDosenId) return res.status(400).json({ message: 'Invalid dosen_id' });
        dosenIdToUse = adminDosenId;
      }

      const kelasDoc = await Kelas.findOne({ nama_kelas: kelasStr }).select('_id nama_kelas');
      if (kelasDoc) {
        kelasIdToUse = kelasDoc._id;
        kelasStr = kelasDoc.nama_kelas;
      }
    }
    
    const sessionId = uuidv4();
    const liveSession = new LiveSession({
      sessionId,
      jadwal_id: scheduleDoc?._id || jadwalObjectId || null,
      kelas_id: kelasIdToUse,
      kelas: kelasStr,
      mata_kuliah: mataKuliahStr,
      mata_kuliah_id: mkObjectId,
      dosen_id: dosenIdToUse
    });

    await liveSession.save();
    await liveSession.populate('jadwal_id', 'tanggal jam_mulai jam_selesai pertemuan_ke status');
    await liveSession.populate('kelas_id', 'nama_kelas tahun_ajaran semester');
    await liveSession.populate('mata_kuliah_id', 'nama kode');
    await liveSession.populate('dosen_id', 'nama_lengkap');

    res.status(201).json(liveSession);
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to start live monitoring session' });
  }
});

// Stop live monitoring session
router.post('/stop/:sessionId', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { record_summary, record_events, record_status } = req.body || {};
    
    const liveSession = await LiveSession.findOne({ sessionId });
    if (!liveSession) {
      return res.status(404).json({ message: 'Session not found' });
    }

    liveSession.endTime = new Date();
    liveSession.isActive = false;
    liveSession.summary.totalDuration = Math.floor((liveSession.endTime - liveSession.startTime) / 1000 / 60); // in minutes

    await liveSession.save();

    const scheduleDoc = liveSession.jadwal_id ? await Schedule.findById(liveSession.jadwal_id) : null;
    const summaryRows = normalizeSummaryRows(record_summary);
    const eventRows = normalizeEventRows(record_events);
    const { dataFokus, hasilAkhirKelas } = buildPertemuanMetrics(summaryRows, eventRows);
    const pertemuanPayload = {
      sessionId: liveSession.sessionId,
      jadwal_id: liveSession.jadwal_id || scheduleDoc?._id || null,
      live_session_id: liveSession._id,
      kelas_id: liveSession.kelas_id || scheduleDoc?.kelas_id || null,
      tanggal: scheduleDoc?.tanggal || liveSession.startTime || new Date(),
      pertemuan_ke: scheduleDoc?.pertemuan_ke || 1,
      kelas: liveSession.kelas,
      mata_kuliah: liveSession.mata_kuliah,
      mata_kuliah_id: liveSession.mata_kuliah_id,
      dosen_id: liveSession.dosen_id,
      durasi_pertemuan: Math.max(1, Number(liveSession.summary.totalDuration || 0)),
      topik: scheduleDoc?.topik || 'Live Monitoring Session',
      catatan: String(record_status || '').trim(),
      data_fokus: dataFokus,
      hasil_akhir_kelas: hasilAkhirKelas,
      record_events: eventRows,
    };

    const pertemuan = await Pertemuan.findOneAndUpdate(
      { sessionId: liveSession.sessionId },
      pertemuanPayload,
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    if (liveSession.jadwal_id) {
      await Schedule.findByIdAndUpdate(liveSession.jadwal_id, { status: 'completed' });
    }

    res.json({ liveSession, pertemuan });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add detection data to live session
router.post('/detection/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const detectionData = req.body;

    const liveSession = await LiveSession.findOne({ sessionId });
    if (!liveSession) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Calculate focus percentage
    const totalDetections = detectionData.totalDetections || 0;
    const focusedCount = detectionData.focusedCount || 0;
    const focusPercentage = totalDetections > 0 ? Math.round((focusedCount / totalDetections) * 100) : 0;

    const newDetection = {
      ...detectionData,
      focusPercentage,
      timestamp: new Date()
    };

    liveSession.detectionData.push(newDetection);
    await liveSession.save();

    res.json({ message: 'Detection data added successfully', focusPercentage });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Save session state
router.post('/saveState/:sessionId', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { state } = req.body;
    
    const liveSession = await LiveSession.findOne({ sessionId });
    if (!liveSession) {
      return res.status(404).json({ message: 'Session not found' });
    }
    
    liveSession.state = state;
    await liveSession.save();
    
    res.json({ message: 'Session state saved successfully', state });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get live session data
router.get('/session/:sessionId', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const liveSession = await LiveSession.findOne({ sessionId })
      .populate('jadwal_id', 'tanggal jam_mulai jam_selesai pertemuan_ke status')
      .populate('kelas_id', 'nama_kelas tahun_ajaran semester')
      .populate('mata_kuliah_id', 'nama kode')
      .populate('dosen_id', 'nama_lengkap');

    if (!liveSession) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json(liveSession);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all live sessions
router.get('/sessions', auth, async (req, res) => {
  try {
    const sessions = await LiveSession.find()
      .populate('jadwal_id', 'tanggal jam_mulai jam_selesai pertemuan_ke status')
      .populate('kelas_id', 'nama_kelas tahun_ajaran semester')
      .populate('mata_kuliah_id', 'nama kode')
      .populate('dosen_id', 'nama_lengkap')
      .sort({ startTime: -1 });

    res.json(sessions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get active sessions
router.get('/active', auth, async (req, res) => {
  try {
    const activeSessions = await LiveSession.find({ isActive: true })
      .populate('jadwal_id', 'tanggal jam_mulai jam_selesai pertemuan_ke status')
      .populate('kelas_id', 'nama_kelas tahun_ajaran semester')
      .populate('mata_kuliah_id', 'nama kode')
      .populate('dosen_id', 'nama_lengkap');

    res.json(activeSessions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
