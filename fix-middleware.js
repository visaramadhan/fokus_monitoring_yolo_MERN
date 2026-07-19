import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appJsPath = path.join(__dirname, "server", "app.js");
let content = fs.readFileSync(appJsPath, "utf8");

// Fix middleware to allow /ai-service/health
content = content.replace(
  "if (reqPath === '/health' || reqPath === '/db/status') return next();",
  "if (reqPath === '/health' || reqPath === '/db/status' || reqPath === '/ai-service/health') return next();"
);

fs.writeFileSync(appJsPath, content);
console.log("Middleware updated to allow /ai-service/health");
