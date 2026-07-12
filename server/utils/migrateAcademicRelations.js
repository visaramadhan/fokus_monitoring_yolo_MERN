import dotenv from 'dotenv';
import mongoose from 'mongoose';

import User from '../models/User.js';
import Kelas from '../models/Kelas.js';
import MataKuliah from '../models/MataKuliah.js';
import Schedule from '../models/Schedule.js';
import LiveSession from '../models/LiveSession.js';
import Pertemuan from '../models/Pertemuan.js';
import SessionRecord from '../models/SessionRecord.js';

dotenv.config();

const isApply = process.argv.includes('--apply');
const dryRun = !isApply;

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function toIdString(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

function sameDay(a, b) {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function absTimeDiff(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return Number.MAX_SAFE_INTEGER;
  return Math.abs(da.getTime() - db.getTime());
}

function buildMaps(kelasDocs, mataKuliahDocs) {
  const kelasByName = new Map();
  for (const kelas of kelasDocs) {
    kelasByName.set(normalizeText(kelas.nama_kelas), kelas);
  }

  const mataKuliahByComposite = new Map();
  const mataKuliahByName = new Map();
  for (const mk of mataKuliahDocs) {
    const nameKey = normalizeText(mk.nama);
    const dosenKey = toIdString(mk.dosen_id);
    mataKuliahByComposite.set(`${nameKey}::${dosenKey}`, mk);
    if (!mataKuliahByName.has(nameKey)) mataKuliahByName.set(nameKey, []);
    mataKuliahByName.get(nameKey).push(mk);
  }

  return { kelasByName, mataKuliahByComposite, mataKuliahByName };
}

function findSubject({ mataKuliahId, mataKuliahName, dosenId, maps }) {
  if (mataKuliahId) return null;
  const nameKey = normalizeText(mataKuliahName);
  if (!nameKey) return null;

  if (dosenId) {
    const direct = maps.mataKuliahByComposite.get(`${nameKey}::${String(dosenId)}`);
    if (direct) return direct;
  }

  const candidates = maps.mataKuliahByName.get(nameKey) || [];
  return candidates.length === 1 ? candidates[0] : null;
}

function scoreSchedule(schedule, context) {
  let score = 0;
  if (!schedule) return score;

  if (context.mataKuliahId && toIdString(schedule.mata_kuliah_id) === String(context.mataKuliahId)) score += 5;
  if (context.dosenId && toIdString(schedule.dosen_id) === String(context.dosenId)) score += 5;
  if (context.kelasId && toIdString(schedule.kelas_id) === String(context.kelasId)) score += 4;
  if (context.kelasName && normalizeText(schedule.kelas) === normalizeText(context.kelasName)) score += 3;
  if (context.pertemuanKe && Number(schedule.pertemuan_ke) === Number(context.pertemuanKe)) score += 2;
  if (context.tanggal && sameDay(schedule.tanggal, context.tanggal)) score += 4;
  return score;
}

function findBestSchedule(schedules, context) {
  let best = null;
  let bestScore = 0;

  for (const schedule of schedules) {
    const score = scoreSchedule(schedule, context);
    if (score > bestScore) {
      best = schedule;
      bestScore = score;
      continue;
    }
    if (score === bestScore && score > 0 && best && context.tanggal) {
      const currentDiff = absTimeDiff(schedule.tanggal, context.tanggal);
      const bestDiff = absTimeDiff(best.tanggal, context.tanggal);
      if (currentDiff < bestDiff) best = schedule;
    }
  }

  if (bestScore < 8) return null;
  return best;
}

async function migrateSchedules({ schedules, maps, stats }) {
  for (const schedule of schedules) {
    let changed = false;
    const kelasDoc = !schedule.kelas_id ? maps.kelasByName.get(normalizeText(schedule.kelas)) : null;
    if (!schedule.kelas_id && kelasDoc) {
      schedule.kelas_id = kelasDoc._id;
      changed = true;
      stats.scheduleKelasLinked += 1;
    }

    if (!schedule.mata_kuliah && schedule.mata_kuliah_id) {
      const mk = await MataKuliah.findById(schedule.mata_kuliah_id).select('nama');
      if (mk) {
        schedule.mata_kuliah = mk.nama;
        changed = true;
      }
    }

    if (!schedule.dosen_name && schedule.dosen_id) {
      const user = await User.findById(schedule.dosen_id).select('nama_lengkap');
      if (user) {
        schedule.dosen_name = user.nama_lengkap;
        changed = true;
      }
    }

    if (changed && !dryRun) {
      await schedule.save();
    }
    if (changed) stats.scheduleUpdated += 1;
  }
}

async function migrateLiveSessions({ liveSessions, schedules, maps, stats }) {
  for (const session of liveSessions) {
    let changed = false;

    if (!session.kelas_id && session.kelas) {
      const kelasDoc = maps.kelasByName.get(normalizeText(session.kelas));
      if (kelasDoc) {
        session.kelas_id = kelasDoc._id;
        changed = true;
        stats.liveSessionKelasLinked += 1;
      }
    }

    if (!session.mata_kuliah_id) {
      const mk = findSubject({
        mataKuliahId: session.mata_kuliah_id,
        mataKuliahName: session.mata_kuliah,
        dosenId: session.dosen_id,
        maps
      });
      if (mk) {
        session.mata_kuliah_id = mk._id;
        changed = true;
        stats.liveSessionSubjectLinked += 1;
      }
    }

    if (!session.jadwal_id) {
      const bestSchedule = findBestSchedule(schedules, {
        mataKuliahId: toIdString(session.mata_kuliah_id),
        dosenId: toIdString(session.dosen_id),
        kelasId: toIdString(session.kelas_id),
        kelasName: session.kelas,
        tanggal: session.startTime || session.createdAt
      });
      if (bestSchedule) {
        session.jadwal_id = bestSchedule._id;
        if (!session.kelas_id && bestSchedule.kelas_id) session.kelas_id = bestSchedule.kelas_id;
        changed = true;
        stats.liveSessionScheduleLinked += 1;
      }
    }

    if (changed && !dryRun) {
      await session.save();
    }
    if (changed) stats.liveSessionUpdated += 1;
  }
}

async function migratePertemuan({ meetings, schedules, liveSessionsBySessionId, maps, stats }) {
  for (const meeting of meetings) {
    let changed = false;

    const linkedLiveSession = !meeting.live_session_id && meeting.sessionId
      ? liveSessionsBySessionId.get(String(meeting.sessionId))
      : null;

    if (!meeting.live_session_id && linkedLiveSession) {
      meeting.live_session_id = linkedLiveSession._id;
      changed = true;
      stats.pertemuanLiveSessionLinked += 1;
    }

    if (!meeting.kelas_id && meeting.kelas) {
      const kelasDoc = maps.kelasByName.get(normalizeText(meeting.kelas));
      if (kelasDoc) {
        meeting.kelas_id = kelasDoc._id;
        changed = true;
        stats.pertemuanKelasLinked += 1;
      }
    }

    if (!meeting.mata_kuliah_id) {
      const mk = findSubject({
        mataKuliahId: meeting.mata_kuliah_id,
        mataKuliahName: meeting.mata_kuliah,
        dosenId: meeting.dosen_id || linkedLiveSession?.dosen_id,
        maps
      });
      if (mk) {
        meeting.mata_kuliah_id = mk._id;
        changed = true;
        stats.pertemuanSubjectLinked += 1;
      }
    }

    if (!meeting.jadwal_id) {
      const bestSchedule = linkedLiveSession?.jadwal_id
        ? schedules.find((s) => String(s._id) === String(linkedLiveSession.jadwal_id)) || null
        : findBestSchedule(schedules, {
            mataKuliahId: toIdString(meeting.mata_kuliah_id || linkedLiveSession?.mata_kuliah_id),
            dosenId: toIdString(meeting.dosen_id || linkedLiveSession?.dosen_id),
            kelasId: toIdString(meeting.kelas_id || linkedLiveSession?.kelas_id),
            kelasName: meeting.kelas || linkedLiveSession?.kelas,
            tanggal: meeting.tanggal,
            pertemuanKe: meeting.pertemuan_ke
          });

      if (bestSchedule) {
        meeting.jadwal_id = bestSchedule._id;
        if (!meeting.kelas_id && bestSchedule.kelas_id) meeting.kelas_id = bestSchedule.kelas_id;
        changed = true;
        stats.pertemuanScheduleLinked += 1;
      }
    }

    if (changed && !dryRun) {
      await meeting.save();
    }
    if (changed) stats.pertemuanUpdated += 1;
  }
}

async function migrateSessionRecords({ records, schedules, liveSessionsBySessionId, maps, stats }) {
  for (const record of records) {
    let changed = false;

    const linkedLiveSession = !record.live_session_id && record.sessionId
      ? liveSessionsBySessionId.get(String(record.sessionId))
      : null;

    if (!record.live_session_id && linkedLiveSession) {
      record.live_session_id = linkedLiveSession._id;
      changed = true;
      stats.recordLiveSessionLinked += 1;
    }

    if (!record.kelas_id && record.kelas) {
      const kelasDoc = maps.kelasByName.get(normalizeText(record.kelas));
      if (kelasDoc) {
        record.kelas_id = kelasDoc._id;
        changed = true;
        stats.recordKelasLinked += 1;
      }
    }

    if (!record.mata_kuliah_id) {
      const mk = findSubject({
        mataKuliahId: record.mata_kuliah_id,
        mataKuliahName: record.mata_kuliah,
        dosenId: record.dosen_id || linkedLiveSession?.dosen_id,
        maps
      });
      if (mk) {
        record.mata_kuliah_id = mk._id;
        changed = true;
        stats.recordSubjectLinked += 1;
      }
    }

    if (!record.jadwal_id) {
      const bestSchedule = linkedLiveSession?.jadwal_id
        ? schedules.find((s) => String(s._id) === String(linkedLiveSession.jadwal_id)) || null
        : findBestSchedule(schedules, {
            mataKuliahId: toIdString(record.mata_kuliah_id || linkedLiveSession?.mata_kuliah_id),
            dosenId: toIdString(record.dosen_id || linkedLiveSession?.dosen_id),
            kelasId: toIdString(record.kelas_id || linkedLiveSession?.kelas_id),
            kelasName: record.kelas || linkedLiveSession?.kelas,
            tanggal: record.tanggal
          });

      if (bestSchedule) {
        record.jadwal_id = bestSchedule._id;
        if (!record.kelas_id && bestSchedule.kelas_id) record.kelas_id = bestSchedule.kelas_id;
        changed = true;
        stats.recordScheduleLinked += 1;
      }
    }

    if (changed && !dryRun) {
      await record.save();
    }
    if (changed) stats.recordUpdated += 1;
  }
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI || 'mongodb://127.0.0.1:27017/focus_monitoring';
  console.log(`[migration] mode=${dryRun ? 'dry-run' : 'apply'}`);
  console.log(`[migration] connecting=${mongoUri.includes('mongodb.net') ? 'atlas' : 'local'}`);

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });

  const [kelasDocs, mataKuliahDocs, schedules, liveSessions, meetings, records] = await Promise.all([
    Kelas.find(),
    MataKuliah.find(),
    Schedule.find(),
    LiveSession.find(),
    Pertemuan.find(),
    SessionRecord.find()
  ]);

  const maps = buildMaps(kelasDocs, mataKuliahDocs);
  const liveSessionsBySessionId = new Map();
  for (const session of liveSessions) {
    if (session.sessionId) liveSessionsBySessionId.set(String(session.sessionId), session);
  }

  const stats = {
    scheduleUpdated: 0,
    scheduleKelasLinked: 0,
    liveSessionUpdated: 0,
    liveSessionKelasLinked: 0,
    liveSessionSubjectLinked: 0,
    liveSessionScheduleLinked: 0,
    pertemuanUpdated: 0,
    pertemuanLiveSessionLinked: 0,
    pertemuanKelasLinked: 0,
    pertemuanSubjectLinked: 0,
    pertemuanScheduleLinked: 0,
    recordUpdated: 0,
    recordLiveSessionLinked: 0,
    recordKelasLinked: 0,
    recordSubjectLinked: 0,
    recordScheduleLinked: 0
  };

  await migrateSchedules({ schedules, maps, stats });
  await migrateLiveSessions({ liveSessions, schedules, maps, stats });
  await migratePertemuan({ meetings, schedules, liveSessionsBySessionId, maps, stats });
  await migrateSessionRecords({ records, schedules, liveSessionsBySessionId, maps, stats });

  console.log('[migration] summary');
  Object.entries(stats).forEach(([key, value]) => {
    console.log(`- ${key}: ${value}`);
  });

  if (dryRun) {
    console.log('[migration] dry-run selesai, tidak ada perubahan yang disimpan.');
    console.log('[migration] jalankan ulang dengan --apply untuk menyimpan hasil.');
  } else {
    console.log('[migration] apply selesai, perubahan telah disimpan.');
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('[migration] failed:', error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
