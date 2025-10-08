import express from 'express';
import Pertemuan from '../models/Pertemuan.js';
import MataKuliah from '../models/MataKuliah.js';
import Kelas from '../models/Kelas.js';
import User from '../models/User.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Get dosen statistics
router.get('/dosen-stats', auth, async (req, res) => {
  try {
    if (req.user.role !== 'dosen') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get subjects taught by this dosen
    const subjects = await MataKuliah.find({ dosen_id: req.user._id })
      .select('nama kode kelas');

    // Get meetings for this dosen
    const meetings = await Pertemuan.find({ dosen_id: req.user._id })
      .populate('mata_kuliah_id', 'nama kode');

    // Calculate statistics
    const totalSubjects = subjects.length;
    const totalClasses = [...new Set(subjects.flatMap(s => s.kelas))].length;
    const totalMeetings = meetings.length;
    const averageFocus = meetings.length > 0 
      ? meetings.reduce((sum, m) => sum + m.hasil_akhir_kelas.fokus, 0) / meetings.length
      : 0;

    // Subject statistics
    const subjectStats = subjects.map(subject => {
      const subjectMeetings = meetings.filter(m => m.mata_kuliah_id._id.toString() === subject._id.toString());
      const avgFocus = subjectMeetings.length > 0 
        ? subjectMeetings.reduce((sum, m) => sum + m.hasil_akhir_kelas.fokus, 0) / subjectMeetings.length
        : 0;

      return {
        _id: subject._id,
        nama: subject.nama,
        kode: subject.kode,
        kelas: subject.kelas,
        averageFocus: avgFocus,
        totalMeetings: subjectMeetings.length
      };
    });

    // Focus trends by month
    const focusTrends = await Pertemuan.aggregate([
      { $match: { dosen_id: req.user._id } },
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

    // Class performance
    const classPerformance = await Pertemuan.aggregate([
      { $match: { dosen_id: req.user._id } },
      {
        $group: {
          _id: '$kelas',
          averageFocus: { $avg: '$hasil_akhir_kelas.fokus' },
          totalMeetings: { $sum: 1 }
        }
      },
      { $sort: { averageFocus: -1 } }
    ]);

    const formattedClassPerformance = classPerformance.map(item => ({
      class: item._id,
      focus: Math.round(item.averageFocus),
      meetings: item.totalMeetings
    }));

    res.json({
      totalSubjects,
      totalClasses,
      totalMeetings,
      averageFocus,
      subjects: subjectStats,
      focusTrends: formattedTrends,
      classPerformance: formattedClassPerformance
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get admin statistics
router.get('/admin-stats', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // User statistics
    const totalDosen = await User.countDocuments({ role: 'dosen' });
    const totalAdmin = await User.countDocuments({ role: 'admin' });
    const totalUsers = await User.countDocuments();

    // System statistics
    const totalSubjects = await MataKuliah.countDocuments();
    const totalClasses = await Kelas.countDocuments();
    const totalMeetings = await Pertemuan.countDocuments();
    
    const allMeetings = await Pertemuan.find();
    const systemAverageFocus = allMeetings.length > 0 
      ? allMeetings.reduce((sum, m) => sum + m.hasil_akhir_kelas.fokus, 0) / allMeetings.length
      : 0;

    res.json({
      totalDosen,
      totalAdmin,
      totalUsers,
      systemStats: {
        totalSubjects,
        totalClasses,
        totalMeetings,
        averageFocus: systemAverageFocus
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;