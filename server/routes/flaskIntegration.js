import express from 'express';
import axios from 'axios';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Flask server configuration
const FLASK_SERVER_URL = process.env.FLASK_SERVER_URL || 'http://localhost:5001';

// Check Flask server status
router.get('/status', auth, async (req, res) => {
  try {
    const response = await axios.get(`${FLASK_SERVER_URL}/health`, { timeout: 5000 });
    res.json({ 
      status: 'connected', 
      flask_status: response.data,
      message: 'Flask server is running'
    });
  } catch (error) {
    console.error('Flask status check failed:', error.message);
    res.status(500).json({ 
      status: 'error',
      message: 'Flask server not responding. Please ensure Flask server is running on port 5001.',
      error: error.message 
    });
  }
});

// Initialize YOLO model on Flask server
router.post('/initialize-model', auth, async (req, res) => {
  try {
    const { model_path, model_type, confidence_threshold, iou_threshold } = req.body;
    
    console.log('Initializing model with Flask:', {
      model_path,
      model_type,
      confidence_threshold,
      iou_threshold
    });
    
    const response = await axios.post(`${FLASK_SERVER_URL}/api/initialize-model`, {
      model_path: model_path,
      model_type: model_type || 'auto',
      confidence_threshold: confidence_threshold || 0.5,
      iou_threshold: iou_threshold || 0.4
    }, { timeout: 60000 }); // 60 second timeout for model loading
    
    console.log('Flask model initialization response:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('Error initializing model:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false,
      message: 'Failed to initialize model on Flask server',
      error: error.response?.data || error.message,
      details: error.response?.status ? `HTTP ${error.response.status}` : 'Network error'
    });
  }
});

// Process frame with YOLO detection
router.post('/detect-frame', auth, async (req, res) => {
  try {
    const { frameData, seatPositions, sessionId } = req.body;
    
    const response = await axios.post(`${FLASK_SERVER_URL}/api/detect-frame`, {
      frame_data: frameData,
      seat_positions: seatPositions,
      session_id: sessionId
    }, { timeout: 10000 }); // 10 second timeout for detection
    
    // Process detection results
    const detectionResults = response.data;
    
    if (!detectionResults.success) {
      throw new Error(detectionResults.message || 'Detection failed');
    }
    
    // Update seat positions with detection results
    const updatedSeats = seatPositions.map(seat => {
      const detection = detectionResults.detections.find(d => d.seat_id === seat.seat_id);
      
      if (detection) {
        return {
          ...seat,
          face_detected: detection.face_detected,
          gesture_type: detection.gesture_type,
          confidence: detection.confidence,
          is_occupied: detection.face_detected || detection.body_detected
        };
      }
      
      return {
        ...seat,
        face_detected: false,
        gesture_type: 'unknown',
        confidence: 0,
        is_occupied: false
      };
    });
    
    res.json({
      success: true,
      updated_seats: updatedSeats,
      detection_summary: detectionResults.summary,
      gesture_analysis: detectionResults.gesture_analysis
    });
    
  } catch (error) {
    console.error('Error processing frame:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false,
      message: 'Failed to process frame',
      error: error.response?.data || error.message 
    });
  }
});

// Get model status from Flask server
router.get('/model-status', auth, async (req, res) => {
  try {
    const response = await axios.get(`${FLASK_SERVER_URL}/api/model-status`, { timeout: 5000 });
    res.json(response.data);
  } catch (error) {
    console.error('Error getting model status:', error.response?.data || error.message);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to get model status',
      error: error.response?.data || error.message 
    });
  }
});

// Stop model on Flask server
router.post('/stop-model', auth, async (req, res) => {
  try {
    const response = await axios.post(`${FLASK_SERVER_URL}/api/stop-model`, {}, { timeout: 5000 });
    res.json(response.data);
  } catch (error) {
    console.error('Error stopping model:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false,
      message: 'Failed to stop model',
      error: error.response?.data || error.message 
    });
  }
});

// Set model type on Flask server
router.post('/set-model-type', auth, async (req, res) => {
  try {
    const { model_type } = req.body;
    
    if (!model_type || !['model_1', 'model_2'].includes(model_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid model type. Must be model_1 or model_2'
      });
    }
    
    const response = await axios.post(`${FLASK_SERVER_URL}/api/set-model-type`, {
      model_type: model_type
    }, { timeout: 10000 });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error setting model type:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false,
      message: 'Failed to set model type',
      error: error.response?.data || error.message 
    });
  }
});

export default router;