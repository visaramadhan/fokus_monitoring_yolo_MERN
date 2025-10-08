import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import kelasRoutes from './routes/kelas.js';
import mataKuliahRoutes from './routes/mataKuliah.js';
import pertemuanRoutes from './routes/pertemuan.js';
import dashboardRoutes from './routes/dashboard.js';
import settingsRoutes from './routes/settings.js';
import liveMonitoringRoutes from './routes/liveMonitoring.js';
import exportRoutes from './routes/export.js';
import sessionRecordsRoutes from './routes/sessionRecords.js';
import flaskIntegrationRoutes from './routes/flaskIntegration.js';
import jadwalRoutes from './routes/jadwal.js';
import modelsRoutes from './routes/models.js';
import profileRoutes from './routes/profile.js';
import { createDummyData } from './utils/seedData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Create uploads directory
import fs from 'fs';
const uploadsDir = path.join(__dirname, 'uploads/models');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/kelas', kelasRoutes);
app.use('/mata-kuliah', mataKuliahRoutes);
app.use('/pertemuan', pertemuanRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/settings', settingsRoutes);
app.use('/live-monitoring', liveMonitoringRoutes);
app.use('/export', exportRoutes);
app.use('/session-records', sessionRecordsRoutes);
app.use('/flask', flaskIntegrationRoutes);
app.use('/jadwal', jadwalRoutes);
app.use('/models', modelsRoutes);
app.use('/profile', profileRoutes);

// YOLO Integration endpoint
app.post('/yolo-detection', (req, res) => {
  try {
    const { detectionData, kelasId, pertemuanId, sessionId } = req.body;
    
    // Process YOLO detection data here
    console.log('YOLO Detection Data:', {
      sessionId,
      kelasId,
      pertemuanId,
      detectionData
    });
    
    // If it's a live session, forward to live monitoring
    if (sessionId) {
      // Forward to live monitoring endpoint
      // This would be handled by your YOLO model integration
    }
    
    res.json({ 
      success: true, 
      message: 'Detection data processed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI;

if (!mongoURI) {
  console.error("❌ MONGODB_URI is not defined in .env file");
  process.exit(1);
}

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    await createDummyData();
    console.log('✅ Dummy data created/verified');
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
  });

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Flask integration available at: http://localhost:${PORT}/api/flask`);
  console.log(`Models directory: ${uploadsDir}`);
});