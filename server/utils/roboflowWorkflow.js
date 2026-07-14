import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { InferenceHTTPClient } from '@roboflow/inference-sdk';

const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_DELAY_MS = 600;
const OUTPUTS_DIR = path.join(process.cwd(), 'uploads', 'roboflow');

function parseCsvEnv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonEnv(value, fallback = {}) {
  const raw = String(value || '').trim();
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getRoboflowConfig() {
  const apiUrl = String(process.env.ROBOFLOW_API_URL || 'https://serverless.roboflow.com')
    .trim()
    .replace(/\/+$/, '');
  const apiKey = String(process.env.ROBOFLOW_API_KEY || '').trim();
  const workspaceName = String(process.env.ROBOFLOW_WORKSPACE_NAME || 'visa-ramadhan').trim();
  const workflowId = String(process.env.ROBOFLOW_WORKFLOW_ID || 'fokusdetection-vfocus-rdwkd-logic').trim();
  const imageInput = String(process.env.ROBOFLOW_IMAGE_INPUT || 'image').trim() || 'image';
  const legacyWorkflowUrl = String(process.env.ROBOFLOW_WORKFLOW_URL || '').trim();
  const hasExplicitWorkflow = Boolean(workspaceName && workflowId);
  const workflowUrl = hasExplicitWorkflow
    ? `${apiUrl}/infer/workflows/${workspaceName}/${workflowId}`
    : legacyWorkflowUrl;
  const timeoutMs = Math.max(
    5000,
    Number(process.env.ROBOFLOW_TIMEOUT_MS || DEFAULT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS
  );
  const configuredLabels = parseCsvEnv(process.env.ROBOFLOW_CLASS_NAMES || '');
  const streamOutput = parseCsvEnv(process.env.ROBOFLOW_STREAM_OUTPUT || 'output_image');
  const dataOutput = parseCsvEnv(process.env.ROBOFLOW_DATA_OUTPUT || 'focus_monitoring_json,frame_time,people');
  const requestedPlan = String(process.env.ROBOFLOW_REQUESTED_PLAN || 'webrtc-gpu-medium').trim() || 'webrtc-gpu-medium';
  const requestedRegion = String(process.env.ROBOFLOW_REQUESTED_REGION || 'us').trim() || 'us';
  const processingTimeoutSeconds = Math.max(
    30,
    Number(process.env.ROBOFLOW_PROCESSING_TIMEOUT_SEC || 3600) || 3600
  );
  const workflowParameters = parseJsonEnv(
    process.env.ROBOFLOW_WORKFLOW_PARAMETERS_JSON || process.env.ROBOFLOW_WORKFLOW_PARAMETERS,
    {}
  );
  const maxRetries = Math.max(
    0,
    Number(process.env.ROBOFLOW_MAX_RETRIES || DEFAULT_MAX_RETRIES) || DEFAULT_MAX_RETRIES
  );

  return {
    apiUrl,
    apiKey,
    workspaceName,
    workflowId,
    imageInput,
    workflowUrl,
    legacyWorkflowUrl,
    hasExplicitWorkflow,
    timeoutMs,
    configuredLabels,
    streamOutput,
    dataOutput,
    requestedPlan,
    requestedRegion,
    processingTimeoutSeconds,
    workflowParameters,
    maxRetries,
  };
}

export function ensureConfigured() {
  const config = getRoboflowConfig();
  if (!config.apiKey) {
    const error = new Error('ROBOFLOW_API_KEY belum diatur di environment server.');
    error.statusCode = 500;
    throw error;
  }
  if (!config.workflowUrl) {
    const error = new Error('ROBOFLOW workflow URL tidak valid.');
    error.statusCode = 500;
    throw error;
  }
  return config;
}

export function stripImageDataUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const commaIndex = raw.indexOf(',');
  if (raw.startsWith('data:') && commaIndex >= 0) {
    return raw.slice(commaIndex + 1);
  }
  return raw;
}

export function toNumber(value, fallback = 0) {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function looksLikePrediction(entry) {
  if (!entry || typeof entry !== 'object') return false;
  return (
    'class' in entry ||
    'class_name' in entry ||
    'label' in entry ||
    'name' in entry ||
    'bbox' in entry ||
    ('x' in entry && 'y' in entry)
  );
}

export function normalizePrediction(prediction) {
  if (!looksLikePrediction(prediction)) return null;

  const className = String(
    prediction.class ??
      prediction.class_name ??
      prediction.name ??
      prediction.label ??
      ''
  ).trim();
  if (!className) return null;

  const confidence = toNumber(prediction.confidence, 0);
  const directX = prediction.x;
  const directY = prediction.y;
  const directW = prediction.width ?? prediction.w;
  const directH = prediction.height ?? prediction.h;
  const bbox = prediction.bbox && typeof prediction.bbox === 'object' ? prediction.bbox : null;
  const x1 = bbox ? toNumber(bbox.x1, 0) : toNumber(prediction.x1, 0);
  const y1 = bbox ? toNumber(bbox.y1, 0) : toNumber(prediction.y1, 0);
  const x2 = bbox ? toNumber(bbox.x2, 0) : toNumber(prediction.x2, 0);
  const y2 = bbox ? toNumber(bbox.y2, 0) : toNumber(prediction.y2, 0);

  let x = toNumber(directX, Number.NaN);
  let y = toNumber(directY, Number.NaN);
  let width = toNumber(directW, Number.NaN);
  let height = toNumber(directH, Number.NaN);

  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
    if (Number.isFinite(x1) && Number.isFinite(y1) && Number.isFinite(x2) && Number.isFinite(y2)) {
      width = Math.max(0, x2 - x1);
      height = Math.max(0, y2 - y1);
      x = x1 + width / 2;
      y = y1 + height / 2;
    } else {
      x = 0;
      y = 0;
      width = 0;
      height = 0;
    }
  }

  return {
    class: className,
    class_name: className,
    confidence,
    x,
    y,
    width,
    height,
    bbox: {
      x1: Number.isFinite(x1) && Number.isFinite(x2) ? x1 : x - width / 2,
      y1: Number.isFinite(y1) && Number.isFinite(y2) ? y1 : y - height / 2,
      x2: Number.isFinite(x1) && Number.isFinite(x2) ? x2 : x + width / 2,
      y2: Number.isFinite(y1) && Number.isFinite(y2) ? y2 : y + height / 2,
    },
  };
}

export function extractWorkflowEntry(result) {
  if (Array.isArray(result) && result[0] && typeof result[0] === 'object') {
    return result[0];
  }

  const outputs = result?.outputs;
  if (Array.isArray(outputs) && outputs[0] && typeof outputs[0] === 'object') {
    return outputs[0];
  }

  return result && typeof result === 'object' ? result : {};
}

export function extractWorkflowOutputKeys(result) {
  const entry = extractWorkflowEntry(result);
  return Object.keys(entry || {});
}

export function findPredictionArray(root) {
  const queue = [root];
  const visited = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;
    if (visited.has(current)) continue;
    visited.add(current);

    if (Array.isArray(current)) {
      if (current.length > 0 && current.every((item) => looksLikePrediction(item))) {
        return current;
      }
      for (const item of current) {
        if (item && typeof item === 'object') queue.push(item);
      }
      continue;
    }

    for (const value of Object.values(current)) {
      if (!value || typeof value !== 'object') continue;
      queue.push(value);
    }
  }

  return [];
}

