import express from 'express';
import Pertemuan from '../models/Pertemuan.js';
import Kelas from '../models/Kelas.js';
import MataKuliah from '../models/MataKuliah.js';
import User from '../models/User.js';
import { auth } from '../middleware/auth.js';
import mongoose from 'mongoose';

const router = express.Router();

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

// Get dashboard overview
router.get('/overview', auth, async (req, res) => {
  try {
    const { year, startDate, endDate } = req.query;
    let query = {};
    const dateRange = parseDateRangeQuery({ year, startDate, endDate });

    if (dateRange.error) {
      return res.status(400).json({ message: dateRange.error });
    }
    
    // Filter by user role
    if (req.user.role === 'dosen') {
      query.dosen_id = req.user._id;
    }
    if (dateRange.range) {
      query.tanggal = dateRange.range;
    }

    const kelasQuery = year
      ? { tahun_ajaran: { $regex: String(year).trim() } }
      : {};
    const mataKuliahQuery = req.user.role === 'dosen'
      ? { dosen_id: req.user._id }
      : {};
    if (dateRange.range) {
      mataKuliahQuery.createdAt = dateRange.range;
    }

    const totalKelas = await Kelas.countDocuments(kelasQuery);
    const totalMataKuliah = await MataKuliah.countDocuments(
      mataKuliahQuery
    );
    const totalPertemuan = await Pertemuan.countDocuments(query);
    const totalDosen = await User.countDocuments({ role: 'dosen' });

    // Get recent meetings
    const recentMeetings = await Pertemuan.find(query)
      .populate('dosen_id', 'nama_lengkap')
      .populate('mata_kuliah_id', 'nama')
      .sort({ tanggal: -1 })
      .limit(5);

    // Get focus statistics
    const allMeetings = await Pertemuan.find(query);
    const totals = allMeetings.reduce((acc, meeting) => {
      acc.totalFocus += meeting.hasil_akhir_kelas.fokus || 0;
      acc.totalFocusScore += Number(meeting.hasil_akhir_kelas.average_focus_score || 0);
      acc.weightedScoreSum += Number(meeting.hasil_akhir_kelas.average_focus_score || 0) * Math.max(1, Number(meeting.hasil_akhir_kelas.jumlah_hadir || meeting.durasi_pertemuan || 1));
      acc.weightSum += Math.max(1, Number(meeting.hasil_akhir_kelas.jumlah_hadir || meeting.durasi_pertemuan || 1));
      acc.count++;
      return acc;
    }, { totalFocus: 0, totalFocusScore: 0, weightedScoreSum: 0, weightSum: 0, count: 0 });

    const averageFocus = totals.count > 0
      ? (totals.totalFocus / totals.count).toFixed(2)
      : 0;
    const averageFocusScore = totals.weightSum > 0
      ? Number((totals.weightedScoreSum / totals.weightSum).toFixed(2))
      : (totals.count > 0 ? Number((totals.totalFocusScore / totals.count).toFixed(2)) : 0);

    // Get class performance
    const classPerformance = await Pertemuan.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$kelas',
          averageFocus: { $avg: '$hasil_akhir_kelas.fokus' },
          averageFocusScore: { $avg: '$hasil_akhir_kelas.average_focus_score' },
          totalMeetings: { $sum: 1 }
        }
      },
      { $sort: { averageFocus: -1 } },
      { $limit: 5 }
    ]).then((rows) => rows.map((r) => ({
      ...r,
      averageFocus: r.averageFocus ? Number(r.averageFocus.toFixed(2)) : 0,
      averageFocusScore: r.averageFocusScore ? Number(r.averageFocusScore.toFixed(2)) : 0,
    })));

    // Get dosen performance (admin only)
    let dosenPerformance = [];
    if (req.user.role === 'admin') {
      dosenPerformance = await Pertemuan.aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'users',
            localField: 'dosen_id',
            foreignField: '_id',
            as: 'dosen'
          }
        },
        { $unwind: '$dosen' },
        {
          $group: {
            _id: '$dosen_id',
            nama_lengkap: { $first: '$dosen.nama_lengkap' },
            averageFocus: { $avg: '$hasil_akhir_kelas.fokus' },
            averageFocusScore: { $avg: '$hasil_akhir_kelas.average_focus_score' },
            totalMeetings: { $sum: 1 },
            totalClasses: { $addToSet: '$kelas' }
          }
        },
        {
          $addFields: {
            totalClasses: { $size: '$totalClasses' }
          }
        },
        { $sort: { averageFocus: -1 } },
        { $limit: 8 }
      ]).then((rows) => rows.map((r) => ({
        ...r,
        averageFocus: r.averageFocus ? Number(r.averageFocus.toFixed(2)) : 0,
        averageFocusScore: r.averageFocusScore ? Number(r.averageFocusScore.toFixed(2)) : 0,
      })));
    }

    res.json({
      stats: {
        totalKelas,
        totalMataKuliah,
        totalPertemuan,
        totalDosen,
        averageFocus: parseFloat(averageFocus),
        averageFocusScore,
      },
      recentMeetings,
      classPerformance,
      dosenPerformance
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get focus trends
router.get('/focus-trends', auth, async (req, res) => {
  try {
    let matchQuery = {};
    const interval = String(req.query.interval || 'month').toLowerCase();
    const subjectId = req.query.subjectId ? String(req.query.subjectId) : '';
    const dateRange = parseDateRangeQuery(req.query || {});
    if (dateRange.error) {
      return res.status(400).json({ message: dateRange.error });
    }
    
    if (req.user.role === 'dosen') {
      matchQuery.dosen_id = req.user._id;
    }
    if (subjectId) {
      try {
        matchQuery.mata_kuliah_id = new mongoose.Types.ObjectId(subjectId);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid subjectId' });
      }
    }
    if (dateRange.range) {
      matchQuery.tanggal = dateRange.range;
    }

    let focusTrends = [];
    if (interval === 'week') {
      focusTrends = await Pertemuan.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: {
              week: { $isoWeek: '$tanggal' },
              year: { $isoWeekYear: '$tanggal' }
            },
            averageFocus: { $avg: '$hasil_akhir_kelas.fokus' },
            averageFocusScore: { $avg: '$hasil_akhir_kelas.average_focus_score' },
            totalMeetings: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.week': 1 } }
      ]);
    } else {
      focusTrends = await Pertemuan.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: {
              month: { $month: '$tanggal' },
              year: { $year: '$tanggal' }
            },
            averageFocus: { $avg: '$hasil_akhir_kelas.fokus' },
            averageFocusScore: { $avg: '$hasil_akhir_kelas.average_focus_score' },
            totalMeetings: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);
    }

    let formattedTrends = [];
    if (interval === 'week') {
      formattedTrends = focusTrends.map(trend => ({
        month: `${trend._id.year}-W${String(trend._id.week).padStart(2, '0')}`,
        focus: Math.round(Number(trend.averageFocus || 0)),
        focusScore: Number((Number(trend.averageFocusScore || 0)).toFixed(2)),
        meetings: trend.totalMeetings
      }));
    } else {
      formattedTrends = focusTrends.map(trend => ({
        month: `${trend._id.year}-${String(trend._id.month).padStart(2, '0')}`,
        focus: Math.round(Number(trend.averageFocus || 0)),
        focusScore: Number((Number(trend.averageFocusScore || 0)).toFixed(2)),
        meetings: trend.totalMeetings
      }));
    }

    res.json(formattedTrends);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
