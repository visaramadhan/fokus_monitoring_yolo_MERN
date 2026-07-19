
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appJsPath = path.join(__dirname, 'server', 'app.js');
let appJsContent = fs.readFileSync(appJsPath, 'utf8');

// Add the import
const importLine = "import profileRoutes from './routes/profile.js';";
const newImport = "import profileRoutes from './routes/profile.js';\nimport aiServiceProxyRoutes from './routes/aiServiceProxy.js';";
appJsContent = appJsContent.replace(importLine, newImport);

// Add the route
const routeLine = "app.use('/profile', profileRoutes);";
const newRoute = "app.use('/profile', profileRoutes);\napp.use('/ai-service', aiServiceProxyRoutes);";
appJsContent = appJsContent.replace(routeLine, newRoute);

// Write back
fs.writeFileSync(appJsPath, appJsContent);

console.log('Added AI service proxy route to app.js');