function isLikelyImagePayload(key, value) {
  if (!value) return false;

  if (typeof value === 'object' && typeof value.value === 'string') {
    const typeValue = String(value.type || '').toLowerCase();
    if (typeValue.includes('image')) return true;
    return /image|annotated|render|output/i.test(String(key || ''));
  }

  if (typeof value === 'string') {
    return /image|annotated|render|output/i.test(String(key || '')) && value.length > 256;
  }

  return false;
}

export function findImageOutput(root) {
  const queue = [{ key: '', value: root }];
  const visited = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    const value = current?.value;
    if (!value || typeof value !== 'object') continue;
    if (visited.has(value)) continue;
    visited.add(value);

    for (const [key, childValue] of Object.entries(value)) {
      if (isLikelyImagePayload(key, childValue)) {
        if (typeof childValue === 'object' && typeof childValue.value === 'string') {
          return { key, value: childValue.value };
        }
        if (typeof childValue === 'string') {
          return { key, value: childValue };
        }
      }

      if (childValue && typeof childValue === 'object') {
        queue.push({ key, value: childValue });
      }
    }
  }

  return null;
}

function getImageFileExtension(base64Value) {
  const prefix = String(base64Value || '').slice(0, 32);
  if (prefix.startsWith('/9j/')) return 'jpg';
  if (prefix.startsWith('iVBOR')) return 'png';
  if (prefix.startsWith('UklGR')) return 'webp';
  return 'jpg';
}

