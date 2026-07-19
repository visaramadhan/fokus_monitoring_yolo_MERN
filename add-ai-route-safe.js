
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appJsPath = path.join(__dirname, 'server', 'app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

// Check if already present
const hasImport = content.includes('aiServiceProxyRoutes');
if (hasImport) {
  console.log('AI service route already added');
  process.exit(0);
}

// Add import
content = content.replace(
  "import profileRoutes from './routes/profile.js';",
  "import profileRoutes from './routes/profile.js';\nimport aiServiceProxyRoutes from './routes/aiServiceProxy.js';",
);

// Add route
content = content.replace(
  "app.use('/profile', profileRoutes);",
  "app.use('/profile', profileRoutes);\napp.use('/ai-service', aiServiceProxyRoutes);",
);

fs.writeFileSync(appJsPath, content);
console.log('AI service route added');
