
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appJsPath = path.join(__dirname, 'server', 'app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

// Step 1: Add import for aiServiceProxyRoutes
content = content.replace(
  'import profileRoutes from \'./routes/profile.js\';\nimport { createDummyData, purgeAllData, purgeDummyData } from \'./utils/seedData.js\';',
  'import profileRoutes from \'./routes/profile.js\';\nimport aiServiceProxyRoutes from \'./routes/aiServiceProxy.js\';\nimport { createDummyData, purgeAllData, purgeDummyData } from \'./utils/seedData.js\';'
);

// Step 2: Update the middleware
content = content.replace(
  'if (reqPath === \'/health\' || reqPath === \'/db/status\') return next();',
  'if (reqPath === \'/health\' || reqPath === \'/db/status\' || reqPath === \'/ai-service/health\') return next();'
);

// Step 3: Add the route
content = content.replace(
  'app.use(\'/profile\', profileRoutes);',
  'app.use(\'/profile\', profileRoutes);\napp.use(\'/ai-service\', aiServiceProxyRoutes);'
);

fs.writeFileSync(appJsPath, content, 'utf8');
console.log('✅ Successfully modified app.js!');
