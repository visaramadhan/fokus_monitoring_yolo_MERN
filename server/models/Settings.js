import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  // General Settings
  autoDetection: {
    type: Boolean,
    default: true
  },
  recordingSessions: {
    type: Boolean,
    default: true
  },
  notifications: {
    type: Boolean,
    default: true
  },
  dataRetentionDays: {
    type: Number,
    default: 30,
    min: 1,
    max: 365
  },
  
  // Camera & Detection Settings
  cameraResolution: {
    type: String,
    enum: ['1920x1080', '1280x720', '640x480'],
    default: '1920x1080'
  },
  frameRate: {
    type: Number,
    default: 30,
    min: 15,
    max: 60
  },
  detectionThreshold: {
    type: Number,
    default: 0.5,
    min: 0.1,
    max: 1.0
  },
  
  // Database Configuration
  mongodbUri: {
    type: String,
    default: 'mongodb+srv://sastyutari8:E5WV3BDAyqb22Pi7@fokus.yhhk5wc.mongodb.net/'
  },
  backupInterval: {
    type: Number,
    default: 24,
    min: 1,
    max: 168
  },
  
  // YOLO Model Configuration
  modelPath: {
    type: String,
    default: ''
  },
  modelType: {
    type: String,
    enum: ['pytorch', 'onnx', 'tensorflow'],
    default: 'pytorch'
  },
  confidenceThreshold: {
    type: Number,
    default: 0.5,
    min: 0.1,
    max: 1.0
  },
  iouThreshold: {
    type: Number,
    default: 0.4,
    min: 0.1,
    max: 1.0
  },
  modelStatus: {
    type: String,
    enum: ['active', 'inactive', 'error'],
    default: 'inactive'
  },
  
  // Live Monitoring Settings
  liveMonitoring: {
    type: Boolean,
    default: false
  },
  selectedCamera: {
    type: String,
    default: 'default'
  }
}, {
  timestamps: true
});

export default mongoose.model('Settings', settingsSchema);