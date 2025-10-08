from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import base64
import torch
import json
import os
from datetime import datetime
import logging
import sys

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('flask_server.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Global variables for model
current_model = None
model_config = {}

class YOLODetector:
    def __init__(self, model_path, confidence_threshold=0.5, iou_threshold=0.4, model_type=None):
        self.model_path = model_path
        self.confidence_threshold = confidence_threshold
        self.iou_threshold = iou_threshold
        self.model = None
        self.model_type = model_type or 'unknown'
        self.load_model()
    
    def load_model(self):
        try:
            logger.info(f"Loading model from {self.model_path}")
            
            # Check if model file exists
            if not os.path.exists(self.model_path):
                raise FileNotFoundError(f"Model file not found: {self.model_path}")
            
            # Get file size for logging
            file_size = os.path.getsize(self.model_path) / (1024 * 1024)  # MB
            logger.info(f"Model file size: {file_size:.2f} MB")
            
            # If model_type is already specified, use that directly
            if self.model_type in ['pytorch', 'onnx', 'tensorflow', 'custom']:
                logger.info(f"Using specified model type: {self.model_type}")
                if self.model_type == 'pytorch':
                    self._load_pytorch_model()
                elif self.model_type == 'onnx':
                    self._load_onnx_model()
                elif self.model_type == 'tensorflow':
                    self._load_tensorflow_model()
                elif self.model_type == 'custom':
                    self._load_custom_model()
            else:
                # Try to load the model based on file extension
                if self.model_path.endswith('.py'):
                    self.model_type = 'python_model'
                    self._load_custom_model()
                elif self.model_path.endswith('.pt') or self.model_path.endswith('.pth'):
                    self.model_type = 'pytorch'
                    self._load_pytorch_model()
                elif self.model_path.endswith('.onnx'):
                    self.model_type = 'onnx'
                    self._load_onnx_model()
                elif self.model_path.endswith('.pb') or self.model_path.endswith('.h5') or self.model_path.endswith('.keras'):
                    self.model_type = 'tensorflow'
                    self._load_tensorflow_model()
                else:
                    logger.warning(f"Unknown model format: {self.model_path}, attempting to load as custom model")
                    self._load_custom_model()
                
        except Exception as e:
            logger.error(f"Error loading model: {str(e)}")
            self._use_mock_model()
    
    def _load_pytorch_model(self):
        """Load PyTorch model (.pt file)"""
        try:
            # Try loading with ultralytics YOLOv8 first
            try:
                from ultralytics import YOLO
                self.model = YOLO(self.model_path)
                logger.info("Model loaded successfully with ultralytics YOLO")
                return
            except ImportError:
                logger.info("Ultralytics not available, trying torch.hub")
            except Exception as e:
                logger.warning(f"Ultralytics loading failed: {e}")
            
            # Try loading with torch.hub (YOLOv5)
            try:
                self.model = torch.hub.load('ultralytics/yolov5', 'custom', path=self.model_path, force_reload=True)
                logger.info("Model loaded successfully with torch.hub YOLOv5")
                return
            except Exception as e:
                logger.warning(f"Torch.hub loading failed: {e}")
            
            # Try loading as raw PyTorch model
            try:
                self.model = torch.load(self.model_path, map_location='cpu')
                logger.info("Model loaded as raw PyTorch model")
                return
            except Exception as e:
                logger.warning(f"Raw PyTorch loading failed: {e}")
            
            # If all methods fail, use mock model
            raise Exception("All PyTorch loading methods failed")
            
        except Exception as e:
            logger.error(f"PyTorch model loading failed: {e}")
            self._use_mock_model()
    
    def _load_onnx_model(self):
        """Load ONNX model (.onnx file)"""
        try:
            import onnxruntime as ort
            self.model = ort.InferenceSession(self.model_path)
            logger.info("ONNX model loaded successfully")
        except ImportError:
            logger.error("ONNX Runtime not installed")
            self._use_mock_model()
        except Exception as e:
            logger.error(f"ONNX model loading failed: {e}")
            self._use_mock_model()
    
    def _load_tensorflow_model(self):
        """Load TensorFlow model (.pb file)"""
        try:
            import tensorflow as tf
            self.model = tf.saved_model.load(self.model_path)
            logger.info("TensorFlow model loaded successfully")
        except ImportError:
            logger.error("TensorFlow not installed")
            self._use_mock_model()
        except Exception as e:
            logger.error(f"TensorFlow model loading failed: {e}")
            self._use_mock_model()
    
    def _use_mock_model(self):
        """Use mock model for demonstration"""
        self.model = "mock_model"
        self.model_type = 'mock'
        logger.info("Using mock model for demonstration")
    
    def detect_in_seats(self, frame, seat_positions):
        """
        Detect faces/heads within seat bounding boxes
        Returns detection results for each seat
        """
        detections = []
        
        logger.info(f"Processing {len(seat_positions)} seats with {self.model_type} model")
        
        for seat in seat_positions:
            seat_id = seat['seat_id']
            x, y, w, h = seat['x'], seat['y'], seat['width'], seat['height']
            
            # Validate seat coordinates
            if x < 0 or y < 0 or w <= 0 or h <= 0:
                detections.append(self.create_empty_detection(seat_id))
                continue
            
            # Extract ROI (Region of Interest) for this seat
            try:
                roi = frame[int(y):int(y+h), int(x):int(x+w)]
                
                if roi.size == 0:
                    detections.append(self.create_empty_detection(seat_id))
                    continue
                
                # Perform detection
                if self.model == "mock_model":
                    detection_result = self.simulate_detection(roi, seat_id)
                else:
                    detection_result = self.real_detection(roi, seat_id)
                
                detections.append(detection_result)
                
            except Exception as e:
                logger.error(f"Error processing seat {seat_id}: {e}")
                detections.append(self.create_empty_detection(seat_id))
        
        return detections
    
    def real_detection(self, roi, seat_id):
        """
        Perform real YOLO detection on the ROI
        """
        try:
            logger.debug(f"Running real detection for seat {seat_id}")
            
            # Run inference based on model type
            if self.model_type == 'pytorch':
                return self._pytorch_inference(roi, seat_id)
            elif self.model_type == 'onnx':
                return self._onnx_inference(roi, seat_id)
            elif self.model_type == 'tensorflow':
                return self._tensorflow_inference(roi, seat_id)
            else:
                return self.simulate_detection(roi, seat_id)
                
        except Exception as e:
            logger.error(f"Error in real detection for seat {seat_id}: {str(e)}")
            return self.simulate_detection(roi, seat_id)
    
    def _pytorch_inference(self, roi, seat_id):
        """PyTorch model inference"""
        try:
            # Run inference
            results = self.model(roi)
            
            # Process results based on model type
            if hasattr(results, 'pandas'):
                # YOLOv5 format
                return self._process_yolov5_results(results, seat_id)
            elif hasattr(results, 'boxes'):
                # YOLOv8 format
                return self._process_yolov8_results(results, seat_id)
            else:
                # Raw PyTorch model
                return self._process_raw_pytorch_results(results, seat_id)
                
        except Exception as e:
            logger.error(f"PyTorch inference error: {e}")
            return self.simulate_detection(roi, seat_id)
    
    def _process_yolov5_results(self, results, seat_id):
        """Process YOLOv5 results"""
        detections = results.pandas().xyxy[0]
        
        if len(detections) > 0:
            # Get highest confidence detection
            best_detection = detections.loc[detections['confidence'].idxmax()]
            confidence = float(best_detection['confidence'])
            
            # Determine detection type based on class
            class_name = str(best_detection['name']).lower()
            gesture_type = self.classify_gesture_from_class(class_name, confidence)
            
            bbox = {
                'x': int(best_detection['xmin']),
                'y': int(best_detection['ymin']),
                'width': int(best_detection['xmax'] - best_detection['xmin']),
                'height': int(best_detection['ymax'] - best_detection['ymin'])
            }
            
            return {
                'seat_id': seat_id,
                'face_detected': 'face' in class_name or 'head' in class_name or 'person' in class_name,
                'body_detected': True,
                'gesture_type': gesture_type,
                'confidence': confidence,
                'bbox': bbox
            }
        
        return self.create_empty_detection(seat_id)
    
    def _process_yolov8_results(self, results, seat_id):
        """Process YOLOv8 results"""
        if results.boxes is not None and len(results.boxes) > 0:
            # Get highest confidence detection
            confidences = results.boxes.conf.cpu().numpy()
            best_idx = np.argmax(confidences)
            confidence = float(confidences[best_idx])
            
            # Get class
            classes = results.boxes.cls.cpu().numpy()
            class_id = int(classes[best_idx])
            
            # Map class ID to gesture (this depends on your model's classes)
            gesture_type = self.classify_gesture_from_class_id(class_id, confidence)
            
            # Get bbox
            boxes = results.boxes.xyxy.cpu().numpy()
            box = boxes[best_idx]
            bbox = {
                'x': int(box[0]),
                'y': int(box[1]),
                'width': int(box[2] - box[0]),
                'height': int(box[3] - box[1])
            }
            
            return {
                'seat_id': seat_id,
                'face_detected': True,
                'body_detected': True,
                'gesture_type': gesture_type,
                'confidence': confidence,
                'bbox': bbox
            }
        
        return self.create_empty_detection(seat_id)
    
    def _onnx_inference(self, roi, seat_id):
        """ONNX model inference"""
        # Implement ONNX inference logic here
        return self.simulate_detection(roi, seat_id)
    
    def _tensorflow_inference(self, roi, seat_id):
        """TensorFlow model inference"""
        # Implement TensorFlow inference logic here
        return self.simulate_detection(roi, seat_id)
    
    def classify_gesture_from_class(self, class_name, confidence):
        """Classify gesture based on class name"""
        class_name = class_name.lower()
        
        if 'focused' in class_name or 'attention' in class_name:
            return 'focused'
        elif 'sleep' in class_name or 'drowsy' in class_name:
            return 'sleeping'
        elif 'phone' in class_name or 'mobile' in class_name:
            return 'using_phone'
        elif 'talk' in class_name or 'chat' in class_name:
            return 'chatting'
        elif 'write' in class_name or 'writing' in class_name:
            return 'writing'
        elif 'yawn' in class_name:
            return 'yawning'
        elif 'away' in class_name or 'distract' in class_name:
            return 'looking_away'
        elif 'face' in class_name or 'head' in class_name or 'person' in class_name:
            # Default classification based on confidence
            return self.classify_gesture_from_confidence(confidence)
        else:
            return 'unknown'
    
    def classify_gesture_from_class_id(self, class_id, confidence):
        """Classify gesture based on class ID"""
        # This mapping depends on your specific model
        # Adjust according to your model's class definitions
        gesture_map = {
            0: 'focused',
            1: 'looking_away',
            2: 'sleeping',
            3: 'using_phone',
            4: 'chatting',
            5: 'writing',
            6: 'yawning'
        }
        
        return gesture_map.get(class_id, self.classify_gesture_from_confidence(confidence))
    
    def classify_gesture_from_confidence(self, confidence):
        """Classify gesture based on confidence level"""
        if confidence > 0.8:
            return 'focused'
        elif confidence > 0.6:
            gestures = ['focused', 'looking_away', 'writing']
            return np.random.choice(gestures)
        else:
            return 'looking_away'
    
    def simulate_detection(self, roi, seat_id):
        """
        Simulate YOLO detection results for demonstration
        """
        import random
        
        # Simulate detection probabilities with realistic distribution
        face_detected = random.random() > 0.25  # 75% chance of face detection
        
        if face_detected:
            # Simulate gesture detection with realistic probabilities
            gestures = ['focused', 'looking_away', 'sleeping', 'using_phone', 'chatting', 'writing', 'yawning']
            # Focused is most likely, followed by looking_away
            gesture_weights = [0.45, 0.25, 0.08, 0.08, 0.06, 0.06, 0.02]
            gesture_type = random.choices(gestures, weights=gesture_weights)[0]
            confidence = random.uniform(0.65, 0.95)
        else:
            gesture_type = 'absent'
            confidence = 0.0
        
        return {
            'seat_id': seat_id,
            'face_detected': face_detected,
            'body_detected': face_detected,
            'gesture_type': gesture_type,
            'confidence': confidence,
            'bbox': {
                'x': random.randint(0, 50),
                'y': random.randint(0, 50),
                'width': random.randint(30, 80),
                'height': random.randint(40, 100)
            } if face_detected else None
        }
    
    def create_empty_detection(self, seat_id):
        """Create empty detection result"""
        return {
            'seat_id': seat_id,
            'face_detected': False,
            'body_detected': False,
            'gesture_type': 'absent',
            'confidence': 0.0,
            'bbox': None
        }

    def _load_custom_model(self):
        """Load custom model format"""
        try:
            # Try to import and use any custom model loading logic
            # This is a placeholder for custom model loading logic
            logger.info("Attempting to load as custom model")
            
            # First try with torch (most common)
            try:
                self.model = torch.load(self.model_path, map_location='cpu')
                logger.info("Loaded custom model with PyTorch")
                self.model_type = 'pytorch_custom'
                return
            except Exception as e:
                logger.warning(f"PyTorch custom loading failed: {e}")
            
            # Try with other frameworks or custom logic here
            # ...
            
            # If all fails, use mock model
            raise Exception("Custom model loading failed")
            
        except Exception as e:
            logger.error(f"Custom model loading failed: {e}")
            self._use_mock_model()

@app.route('/api/initialize-model', methods=['POST'])
def initialize_model():
    global current_model, model_config
    
    try:
        data = request.get_json()
        detection_model_type = data.get('detection_model_type', 'model_1')
        confidence_threshold = data.get('confidence_threshold', 0.5)
        iou_threshold = data.get('iou_threshold', 0.4)
        
        logger.info(f"Initializing model with detection type: {detection_model_type}")
        logger.info(f"Confidence threshold: {confidence_threshold}")
        logger.info(f"IoU threshold: {iou_threshold}")
        
        # Determine the correct model path based on detection_model_type
        # Only use .py models
        model_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
                                 'uploads', 'models', f'{detection_model_type}.py')
        
        logger.info(f"Using model path: {model_path}")
        
        # Validate model path
        if not os.path.exists(model_path):
            return jsonify({
                'success': False,
                'message': f'Model file not found: {model_path}'
            }), 400
        
        # Initialize detector
        current_model = YOLODetector(
            model_path=model_path,
            confidence_threshold=confidence_threshold,
            iou_threshold=iou_threshold
        )
        
        model_config = {
            'model_path': model_path,
            'model_type': current_model.model_type,
            'detection_model_type': detection_model_type,
            'confidence_threshold': confidence_threshold,
            'iou_threshold': iou_threshold,
            'status': 'active',
            'initialized_at': datetime.now().isoformat()
        }
        
        logger.info("Model initialized successfully")
        return jsonify({
            'success': True,
            'message': f'Model initialized successfully ({current_model.model_type})',
            'config': model_config
        })
        
    except Exception as e:
        logger.error(f"Error initializing model: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Failed to initialize model: {str(e)}'
        }), 500

