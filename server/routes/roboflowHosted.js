import express from 'express';
import { auth } from '../middleware/auth.js';
import { WorkflowError } from '@roboflow/inference-sdk';
import {
  createInferenceClient,
  ensureConfigured,
  extractWorkflowEntry,
  extractWorkflowOutputKeys,
  findImageOutput,
  findPredictionArray,
  getRoboflowConfig,
  normalizePrediction,
  persistWorkflowImageOutput,
  runRoboflowWorkflow,
  stripImageDataUrl,
  toNumber,
} from '../utils/roboflowWorkflow.js';

const router = express.Router();

router.get('/status', auth, async (_req, res) => {
  try {
    const config = ensureConfigured();
    res.json({
      status: 'connected',
      provider: 'roboflow-hosted',
      api_url: config.apiUrl,
      workflow_url: config.workflowUrl,
      legacy_workflow_url: config.legacyWorkflowUrl || null,
      workflow_source: config.hasExplicitWorkflow ? 'workspace_and_workflow_id' : 'legacy_workflow_url',
      workspace_name: config.workspaceName,
      workflow_id: config.workflowId,
      image_input: config.imageInput,
      workflow_parameters: config.workflowParameters,
      requested_plan: config.requestedPlan,
      requested_region: config.requestedRegion,
      stream_output: config.streamOutput,
      data_output: config.dataOutput,
      processing_timeout_sec: config.processingTimeoutSeconds,
      message: 'Roboflow Hosted API siap dipakai.',
    });
  } catch (error) {
    const status = error?.statusCode || 500;
    res.status(status).json({
      status: 'error',
      message: error?.message || 'Roboflow Hosted API belum siap.',
    });
  }
});

router.get('/model-info', auth, async (_req, res) => {
  try {
    const config = ensureConfigured();
    const names = Object.fromEntries(config.configuredLabels.map((label, index) => [String(index), label]));
    res.json({
      success: true,
      provider: 'roboflow-hosted',
      names,
      num_classes: config.configuredLabels.length,
      workflow_id: config.workflowId,
      workspace_name: config.workspaceName,
      image_input: config.imageInput,
      message:
        config.configuredLabels.length > 0
          ? 'Model labels loaded from ROBOFLOW_CLASS_NAMES.'
          : 'ROBOFLOW_CLASS_NAMES belum diisi, label akan mengikuti hasil prediksi runtime.',
    });
  } catch (error) {
    const status = error?.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error?.message || 'Gagal mengambil model info Roboflow.',
    });
  }
});

router.get('/webrtc/status', auth, async (_req, res) => {
  try {
    const config = ensureConfigured();
    res.json({
      ok: true,
      provider: 'roboflow-webrtc',
      api_url: config.apiUrl,
      workspace_name: config.workspaceName,
      workflow_id: config.workflowId,
      image_input: config.imageInput,
      workflow_parameters: config.workflowParameters,
      stream_output: config.streamOutput,
      data_output: config.dataOutput,
      requested_plan: config.requestedPlan,
      requested_region: config.requestedRegion,
      processing_timeout_sec: config.processingTimeoutSeconds,
      message: 'Roboflow WebRTC siap dipakai.',
    });
  } catch (error) {
    const status = error?.statusCode || 500;
    res.status(status).json({
      ok: false,
      message: error?.message || 'Roboflow WebRTC belum siap.',
    });
  }
});

router.get('/webrtc/turn-config', auth, async (_req, res) => {
  try {
    const config = ensureConfigured();
    const client = createInferenceClient(config);
    const iceServers = (await client.fetchTurnConfig()) || [];
    res.json({
      iceServers,
    });
  } catch (error) {
    const status = error instanceof WorkflowError ? error.statusCode : error?.statusCode || 500;
    res.status(status).json({
      message: error instanceof WorkflowError ? error.errorData?.message || error.message : error?.message || 'Gagal mengambil TURN config.',
      details: error instanceof WorkflowError ? error.errorData : null,
    });
  }
});

