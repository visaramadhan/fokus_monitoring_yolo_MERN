import express from 'express';
import SessionRecord from '../models/SessionRecord.js';
import { auth } from '../middleware/auth.js';
import XLSX from 'xlsx';

const router = express.Router();

// Create new session record
router.post('/', auth, async (req, res) => {
  try {
    const {
      sessionId,
      sessionName,
      className,
      subjectName,
      seatData,
      detectionData,
      summary,
      dosenId,
      tanggal,
      jamMulai,
      jamSelesai,
      durasi
    } = req.body;

    const sessionRecord = new SessionRecord({
      sessionId,
      sessionName,
      kelas: className,
      mata_kuliah: subjectName,
      dosen_id: dosenId || req.user._id,
      tanggal: tanggal || new Date(),
      jam_mulai: jamMulai || new Date(),
      jam_selesai: jamSelesai || new Date(),
      durasi: durasi || summary.sessionDuration,
      seat_data: seatData.map(seat => ({
        seat_id: seat.seat_id,
        student_id: seat.student_id || `Student-${seat.seat_id}`,
        position: {
          x: seat.x,
          y: seat.y,
          width: seat.width,
          height: seat.height
        },
        focus_duration: seat.total_focus_duration,
        focus_percentage: seat.total_focus_duration > 0 ? 
          Math.round((seat.total_focus_duration / summary.sessionDuration) * 100) : 0,
        gesture_history: generateGestureHistory(seat, detectionData),
        final_status: seat.face_detected ? 'Focused' : 'Not Focused'
      })),
      detection_summary: {
        total_detections: detectionData.length,
        average_focus_percentage: summary.averageFocusTime,
        peak_focus_time: Math.max(...seatData.map(s => s.total_focus_duration)),
        total_session_duration: summary.sessionDuration
      },
      gesture_analysis: analyzeGestures(seatData, detectionData)
    });

    await sessionRecord.save();
    res.status(201).json(sessionRecord);
  } catch (error) {
    console.error('Error creating session record:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all session records
router.get('/', auth, async (req, res) => {
  try {
    const records = await SessionRecord.find()
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
    const wb = XLSX.utils.book_new();

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

    const wsInfo = XLSX.utils.aoa_to_sheet(sessionInfo);

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

    const wsStudents = XLSX.utils.json_to_sheet(studentData);

    // Gesture Analysis Sheet
    const gestureData = record.gesture_analysis.map(analysis => ({
      'Gesture Type': analysis.gesture_type,
      'Total Occurrences': analysis.total_count,
      'Average Duration (seconds)': Math.round(analysis.average_duration / 1000),
      'Percentage of Session': analysis.percentage_of_session.toFixed(2)
    }));

    const wsGestures = XLSX.utils.json_to_sheet(gestureData);

    // Add sheets to workbook
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Session Info');
    XLSX.utils.book_append_sheet(wb, wsStudents, 'Student Data');
    XLSX.utils.book_append_sheet(wb, wsGestures, 'Gesture Analysis');

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

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

// Helper function to analyze gestures
function analyzeGestures(seatData, detectionData) {
  const gestureTypes = ['focused', 'looking_away', 'sleeping', 'using_phone', 'chatting'];
  const analysis = [];
  
  gestureTypes.forEach(gestureType => {
    const totalCount = seatData.reduce((sum, seat) => {
      const gestureHistory = generateGestureHistory(seat, detectionData);
      const gestureCount = gestureHistory.filter(g => g.gesture === gestureType).reduce((s, g) => s + g.count, 0);
      return sum + gestureCount;
    }, 0);
    
    const totalDuration = seatData.reduce((sum, seat) => {
      const gestureHistory = generateGestureHistory(seat, detectionData);
      const gestureDuration = gestureHistory.filter(g => g.gesture === gestureType).reduce((s, g) => s + g.duration, 0);
      return sum + gestureDuration;
    }, 0);
    
    const sessionDuration = detectionData.length * 2000; // 2 seconds per detection
    
    analysis.push({
      gesture_type: gestureType,
      total_count: totalCount,
      average_duration: totalCount > 0 ? totalDuration / totalCount : 0,
      percentage_of_session: sessionDuration > 0 ? (totalDuration / sessionDuration) * 100 : 0
    });
  });
  
  return analysis;
}

export default router;