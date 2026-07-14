import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function main() {
  const apiUrl = String(process.env.ROBOFLOW_API_URL || 'https://serverless.roboflow.com').trim().replace(/\/+$/, '');
  const apiKey = String(process.env.ROBOFLOW_API_KEY || '').trim();
  const modelId = String(process.env.ROBOFLOW_MODEL_ID || '').trim();

  assert.ok(apiKey, 'ROBOFLOW_API_KEY wajib diisi di server/.env');
  assert.ok(modelId, 'ROBOFLOW_MODEL_ID wajib diisi di server/.env (format: project/version)');

  const sampleImagePath = path.join(process.cwd(), '..', 'node_modules', 'jpeg-exif', 'test', 'IMG_0001.JPG');
  const image = fs.readFileSync(sampleImagePath, { encoding: 'base64' });
  assert.ok(image.length > 0, 'Gagal membaca sample image');

  const response = await axios({
    method: 'POST',
    url: `${apiUrl}/${modelId}`,
    params: {
      api_key: apiKey,
      confidence: 0.4,
    },
    data: image,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 30000,
    validateStatus: () => true,
  });

  if (response.status >= 400) {
    throw new Error(
      `Roboflow Model API error ${response.status}: ${response.data?.message || response.data?.error || JSON.stringify(response.data).slice(0, 300)}`
    );
  }

  const predictions = Array.isArray(response.data?.predictions) ? response.data.predictions : [];
  console.log(
    JSON.stringify(
      {
        ok: true,
        model_id: modelId,
        prediction_count: predictions.length,
        keys: Object.keys(response.data || {}),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message: error?.message || String(error),
      },
      null,
      2
    )
  );
  process.exit(1);
});