router.post('/webrtc/init', auth, async (req, res) => {
  try {
    const config = ensureConfigured();
    const offer = req.body?.offer;
    const wrtcParams = req.body?.wrtcParams || req.body?.wrtcparams || {};

    if (!offer?.sdp || !offer?.type) {
      return res.status(400).json({
        message: 'offer.sdp dan offer.type wajib diisi.',
      });
    }

    const client = createInferenceClient(config);
    const answer = await client.initializeWebrtcWorker({
      offer,
      workflowSpec: wrtcParams.workflowSpec,
      workspaceName: wrtcParams.workspaceName || config.workspaceName,
      workflowId: wrtcParams.workflowId || config.workflowId,
      config: {
        imageInputName: wrtcParams.imageInputName || config.imageInput,
        streamOutputNames: Array.isArray(wrtcParams.streamOutputNames) ? wrtcParams.streamOutputNames : config.streamOutput,
        dataOutputNames: Array.isArray(wrtcParams.dataOutputNames) ? wrtcParams.dataOutputNames : config.dataOutput,
        threadPoolWorkers: Number.isFinite(Number(wrtcParams.threadPoolWorkers)) ? Number(wrtcParams.threadPoolWorkers) : undefined,
        workflowsParameters:
          wrtcParams.workflowsParameters && typeof wrtcParams.workflowsParameters === 'object'
            ? wrtcParams.workflowsParameters
            : config.workflowParameters,
        iceServers: Array.isArray(wrtcParams.iceServers) ? wrtcParams.iceServers : undefined,
        processingTimeout: Number.isFinite(Number(wrtcParams.processingTimeout))
          ? Number(wrtcParams.processingTimeout)
          : config.processingTimeoutSeconds,
        requestedPlan: String(wrtcParams.requestedPlan || config.requestedPlan || '').trim() || undefined,
        requestedRegion: String(wrtcParams.requestedRegion || config.requestedRegion || '').trim() || undefined,
        realtimeProcessing:
          typeof wrtcParams.realtimeProcessing === 'boolean' ? wrtcParams.realtimeProcessing : true,
        rtspUrl: wrtcParams.rtspUrl,
        extraPayload: wrtcParams.extraPayload,
      },
    });

    res.json(answer);
  } catch (error) {
    // #region debug-point A-D: webrtc-init-error-shape
    const safeConfig = (() => {
      try {
        const config = getRoboflowConfig();
        return {
          apiUrl: config.apiUrl,
          workspaceName: config.workspaceName,
          workflowId: config.workflowId,
          imageInput: config.imageInput,
          requestedPlan: config.requestedPlan,
          requestedRegion: config.requestedRegion,
          streamOutput: config.streamOutput,
          dataOutput: config.dataOutput,
          workflowParameters: config.workflowParameters,
        };
      } catch {
        return null;
      }
    })();
    // #endregion debug-point A-D: webrtc-init-error-shape

    if (error instanceof WorkflowError) {
      return res.status(error.statusCode).json({
        message: error.errorData?.message || error.message,
        error_type: error.errorData?.error_type || null,
        context: error.errorData?.context || null,
        inner_error_type: error.errorData?.inner_error_type || null,
        inner_error_message: error.errorData?.inner_error_message || null,
        blocks_errors: Array.isArray(error.errorData?.blocks_errors) ? error.errorData.blocks_errors : [],
        debug: {
          source: 'server/routes/roboflowHosted.js:/webrtc/init',
          statusCode: error.statusCode,
          config: safeConfig,
          wrtcParams: req.body?.wrtcParams || req.body?.wrtcparams || null,
        },
      });
    }

    const status = error?.statusCode || 500;
    res.status(status).json({
      message: error?.message || 'Gagal menginisialisasi Roboflow WebRTC.',
      debug: {
        source: 'server/routes/roboflowHosted.js:/webrtc/init',
        statusCode: status,
        config: safeConfig,
        wrtcParams: req.body?.wrtcParams || req.body?.wrtcparams || null,
      },
    });
  }
});

router.post('/detect-frame', auth, async (req, res) => {
  let config;
  try {
    config = ensureConfigured();
    const imageBase64 = stripImageDataUrl(req.body?.image_base64);
    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        message: 'image_base64 is required',
      });
    }

    const requestedMinConfidence = Math.max(0, Math.min(1, toNumber(req.body?.conf, 0)));
    const includeAnnotated = Boolean(req.body?.include_annotated);
    const requestedParameters =
      req.body?.parameters && typeof req.body.parameters === 'object' ? req.body.parameters : undefined;

    const workflowResult = await runRoboflowWorkflow({
      config,
      imageBase64,
      parameters: requestedParameters,
    });

    const output = extractWorkflowEntry(workflowResult);
    const rawPredictions = findPredictionArray(output);
    const detections = Array.isArray(rawPredictions)
      ? rawPredictions
          .map((prediction) => normalizePrediction(prediction))
          .filter(Boolean)
          .filter((prediction) => prediction.confidence >= requestedMinConfidence)
      : [];

    let annotatedImage = '';
    let annotatedImagePath = null;
    const imageOutput = includeAnnotated ? findImageOutput(output) : null;
    if (imageOutput?.value) {
      const persisted = await persistWorkflowImageOutput(imageOutput.value);
      if (persisted) {
        annotatedImagePath = persisted.publicPath;
        annotatedImage = `${req.protocol}://${req.get('host')}${persisted.publicPath}`;
      }
    }

    res.json({
      success: true,
      provider: 'roboflow-hosted',
      detections,
      annotated_image: annotatedImage,
      annotated_image_path: annotatedImagePath,
      workflow_output_keys: extractWorkflowOutputKeys(workflowResult),
      raw_prediction_count: Array.isArray(rawPredictions) ? rawPredictions.length : 0,
      filtered_prediction_count: detections.length,
    });
  } catch (error) {
    const status = error?.response?.status || error?.statusCode || 500;
    let message =
      error?.response?.data?.message ||
      error?.details?.message ||
      error?.response?.data?.error ||
      error?.message ||
      'Gagal memproses frame ke Roboflow Hosted API.';

    if (status === 404) {
      message = `Roboflow resource not found. Active workflow: ${config?.workflowUrl || 'unknown'}. If the workflow contains a classification_model step, verify that the referenced model version still exists in Roboflow.`;
    }

    res.status(status).json({
      success: false,
      message,
      workflow_url: config?.workflowUrl || null,
      workflow_source: config ? (config.hasExplicitWorkflow ? 'workspace_and_workflow_id' : 'legacy_workflow_url') : null,
      details: error?.details || error?.response?.data || null,
    });
  }
});

export default router;