export async function persistWorkflowImageOutput(base64Value) {
  const normalized = stripImageDataUrl(base64Value);
  if (!normalized) return null;

  await fs.mkdir(OUTPUTS_DIR, { recursive: true });
  const extension = getImageFileExtension(normalized);
  const fileName = `roboflow-output-${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`;
  const filePath = path.join(OUTPUTS_DIR, fileName);
  await fs.writeFile(filePath, Buffer.from(normalized, 'base64'));

  return {
    fileName,
    filePath,
    publicPath: `/uploads/roboflow/${fileName}`,
  };
}

export function createInferenceClient(config) {
  return InferenceHTTPClient.init({
    apiKey: config.apiKey,
    serverUrl: config.apiUrl,
  });
}

export class RoboflowRequestError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'RoboflowRequestError';
    this.statusCode = options.statusCode || 500;
    this.details = options.details || null;
    this.attempts = options.attempts || 1;
  }
}

function shouldRetryWorkflowRequest(error) {
  const status = error?.response?.status || error?.statusCode || 0;
  return status === 408 || status === 429 || status >= 500;
}

export async function runRoboflowWorkflow({
  config,
  imageBase64,
  parameters,
  timeoutMs,
  maxRetries,
}) {
  const effectiveTimeoutMs = timeoutMs || config.timeoutMs;
  const effectiveRetries = Number.isFinite(Number(maxRetries)) ? Number(maxRetries) : config.maxRetries;
  const mergedParameters =
    parameters && typeof parameters === 'object'
      ? { ...config.workflowParameters, ...parameters }
      : { ...config.workflowParameters };

  let lastError = null;

  for (let attempt = 0; attempt <= effectiveRetries; attempt += 1) {
    try {
      const response = await axios.post(
        config.workflowUrl,
        {
          api_key: config.apiKey,
          inputs: {
            [config.imageInput]: {
              type: 'base64',
              value: imageBase64,
            },
          },
          ...(Object.keys(mergedParameters).length > 0 ? { parameters: mergedParameters } : {}),
        },
        {
          timeout: effectiveTimeoutMs,
        }
      );

      return response.data;
    } catch (error) {
      lastError = error;
      if (attempt >= effectiveRetries || !shouldRetryWorkflowRequest(error)) {
        break;
      }
      await sleep(DEFAULT_RETRY_BASE_DELAY_MS * (attempt + 1));
    }
  }

  const status = lastError?.response?.status || lastError?.statusCode || 500;
  const message =
    lastError?.response?.data?.message ||
    lastError?.response?.data?.error ||
    lastError?.message ||
    'Gagal memproses request ke Roboflow Workflow.';

  throw new RoboflowRequestError(message, {
    statusCode: status,
    attempts: effectiveRetries + 1,
    details: lastError?.response?.data || null,
  });
}