@app.route('/api/detect-frame', methods=['POST'])
def detect_frame():
    global current_model
    
    try:
        if current_model is None:
            return jsonify({
                'success': False,
                'message': 'Model not initialized'
            }), 400
        
        data = request.get_json()
        frame_data = data.get('frame_data')
        seat_positions = data.get('seat_positions', [])
        session_id = data.get('session_id')
        timestamp = data.get('timestamp', datetime.now().isoformat())
        
        logger.debug(f"Processing frame for session {session_id} with {len(seat_positions)} seats")
        
        # Decode base64 frame data
        frame = None
        if frame_data:
            try:
                # Remove data URL prefix if present
                if ',' in frame_data:
                    frame_data = frame_data.split(',')[1]
                
                # Decode base64 to image
                img_data = base64.b64decode(frame_data)
                nparr = np.frombuffer(img_data, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if frame is None:
                    raise ValueError("Failed to decode image")
                    
                logger.debug(f"Frame decoded successfully: {frame.shape}")
                    
            except Exception as e:
                logger.warning(f"Error decoding frame: {str(e)}, using dummy frame")
                frame = np.zeros((480, 640, 3), dtype=np.uint8)
        else:
            # For simulation, create a dummy frame
            frame = np.zeros((480, 640, 3), dtype=np.uint8)
            logger.debug("Using dummy frame")
        
        # Process each seat with student information
        for seat in seat_positions:
            # Add student tracking fields if not present
            if 'student_id' not in seat:
                seat['student_id'] = ''
            if 'student_name' not in seat:
                seat['student_name'] = ''
            if 'attendance_time' not in seat:
                seat['attendance_time'] = None
            if 'departure_time' not in seat:
                seat['departure_time'] = None
        
        # Perform detection within seat bounding boxes
        detections = current_model.detect_in_seats(frame, seat_positions)
        
        # Update attendance tracking
        for i, detection in enumerate(detections):
            seat = seat_positions[i]
            # Update attendance time if this is the first time the seat is occupied
            if detection['face_detected'] and not seat.get('attendance_time'):
                seat['attendance_time'] = timestamp
                detections[i]['attendance_time'] = timestamp
            # Update departure time if the seat was previously occupied but now is not
            elif not detection['face_detected'] and seat.get('attendance_time') and not seat.get('departure_time'):
                seat['departure_time'] = timestamp
                detections[i]['departure_time'] = timestamp
            
            # Add student info to detection results
            detections[i]['student_id'] = seat.get('student_id', '')
            detections[i]['student_name'] = seat.get('student_name', '')
            detections[i]['attendance_time'] = seat.get('attendance_time')
            detections[i]['departure_time'] = seat.get('departure_time')
        
        # Calculate summary statistics
        total_seats = len(seat_positions)
        occupied_seats = sum(1 for d in detections if d['face_detected'])
        focused_count = sum(1 for d in detections if d['gesture_type'] == 'focused')
        
        # Analyze gestures
        gesture_analysis = analyze_gestures(detections)
        
        summary = {
            'total_seats': total_seats,
            'occupied_seats': occupied_seats,
            'focused_count': focused_count,
            'focus_percentage': (focused_count / total_seats * 100) if total_seats > 0 else 0,
            'timestamp': timestamp
        }
        
        logger.debug(f"Detection summary: {summary}")
        
        return jsonify({
            'success': True,
            'detections': detections,
            'summary': summary,
            'gesture_analysis': gesture_analysis,
            'session_id': session_id
        })
        
    except Exception as e:
        logger.error(f"Error processing frame: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Failed to process frame: {str(e)}'
        }), 500

