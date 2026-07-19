
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appJsPath = path.join(__dirname, 'server', 'app.js');
const lines = fs.readFileSync(appJsPath, 'utf8').split('\n');

// Remove duplicate import (line 27 is index 26)
lines.splice(26, 1);
fs.writeFileSync(appJsPath, lines.join('\n'));

console.log('Removed duplicate import');
