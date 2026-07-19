import http from 'http';
import https from 'https';
import fs from 'fs';
import mongoose from 'mongoose';
import { app, initDatabase, uploadsDir } from './app.js';

const PORT = process.env.PORT || 5000;

const sslKeyPath = process.env.SSL_KEY_PATH;
const sslCertPath = process.env.SSL_CERT_PATH;
const httpsEnabled = String(process.env.HTTPS_ENABLED || '').toLowerCase() === 'true' || (sslKeyPath && sslCertPath);

async function startServer() {
  try {
    await initDatabase();

    if (mongoose.connection.readyState !== 1) {
      throw new Error('Database is not ready after initDatabase()');
    }

    if (httpsEnabled) {
      const key = sslKeyPath ? fs.readFileSync(sslKeyPath) : null;
      const cert = sslCertPath ? fs.readFileSync(sslCertPath) : null;
      const server = https.createServer({ key, cert }, app);
      server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Health check: https://localhost:${PORT}/health`);
        console.log(`Roboflow Hosted API available at: https://localhost:${PORT}/roboflow`);
        console.log(`Models directory: ${uploadsDir}`);
      });
      return;
    }

    const server = http.createServer(app);
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Roboflow Hosted API available at: http://localhost:${PORT}/roboflow`);
      console.log(`Models directory: ${uploadsDir}`);
    });
  } catch (error) {
    console.error('Database init error:', error?.message || String(error));
    process.exit(1);
  }
}

startServer();
