import mongoose from 'mongoose';
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
  // #region debug-point login-500-api-handler
  console.error('[debug:login-500] api.handler.entry', {
    method: req.method,
    routeParam: req.query?.route || null,
    originalUrl: req.url || null,
    dbReadyStateBeforeInit: mongoose.connection.readyState,
  });
  try {
    await initDatabase();
    console.error('[debug:login-500] api.handler.dbInit.ok', {
      dbReadyStateAfterInit: mongoose.connection.readyState,
      dbName: mongoose.connection?.name || null,
    });
  } catch (error) {
    console.error('[debug:login-500] api.handler.dbInit.error', {
      message: error?.message || String(error),
      stack: error?.stack || null,
      dbReadyStateAfterInit: mongoose.connection.readyState,
    });
  }

  req.url = toUrl(req);
  console.error('[debug:login-500] api.handler.forward', {
    forwardedUrl: req.url,
    dbReadyStateBeforeApp: mongoose.connection.readyState,
  });
  return app(req, res);
  // #endregion debug-point login-500-api-handler
}
