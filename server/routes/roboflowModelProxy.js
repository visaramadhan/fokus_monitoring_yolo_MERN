import express from 'express';
import axios from 'axios';
import { auth } from '../middleware/auth.js';

const router = express.Router();

function getFastApiConfig() {
  const fastApiUrl = String(process.env.FASTAPI_URL || 'http://127.0.0.1:8000').trim().replace(/\/+$/, '');
  const timeoutMs = Math.max(5000, Number(process.env.FASTAPI_TIMEOUT_MS || 20000) || 20000);
  const retries = Math.max(0, Number(process.env.FASTAPI_MAX_RETRIES || 1) || 1);

  return { fastApiUrl, timeoutMs, retries };
}

function parseCsvEnv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function requestWithRetry(fn, retries) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status = error?.response?.status;
      const retryable = status === 408 || status === 429 || (typeof status === 'number' && status >= 500);
      if (attempt >= retries || !retryable) break;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

router.get('/model-info', auth, async (_req, res) => {
  const focus = parseCsvEnv(process.env.FOCUS_CLASSES || 'fokus,focused,memperhatikan');
  const nonFocus = parseCsvEnv(process.env.NONFOCUS_CLASSES || 'tidak_fokus,not_focused');
  const labels = Array.from(new Set([...focus, ...nonFocus].map((s) => String(s).trim()).filter(Boolean)));
  const names = Object.fromEntries(labels.map((label, index) => [String(index), label]));
  res.json({
    success: true,
    provider: 'fastapi-roboflow-proxy',
    names,
    num_classes: labels.length,
    focus_classes: focus,
    nonfocus_classes: nonFocus,
  });
});

router.get('/status', auth, async (_req, res) => {
  const { fastApiUrl, timeoutMs, retries } = getFastApiConfig();
  try {
    const response = await requestWithRetry(
      () => axios.get(`${fastApiUrl}/health`, { timeout: timeoutMs }),
      retries
    );
    res.json({
      ok: Boolean(response.data?.ok),
      provider: 'fastapi-roboflow-proxy',
      fastapi_url: fastApiUrl,
    });
  } catch (error) {
    const status = error?.response?.status || 502;
    res.status(status).json({
      ok: false,
      provider: 'fastapi-roboflow-proxy',
      fastapi_url: fastApiUrl,
      message: error?.response?.data?.detail || error?.message || 'FastAPI proxy tidak bisa diakses.',
    });
  }
});

router.post('/detect-frame', auth, async (req, res) => {
  const { fastApiUrl, timeoutMs, retries } = getFastApiConfig();
  const imageBase64 = String(req.body?.image_base64 || '').trim();
  const conf = req.body?.conf;

  if (!imageBase64) {
    return res.status(400).json({
      success: false,
      message: 'image_base64 is required',
    });
  }

  try {
    const response = await requestWithRetry(
      () =>
        axios.post(
          `${fastApiUrl}/detect`,
          {
            image_base64: imageBase64,
            conf,
          },
          { timeout: timeoutMs }
        ),
      retries
    );

    const data = response.data || {};
    res.json({
      success: Boolean(data.success),
      provider: data.provider || 'roboflow-model-api',
      detections: Array.isArray(data.detections) ? data.detections : [],
      model_id: data.model_id || null,
      raw_prediction_count: data.raw_prediction_count || 0,
      filtered_prediction_count: data.filtered_prediction_count || 0,
    });
  } catch (error) {
    const status = error?.response?.status || 500;
    const message =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      'Gagal memproses frame ke FastAPI.';

    res.status(status).json({
      success: false,
      message,
      details: error?.response?.data || null,
    });
  }
});

export default router;
