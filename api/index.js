import { app, initDatabase } from '../server/app.js';

function toUrl(req) {
  const rawRoute = req.query?.route;
  const route = Array.isArray(rawRoute) ? rawRoute.join('/') : String(rawRoute || '');
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === 'route') continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item));
    } else if (value !== undefined) {
      params.append(key, String(value));
    }
  }

  const qs = params.toString();
  return `/${route}${qs ? `?${qs}` : ''}`;
}

export default async function handler(req, res) {
  try {
    await initDatabase();
  } catch (error) {
    console.error('Vercel API database init error:', error?.message || String(error));
  }

  req.url = toUrl(req);
  return app(req, res);
}