@app.route('/api/model-status', methods=['GET'])
def get_model_status():
    global model_config
    
    if current_model is None:
        return jsonify({
            'status': 'inactive',
            'message': 'No model loaded'
        })
    
    return jsonify({
        'status': 'active',
        'config': model_config,
        'message': f'Model is running ({current_model.model_type})'
    })

@app.route('/api/set-model-type', methods=['POST'])
def set_model_type():
    global current_model, model_config
    
    try:
        data = request.get_json()
        model_type = data.get('model_type')
        
        if model_type not in ['model_1', 'model_2']:
            return jsonify({
                'success': False,
                'message': 'Invalid model type. Must be model_1 or model_2'
            }), 400
        
        if current_model is None:
            return jsonify({
                'success': False,
                'message': 'Model not initialized'
            }), 400
        
        # Determine the correct model path based on model_type
        model_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
                                 'uploads', 'models', f'{model_type}.py')
        
        # Check if model file exists
        if not os.path.exists(model_path):
            return jsonify({
                'success': False,
                'message': f'Model file not found: {model_path}'
            }), 400
        
        # Update model
        current_model = YOLODetector(
            model_path=model_path,
            confidence_threshold=model_config.get('confidence_threshold', 0.5),
            iou_threshold=model_config.get('iou_threshold', 0.4)
        )
        
        # Update model config
        model_config['model_path'] = model_path
        model_config['model_type'] = current_model.model_type
        model_config['initialized_at'] = datetime.now().isoformat()
        
        return jsonify({
            'success': True,
            'message': f'Model type set to {model_type}',
            'config': model_config
        })
        
    except Exception as e:
        logger.error(f"Error setting model type: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Failed to set model type: {str(e)}'
        }), 500

