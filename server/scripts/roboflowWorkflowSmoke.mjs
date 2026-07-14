import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import {
  ensureConfigured,
  extractWorkflowOutputKeys,
  runRoboflowWorkflow,
  stripImageDataUrl,
} from '../utils/roboflowWorkflow.js';

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function main() {
  const config = ensureConfigured();
  const sampleImagePath = path.join(process.cwd(), '..', 'node_modules', 'jpeg-exif', 'test', 'IMG_0001.JPG');
  const imageBase64 = stripImageDataUrl(fs.readFileSync(sampleImagePath).toString('base64'));

  assert.ok(imageBase64, 'Sample image base64 wajib terisi.');

  try {
    const result = await runRoboflowWorkflow({
      config,
      imageBase64,
      maxRetries: 0,
    });
    const outputKeys = extractWorkflowOutputKeys(result);
    assert.ok(Array.isArray(result), 'Workflow response sukses harus berbentuk list.');
    assert.ok(outputKeys.length > 0, 'Workflow response sukses harus punya output keys.');
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: 'success',
          workflow: `${config.workspaceName}/${config.workflowId}`,
          outputKeys,
        },
        null,
        2
      )
    );
  } catch (error) {
    const details = error?.details || null;
    assert.ok(details && typeof details === 'object', 'Workflow error harus mengandung details object.');
    assert.ok(details.message, 'Workflow error harus punya message.');
    assert.ok(details.error_type, 'Workflow error harus punya error_type.');
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: 'structured_error',
          workflow: `${config.workspaceName}/${config.workflowId}`,
          error_type: details.error_type,
          message: details.message,
          context: details.context || null,
          blocks_errors_count: Array.isArray(details.blocks_errors) ? details.blocks_errors.length : 0,
        },
        null,
        2
      )
    );
  }
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
