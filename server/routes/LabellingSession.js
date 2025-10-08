// routes/labelingSessions.js
import express from 'express';
import LabelingSession from '../models/LabelingSession.js';
import Settings from '../models/Settings.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.post('/', auth, async (req, res) => {
  try {
    const {
      session_name,
      class_name,
      total_seats,
      seat_positions,
      camera_settings,
      selected_model_path
    } = req.body;

    const settings = await Settings.findOne();
    if (!settings || !settings.models) {
      return res.status(400).json({ message: 'No models found in settings' });
    }

    const selectedModel = settings.models.find(m => m.path === selected_model_path);
    if (!selectedModel) {
      return res.status(400).json({ message: 'Selected model not found' });
    }

    const labelingSession = new LabelingSession({
      session_name,
      class_name,
      total_seats,
      seat_positions,
      camera_settings,
      model_settings: {
        model_path: selectedModel.path,
        confidence_threshold: settings.confidenceThreshold || 0.5,
        iou_threshold: settings.iouThreshold || 0.4
      },
      created_by: req.user.id
    });

    await labelingSession.save();
    res.status(201).json(labelingSession);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }

  // Get all saved models
router.get('/models', auth, async (req, res) => {
  try {
    const settings = await Settings.findOne();
    if (!settings || !settings.models) {
      return res.json([]);
    }
    res.json(settings.models);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

});

export default router;
