import http from 'http';
import https from 'https';
import fs from 'fs';
import { app, initDatabase, uploadsDir } from './app.js';

const PORT = process.env.PORT || 5000;

initDatabase().catch((error) => {
  console.error('Database init error:', error?.message || String(error));
});

const sslKeyPath = process.env.SSL_KEY_PATH;
const sslCertPath = process.env.SSL_CERT_PATH;
const httpsEnabled = String(process.env.HTTPS_ENABLED || '').toLowerCase() === 'true' || (sslKeyPath && sslCertPath);

if (httpsEnabled) {
  const key = sslKeyPath ? fs.readFileSync(sslKeyPath) : null;
  const cert = sslCertPath ? fs.readFileSync(sslCertPath) : null;
  const server = https.createServer({ key, cert }, app);
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: https://localhost:${PORT}/health`);
    console.log(`Flask integration available at: https://localhost:${PORT}/flask`);
    console.log(`Models directory: ${uploadsDir}`);
  });
} else {
  const server = http.createServer(app);
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Flask integration available at: http://localhost:${PORT}/flask`);
    console.log(`Models directory: ${uploadsDir}`);
  });
}
