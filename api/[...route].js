import { app, initDatabase } from '../server/app.js';

export default async function handler(req, res) {
  try {
    await initDatabase();
  } catch (error) {
    console.error('Vercel API database init error:', error?.message || String(error));
  }

  const originalUrl = req.url || '/';
  req.url = originalUrl.replace(/^\/api(?=\/|$)/, '') || '/';
  return app(req, res);
}
