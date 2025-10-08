import mongoose from 'mongoose';

const seatDataSchema = new mongoose.Schema({
  seat_id: String,
  student_id: String,
  is_focused: Boolean,
  is_occupied: Boolean,
  attendance_time: Date,
  departure_time: Date
});

const detectionDataSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now
  },
  totalDetections: {
    type: Number,
    default: 0
  },
  focusedCount: {
    type: Number,
    default: 0
  },
  notFocusedCount: {
    type: Number,
    default: 0
  },
  sleepingCount: {
    type: Number,
    default: 0
  },
  phoneUsingCount: {
    type: Number,
    default: 0
  },
  chattingCount: {
    type: Number,
    default: 0
  },
  focusPercentage: {
    type: Number,
    default: 0
  },
  occupancy_percentage: {
    type: Number,
    default: 0
  },
  total_seats: {
    type: Number,
    default: 0
  },
  seat_data: [seatDataSchema]
});

const liveSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  kelas: {
    type: String,
    required: true
  },
  mata_kuliah: {
    type: String,
    required: true
  },
  mata_kuliah_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MataKuliah',
    required: true
  },
  dosen_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  detectionData: [detectionDataSchema],
  summary: {
    totalDuration: {
      type: Number,
      default: 0
    },
    averageFocus: {
      type: Number,
      default: 0
    },
    peakFocus: {
      type: Number,
      default: 0
    },
    lowestFocus: {
      type: Number,
      default: 100
    },
    averageOccupancy: {
      type: Number,
      default: 0
    },
    studentData: [{
      student_id: String,
      attendance_duration: Number, // in minutes
      focus_percentage: Number,
      focus_minutes: Number,
      not_focus_minutes: Number
    }]
  }
}, {
  timestamps: true
});

liveSessionSchema.pre('save', function(next) {
  if (this.detectionData && this.detectionData.length > 0) {
    const focusPercentages = this.detectionData.map(d => d.focusPercentage);
    this.summary.averageFocus = focusPercentages.reduce((a, b) => a + b, 0) / focusPercentages.length;
    this.summary.peakFocus = Math.max(...focusPercentages);
    this.summary.lowestFocus = Math.min(...focusPercentages);
    
    // Calculate average occupancy
    const totalOccupancy = this.detectionData.reduce((sum, data) => sum + (data.occupancy_percentage || 0), 0);
    this.summary.averageOccupancy = totalOccupancy / this.detectionData.length;
    
    // Calculate per-student statistics based on attendance duration
    const studentMap = new Map();
    
    // Process all detection data to gather student information
    this.detectionData.forEach(detection => {
      if (detection.seat_data && detection.seat_data.length > 0) {
        detection.seat_data.forEach(seat => {
          if (seat.student_id) {
            if (!studentMap.has(seat.student_id)) {
              studentMap.set(seat.student_id, {
                student_id: seat.student_id,
                attendance_minutes: 0,
                focus_minutes: 0,
                not_focus_minutes: 0,
                first_seen: detection.timestamp,
                last_seen: detection.timestamp
              });
            }
            
            const studentData = studentMap.get(seat.student_id);
            studentData.last_seen = detection.timestamp;
            
            // Count this minute
            studentData.attendance_minutes += 1;
            if (seat.is_focused) {
              studentData.focus_minutes += 1;
            } else {
              studentData.not_focus_minutes += 1;
            }
          }
        });
      }
    });
    
    // Convert the map to an array and calculate percentages
    this.summary.studentData = Array.from(studentMap.values()).map(student => {
      const focus_percentage = student.attendance_minutes > 0 
        ? (student.focus_minutes / student.attendance_minutes) * 100 
        : 0;
        
      return {
        student_id: student.student_id,
        attendance_duration: student.attendance_minutes,
        focus_percentage: focus_percentage,
        focus_minutes: student.focus_minutes,
        not_focus_minutes: student.not_focus_minutes
      };
    });
  }
  next();
});

export default mongoose.model('LiveSession', liveSessionSchema);