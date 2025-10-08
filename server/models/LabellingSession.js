import mongoose from 'mongoose';

const labelingSessionSchema = new mongoose.Schema({
  session_name: {
    type: String,
    required: true
  },
  class_name: {
    type: String,
    required: true
  },
  total_seats: {
    type: Number,
    required: true,
    default: 30
  },
  seat_positions: [{
    seat_id: { type: Number, required: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    is_occupied: { type: Boolean, default: false },
    student_id: { type: String, default: null }
  }],
  camera_settings: {
    device_id: { type: String, required: true },
    resolution: { type: String, default: '1920x1080' },
    frame_rate: { type: Number, default: 30 }
  },
  model_settings: {
    confidence_threshold: { type: Number, default: 0.5 },
    iou_threshold: { type: Number, default: 0.4 },
    model_path: { type: String, default: '' }
  },
  is_active: {
    type: Boolean,
    default: false
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

export default mongoose.model('LabelingSession', labelingSessionSchema);