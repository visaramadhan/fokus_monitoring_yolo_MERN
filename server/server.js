import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import checkDiskSpace from 'check-disk-space';
import multer from 'multer';
import * as path from 'path';
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

// DB status endpoint for monitoring readiness
app.get('/db/status', (req, res) => {
  const state = mongoose.connection.readyState; // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
  const map = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({ readyState: state, stateText: map[state] });
});

// Connect to MongoDB with fallback to in-memory for development
async function initDatabase() {
  const envUri = process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI;
  const localUri = 'mongodb://127.0.0.1:27017/focus_monitoring';
  const targetUri = envUri || localUri;

  const maxRetries = 5;
  const baseDelayMs = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await mongoose.connect(targetUri, {
        serverSelectionTimeoutMS: 8000,
      });
      console.log(`✅ Connected to MongoDB (${targetUri.includes('mongodb.net') ? 'Atlas' : 'local'})`);
      await createDummyData();
      console.log('✅ Dummy data created/verified');
      return;
    } catch (error) {
      const msg = (error && error.message) ? error.message : String(error);
      const isDnsError = /ENOTFOUND|EAI_AGAIN|getaddrinfo|Name resolution/i.test(msg);
      const isAuthError = /auth/i.test(msg);
      const isConnRefused = /ECONNREFUSED/i.test(msg);

      console.error(`❌ MongoDB connection error (attempt ${attempt}/${maxRetries}): ${msg}`);
      if (isDnsError) {
        console.error('⚠️ DNS to Atlas failed. Check internet/DNS or use local MongoDB.');
      } else if (isAuthError) {
        console.error('⚠️ Authentication failed. Verify MONGODB_URI credentials and IP whitelist.');
      } else if (isConnRefused) {
        console.error('⚠️ Connection refused. If using local MongoDB, ensure mongod is running.');
      }

      if (attempt < maxRetries) {
        const delay = baseDelayMs * attempt;
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        console.error('⚠️ All attempts failed. Please set MONGODB_URI to a reachable database or start local MongoDB.');
      }
    }
  }

  // Optional guarded in-memory fallback
  if (String(process.env.ENABLE_IN_MEMORY).toLowerCase() === 'true') {
    const requiredBytes = Number(process.env.MONGOMS_REQUIRED_FREE_BYTES || 800_000_000); // ~800MB
    const driveRoot = path.parse(process.cwd()).root || 'C:\\';
    try {
      const { free } = await checkDiskSpace(driveRoot);
      if (free < requiredBytes) {
        console.warn('⚠️ In-memory MongoDB disabled: insufficient free space.');
        console.warn(`Free: ${Math.round(free/1e6)}MB < Required: ${Math.round(requiredBytes/1e6)}MB`);
        return;
      }
      console.log('⏳ Starting in-memory MongoDB (version 6.0.6)...');
      const mongod = await MongoMemoryServer.create({
        binary: { version: '6.0.6' }
      });
      const memUri = mongod.getUri();
      await mongoose.connect(memUri, { serverSelectionTimeoutMS: 8000 });
      console.log('✅ Connected to in-memory MongoDB');
      await createDummyData();
      console.log('✅ Dummy data created/verified (in-memory)');
    } catch (err) {
      console.error('❌ In-memory MongoDB startup failed:', err?.message || String(err));
      console.error('⚠️ Please free up disk space or use a reachable MONGODB_URI.');
    }
  } else {
    console.warn('ℹ️ In-memory fallback disabled. Set ENABLE_IN_MEMORY=true to enable.');
  }
}

initDatabase();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Flask integration available at: http://localhost:${PORT}/flask`);
  console.log(`Models directory: ${uploadsDir}`);
});