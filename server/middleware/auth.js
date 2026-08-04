import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import fs from 'fs';
import path from 'path';

const DEBUG_ENV_PATH = path.join(process.cwd(), '.dbg', 'data-fetch-failed.env');

async function reportDebugEvent(payload = {}) {
  let debugUrl = 'http://127.0.0.1:7777/event';
  let debugSessionId = 'data-fetch-failed';
  try {
    const envContent = fs.readFileSync(DEBUG_ENV_PATH, 'utf8');
    debugUrl = envContent.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || debugUrl;
    debugSessionId = envContent.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || debugSessionId;
  } catch {}

  try {
    await fetch(debugUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: debugSessionId,
        runId: 'pre-fix',
        ts: Date.now(),
        ...payload,
      }),
    });
  } catch {}
}

export const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      // #region debug-point B:missing-token
      await reportDebugEvent({
        hypothesisId: 'B',
        location: 'server/middleware/auth.js:missing-token',
        msg: '[DEBUG] auth rejected request because token is missing',
        data: {
          method: req.method,
          path: req.originalUrl || req.url,
        },
      });
      // #endregion
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const secret = process.env.JWT_SECRET || 'development_fallback_secret';
    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      // #region debug-point B:user-not-found
      await reportDebugEvent({
        hypothesisId: 'B',
        location: 'server/middleware/auth.js:user-not-found',
        msg: '[DEBUG] auth rejected request because user was not found',
        data: {
          method: req.method,
          path: req.originalUrl || req.url,
          userId: decoded?.userId || null,
        },
      });
      // #endregion
      return res.status(401).json({ message: 'Token is not valid' });
    }

    req.user = user;
    next();
  } catch (error) {
    // #region debug-point B:token-verify-failed
    await reportDebugEvent({
      hypothesisId: 'B',
      location: 'server/middleware/auth.js:token-verify-failed',
      msg: '[DEBUG] auth rejected request because token verification failed',
      data: {
        method: req.method,
        path: req.originalUrl || req.url,
        message: error?.message || String(error),
      },
    });
    // #endregion
    res.status(401).json({ message: 'Token is not valid' });
  }
};

export const adminAuth = async (req, res, next) => {
  auth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  });
};
