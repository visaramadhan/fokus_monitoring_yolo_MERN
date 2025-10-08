import mongoose from 'mongoose';

const gestureHistorySchema = new mongoose.Schema({
  gesture: {
    type: String,
    enum: ['focused', 'looking_away', 'sleeping', 'using_phone', 'chatting', 'writing', 'listening'],
    required: true
  },
  count: {
    type: Number,
    default: 0
  },
  duration: {
    type: Number,
    default: 0
  }
});

const seatDataSchema = new mongoose.Schema({
  seat_id: {
    type: Number,
    required: true
  },
  student_id: {
    type: String,
    required: true
  },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true }
  },
  focus_duration: {
    type: Number,
    default: 0
  },
  focus_percentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  gesture_history: [gestureHistorySchema],
  final_status: {
    type: String,
    enum: ['Focused', 'Not Focused', 'Absent'],
    default: 'Not Focused'
  }
});

const detectionSummarySchema = new mongoose.Schema({
  total_detections: {
    type: Number,
    default: 0
  },
  average_focus_percentage: {
    type: Number,
    default: 0
  },
  peak_focus_time: {
    type: Number,
    default: 0
  },
  total_session_duration: {
    type: Number,
    default: 0
  }
});

const gestureAnalysisSchema = new mongoose.Schema({
  gesture_type: {
    type: String,
    required: true
  },
  total_count: {
    type: Number,
    default: 0
  },
  average_duration: {
    type: Number,
    default: 0
  },
  percentage_of_session: {
    type: Number,
    default: 0
  }
});

const sessionRecordSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  sessionName: {
    type: String,
    required: true
  },
  kelas: {
    type: String,
    required: true
  },
  mata_kuliah: {
    type: String,
    required: true
  },
  dosen_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tanggal: {
    type: Date,
    required: true,
    default: Date.now
  },
  jam_mulai: {
    type: Date,
    required: true
  },
  jam_selesai: {
    type: Date,
    required: true
  },
  durasi: {
    type: Number,
    required: true
  },
  seat_data: [seatDataSchema],
  detection_summary: detectionSummarySchema,
  gesture_analysis: [gestureAnalysisSchema],
  model_used: {
    type: String,
    default: ''
  },
  camera_settings: {
    device_id: String,
    resolution: String,
    frame_rate: Number
  }
}, {
  timestamps: true
});

// Pre-save middleware to calculate summary statistics
sessionRecordSchema.pre('save', function(next) {
  if (this.seat_data.length > 0) {
    const totalFocusDuration = this.seat_data.reduce((sum, seat) => sum + seat.focus_duration, 0);
    const averageFocusDuration = totalFocusDuration / this.seat_data.length;
    
    this.detection_summary.average_focus_percentage = this.seat_data.reduce((sum, seat) => sum + seat.focus_percentage, 0) / this.seat_data.length;
    this.detection_summary.peak_focus_time = Math.max(...this.seat_data.map(seat => seat.focus_duration));
  }
  next();
});

export default mongoose.model('SessionRecord', sessionRecordSchema);