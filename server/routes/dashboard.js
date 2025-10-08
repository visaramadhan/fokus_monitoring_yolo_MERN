import express from 'express';
import Pertemuan from '../models/Pertemuan.js';
import Kelas from '../models/Kelas.js';
import MataKuliah from '../models/MataKuliah.js';
import User from '../models/User.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Get dashboard overview
router.get('/overview', auth, async (req, res) => {
  try {
    let query = {};
    
    // Filter by user role
    if (req.user.role === 'dosen') {
      query.dosen_id = req.user._id;
    }

    const totalKelas = await Kelas.countDocuments();
    const totalMataKuliah = await MataKuliah.countDocuments(
      req.user.role === 'dosen' ? { dosen_id: req.user._id } : {}
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
    const totalFocusData = allMeetings.reduce((acc, meeting) => {
      acc.totalFocus += meeting.hasil_akhir_kelas.fokus || 0;
      acc.count++;
      return acc;
    }, { totalFocus: 0, count: 0 });

    const averageFocus = totalFocusData.count > 0 
      ? (totalFocusData.totalFocus / totalFocusData.count).toFixed(2)
      : 0;

    // Get class performance
    const classPerformance = await Pertemuan.aggregate([
      ...(req.user.role === 'dosen' ? [{ $match: { dosen_id: req.user._id } }] : []),
      {
        $group: {
          _id: '$kelas',
          averageFocus: { $avg: '$hasil_akhir_kelas.fokus' },
          totalMeetings: { $sum: 1 }
        }
      },
      { $sort: { averageFocus: -1 } },
      { $limit: 5 }
    ]);

    // Get dosen performance (admin only)
    let dosenPerformance = [];
    if (req.user.role === 'admin') {
      dosenPerformance = await Pertemuan.aggregate([
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
      ]);
    }

    res.json({
      stats: {
        totalKelas,
        totalMataKuliah,
        totalPertemuan,
        totalDosen,
        averageFocus: parseFloat(averageFocus)
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
    
    // Filter by user role
    if (req.user.role === 'dosen') {
      matchQuery.dosen_id = req.user._id;
    }

    const focusTrends = await Pertemuan.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            month: { $month: '$tanggal' },
            year: { $year: '$tanggal' }
          },
          averageFocus: { $avg: '$hasil_akhir_kelas.fokus' },
          totalMeetings: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    const formattedTrends = focusTrends.map(trend => ({
      month: monthNames[trend._id.month - 1],
      focus: Math.round(trend.averageFocus),
      meetings: trend.totalMeetings
    }));

    res.json(formattedTrends);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;