@app.route('/api/stop-model', methods=['POST'])
def stop_model():
    global current_model, model_config
    
    try:
        current_model = None
        model_config = {}
        
        logger.info("Model stopped successfully")
        return jsonify({
            'success': True,
            'message': 'Model stopped successfully'
        })
        
    except Exception as e:
        logger.error(f"Error stopping model: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Failed to stop model: {str(e)}'
        }), 500

def analyze_gestures(detections):
    """Analyze gesture distribution from detections"""
    gesture_counts = {}
    
    for detection in detections:
        gesture = detection['gesture_type']
        if gesture in gesture_counts:
            gesture_counts[gesture] += 1
        else:
            gesture_counts[gesture] = 1
    
    total_detections = len(detections)
    
    analysis = []
    for gesture, count in gesture_counts.items():
        analysis.append({
            'gesture_type': gesture,
            'count': count,
            'percentage': (count / total_detections * 100) if total_detections > 0 else 0
        })
    
    return analysis

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'model_loaded': current_model is not None,
        'model_type': current_model.model_type if current_model else None
    })

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    logger.info("Starting Flask server...")
    logger.info("Available endpoints:")
    logger.info("  POST /api/initialize-model")
    logger.info("  POST /api/detect-frame")
    logger.info("  GET  /api/model-status")
    logger.info("  POST /api/stop-model")
    logger.info("  GET  /health")
    
    app.run(host='0.0.0.0', port=5001, debug=True)