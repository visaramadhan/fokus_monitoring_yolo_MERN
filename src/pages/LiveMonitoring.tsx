import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Square, 
  Camera, 
  Eye, 
  EyeOff, 
  Download,
  Settings,
  BarChart3,
  Clock,
  Target,
  Grid3X3,
  Trash2,
  Save,
  Users,
  BookOpen,
  Brain,
  Upload,
  Calendar,
  User,
  CheckCircle,
  AlertCircle,
  XCircle
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

interface SeatPosition {
  seat_id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  is_occupied: boolean;
  student_id: string | null;
  face_detected: boolean;
  gesture_type: string;
  confidence: number;
  focus_start_time: number | null;
  total_focus_duration: number;
  attendance_time: string | null;
  departure_time: string | null;
}

interface DetectionData {
  timestamp: string;
  totalDetections: number;
  focusedCount: number;
  notFocusedCount: number;
  sleepingCount: number;
  phoneUsingCount: number;
  chattingCount: number;
  yawningCount: number;
  writingCount: number;
  focusPercentage: number;
  seatData: SeatPosition[];
}

interface LiveSession {
  _id: string;
  sessionId: string;
  kelas: string;
  mata_kuliah: string;
  startTime: string;
  isActive: boolean;
  detectionData: DetectionData[];
  seatPositions: SeatPosition[];
  summary: {
    averageFocus: number;
    peakFocus: number;
    lowestFocus: number;
  };
}

interface CameraDevice {
  deviceId: string;
  label: string;
}

interface Schedule {
  seat_positions: any;
  _id: string;
  kelas: string;
  mata_kuliah: string;
  mata_kuliah_id: string;
  dosen_id: string;
  dosen_name: string;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  durasi: number;
  pertemuan_ke: number;
  topik: string;
  ruangan: string;
  status: string;
}

interface ModelFile {
  name: string;
  path: string;
  size: number;
  uploadedAt: string;
}

export default function LiveMonitoring() {
  useAuth(); // Only initialize auth context without destructuring unused user
  
  // Session Management
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentSession, setCurrentSession] = useState<LiveSession | null>(null);
  const [detectionData, setDetectionData] = useState<DetectionData[]>([]);
  
  // Configuration
  const [selectedSchedule, setSelectedSchedule] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showCameraSettings, setShowCameraSettings] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [targetFocusRate, setTargetFocusRate] = useState(80); // Target focus rate in percentage
  const [gridSize, setGridSize] = useState(3); // Grid size for seat layout
  const [savedLayouts, setSavedLayouts] = useState<{name: string, positions: SeatPosition[]}[]>([]);
  const [currentLayout, setCurrentLayout] = useState<string>('');
  
  // Camera & Labelling
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [seatPositions, setSeatPositions] = useState<SeatPosition[]>([]);
  const [totalSeats, setTotalSeats] = useState(30);
  
  // Drawing State
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentSeat, setCurrentSeat] = useState<Partial<SeatPosition> | null>(null);
  const [isLabellingMode, setIsLabellingMode] = useState(false);
  
  // Data
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [models, setModels] = useState<ModelFile[]>([]);
  
  // Flask Status
  const [flaskStatus, setFlaskStatus] = useState<'disconnected' | 'connected' | 'error'>('disconnected');
  const [modelStatus, setModelStatus] = useState<'inactive' | 'loading' | 'active' | 'error'>('inactive');
  const [flaskError, setFlaskError] = useState<string>('');
  const [detectionModelType, setDetectionModelType] = useState<'model_1' | 'model_2'>('model_1'); // Model 1: tidur, main hp, normal | Model 2: nguap, balik_badan, normal
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    getCameraDevices();
    fetchSchedules();
    fetchModels();
    checkFlaskStatus();
    
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isMonitoring) {
      syncCanvasSize();
      window.addEventListener('resize', syncCanvasSize);
      return () => window.removeEventListener('resize', syncCanvasSize);
    }
  }, [isMonitoring]);

  // Data Fetching Functions
  const getCameraDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 8)}`
        }));
      setCameras(videoDevices);
      if (videoDevices.length > 0) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
    } catch (error) {
      toast.error('Failed to get camera devices');
      console.error('Camera enumeration error:', error);
    }
  };

  const fetchSchedules = async () => {
    try {
      const response = await axios.get('/api/jadwal');
      setSchedules(response.data);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  };

  const fetchModels = async () => {
    try {
      const response = await axios.get('/api/models/list');
      setModels(response.data);
      // No need to set selectedModel as we're using detection_model_type instead
    } catch (error) {
      console.error('Error fetching models:', error);
      toast.error('Failed to fetch available models');
    }
  };

  const checkFlaskStatus = async () => {
    try {
      const response = await axios.get('/api/flask/status');
      setFlaskStatus('connected');
      setFlaskError('');
      
      // Check current model type
      try {
        const modelTypeResponse = await axios.get('/api/flask/model-type');
        if (modelTypeResponse.data.success && modelTypeResponse.data.model_type) {
          setDetectionModelType(modelTypeResponse.data.model_type);
        }
      } catch (modelTypeError) {
        console.error('Error getting model type:', modelTypeError);
      }
    } catch (error) {
      setFlaskStatus('error');
      setFlaskError('Flask server not responding. Please ensure Flask server is running on port 5001.');
      console.error('Flask status check failed:', error);
    }
  };
  
  const setModelType = async (modelType: 'model_1' | 'model_2') => {
    try {
      setModelStatus('loading');
      const response = await axios.post('/api/flask/set-model-type', { model_type: modelType });
      if (response.data.success) {
        setDetectionModelType(modelType);
        toast.success(`Model type set to ${modelType}`);
        setModelStatus('active');
      } else {
        const errorMessage = response.data.message || 'Failed to set model type';
        setFlaskError(errorMessage);
        toast.error(errorMessage);
        setModelStatus('error');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to set model type';
      console.error('Error setting model type:', error);
      setFlaskError(errorMessage);
      toast.error(errorMessage);
      setModelStatus('error');
    }
  };

  // Camera Functions
  const startCamera = async () => {
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
          width: 1920,
          height: 1080
        },
        audio: false
      });

      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        syncCanvasSize();
      }
      toast.success('Camera started successfully');
    } catch (error) {
      toast.error('Failed to start camera');
      console.error('Camera start error:', error);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    toast.success('Camera stopped');
  };

  // Flask Model Functions
  const initializeFlaskModel = async () => {
    setModelStatus('loading');
    try {
      // Ensure we're using the correct parameters for the API
      const response = await axios.post('/api/flask/initialize-model', {
        detection_model_type: detectionModelType,
        confidence_threshold: 0.5,
        iou_threshold: 0.4
      });

      if (response.data.success) {
        setModelStatus('active');
        setFlaskError(''); // Clear any previous errors
        toast.success('Model initialized successfully');
        return true;
      } else {
        const errorMessage = response.data.message || 'Model initialization failed';
        setFlaskError(errorMessage);
        setModelStatus('error');
        toast.error(errorMessage);
        return false;
      }
    } catch (error: any) {
      setModelStatus('error');
      const errorMessage = error.response?.data?.message || error.message || 'Failed to initialize model';
      setFlaskError(errorMessage);
      toast.error(`Model initialization failed: ${errorMessage}`);
      console.error('Flask model initialization error:', error);
      return false;
    }
  };

  // Seat Labelling Functions
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isLabellingMode || !cameraStream) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setCurrentSeat({
      seat_id: seatPositions.length + 1,
      x,
      y,
      width: 0,
      height: 0,
      is_occupied: false,
      student_id: null,
      face_detected: false,
      gesture_type: 'unknown',
      confidence: 0,
      focus_start_time: null,
      total_focus_duration: 0,
      attendance_time: null,
      departure_time: null
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentSeat || !isLabellingMode) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    // Update current seat dimensions
    setCurrentSeat({
      ...currentSeat,
      width: currentX - (currentSeat.x || 0),
      height: currentY - (currentSeat.y || 0)
    });

    // Force immediate redraw to show the current drawing state
    // This ensures the drawing is visible during drag
    const ctx = canvas.getContext('2d');
    if (ctx && currentSeat) {
      // First draw all existing seats
      drawCanvas();
      
      // Then draw the current seat being created with high visibility
      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(
        currentSeat.x || 0,
        currentSeat.y || 0,
        currentX - (currentSeat.x || 0),
        currentY - (currentSeat.y || 0)
      );
    }
  };

  const handleCanvasMouseUp = (e?: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentSeat || !isLabellingMode) return;

    // Only create a seat if the size is reasonable
    if (Math.abs(currentSeat.width || 0) > 20 && Math.abs(currentSeat.height || 0) > 20) {
      const studentId = prompt('Enter Student ID (optional):', '');
      
      // Ensure width and height are positive
      const width = Math.abs(currentSeat.width || 0);
      const height = Math.abs(currentSeat.height || 0);
      
      // Calculate correct position (handle negative width/height cases)
      let x = currentSeat.x || 0;
      let y = currentSeat.y || 0;
      
      if ((currentSeat.width || 0) < 0) {
        x += (currentSeat.width || 0);
      }
      
      if ((currentSeat.height || 0) < 0) {
        y += (currentSeat.height || 0);
      }
      
      const newSeat: SeatPosition = {
        seat_id: seatPositions.length + 1,
        x,
        y,
        width,
        height,
        is_occupied: false,
        student_id: studentId || null,
        face_detected: false,
        gesture_type: 'unknown',
        confidence: 0,
        focus_start_time: null,
        total_focus_duration: 0,
        attendance_time: null,
        departure_time: null
      };

      setSeatPositions([...seatPositions, newSeat]);
      toast.success(`Seat ${newSeat.seat_id} added${studentId ? ` with ID: ${studentId}` : ''}`);
    } else if (isDrawing) {
      // If drawing was too small, inform the user
      toast.info('Drawing too small - try again with a larger area');
    }

    // Reset drawing state
    setIsDrawing(false);
    setCurrentSeat(null);
    
    // Force redraw to clear any temporary drawing
    drawCanvas();
  };

  const generateGridSeats = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Ensure we have camera stream before generating grid
    if (!cameraStream) {
      toast.error('Please start camera first');
      return;
    }

    // Calculate grid based on canvas size for better fit
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    console.log('Generating grid on canvas:', canvasWidth, 'x', canvasHeight);
    
    // Determine grid size based on dropdown selection
    let rows, cols;
    if (gridSize === 'small') {
      rows = 2;
      cols = 2;
    } else if (gridSize === 'medium') {
      rows = 3;
      cols = 3;
    } else {
      rows = 4;
      cols = 4;
    }
    
    // Calculate seat dimensions to fit canvas with better visibility
    // Use larger padding for better visibility
    const padding = 30; // Increased padding
    const seatWidth = Math.floor((canvasWidth - (cols + 1) * padding) / cols);
    const seatHeight = Math.floor((canvasHeight - (rows + 1) * padding) / rows);
    
    const newSeats: SeatPosition[] = [];
    let seatId = 1;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (seatId <= totalSeats) {
          // Calculate position with padding
          const x = col * (seatWidth + padding) + padding;
          const y = row * (seatHeight + padding) + padding;
          
          newSeats.push({
            seat_id: seatId,
            x,
            y,
            width: seatWidth,
            height: seatHeight,
            is_occupied: false,
            student_id: `Student-${seatId}`,
            face_detected: false,
            gesture_type: 'unknown',
            confidence: 0,
            focus_start_time: null,
            total_focus_duration: 0,
            attendance_time: null,
            departure_time: null
          });
          seatId++;
        }
      }
    }

    setSeatPositions(newSeats);
    toast.success(`Generated ${newSeats.length} seat positions in a ${rows}x${cols} grid`);
    
    // Force redraw canvas to show the grid
    drawCanvas();
    
    // If we're in monitoring mode, start detection
    if (isMonitoringActive && !isLabellingMode) {
      startFlaskDetection();
    }
  };

  const clearAllSeats = () => {
    setSeatPositions([]);
    toast.success('All seats cleared');
  };

  // Canvas Drawing
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid background for better visibility in labelling mode
    if (isLabellingMode) {
      // Draw light grid lines for reference
      ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
      ctx.lineWidth = 1;
      
      // Draw vertical grid lines
      const gridSize = 50; // Size of grid cells
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      
      // Draw horizontal grid lines
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    }

    // Draw existing seats
    seatPositions.forEach((seat) => {
      let strokeColor = '#3B82F6'; // Default blue
      let fillColor = 'rgba(59, 130, 246, 0.2)'; // Slightly more visible
      
      if (seat.face_detected && seat.gesture_type === 'focused') {
        strokeColor = '#10B981'; // Green for focused
        fillColor = 'rgba(16, 185, 129, 0.3)';
      } else if (seat.face_detected && seat.gesture_type !== 'focused') {
        strokeColor = '#F59E0B'; // Orange for detected but not focused
        fillColor = 'rgba(245, 158, 11, 0.3)';
      } else if (seat.is_occupied) {
        strokeColor = '#EF4444'; // Red for occupied but no face
        fillColor = 'rgba(239, 68, 68, 0.3)';
      }

      // Draw seat with shadow for better visibility
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      
      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = fillColor;
      ctx.lineWidth = 3;
      ctx.fillRect(seat.x, seat.y, seat.width, seat.height);
      ctx.strokeRect(seat.x, seat.y, seat.width, seat.height);
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      // Draw seat label
      ctx.fillStyle = strokeColor;
      ctx.font = 'bold 14px Arial'; // Bolder and larger font
      ctx.fillText(`S${seat.seat_id}`, seat.x + 5, seat.y + 18);
      
      // Draw gesture type
      if (seat.gesture_type && seat.gesture_type !== 'unknown') {
        ctx.fillStyle = strokeColor;
        ctx.font = '12px Arial';
        ctx.fillText(seat.gesture_type, seat.x + 5, seat.y + 36);
      }
      
      // Draw focus duration if available
      if (seat.total_focus_duration > 0) {
        const minutes = Math.floor(seat.total_focus_duration / 60000);
        const seconds = Math.floor((seat.total_focus_duration % 60000) / 1000);
        ctx.fillText(`${minutes}:${seconds.toString().padStart(2, '0')}`, seat.x + 5, seat.y + seat.height - 8);
      }
    });

    // Draw current drawing seat with improved visibility
    if (isDrawing && currentSeat && isLabellingMode) {
      // Use a more visible color and thicker line
      ctx.strokeStyle = '#FF0000'; // Bright red
      ctx.lineWidth = 4; // Thicker line
      ctx.setLineDash([8, 4]); // More visible dash pattern
      
      // Draw the rectangle
      ctx.strokeRect(
        currentSeat.x || 0,
        currentSeat.y || 0,
        currentSeat.width || 0,
        currentSeat.height || 0
      );
      
      // Draw handles at corners for better visibility
      const handleSize = 8;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect((currentSeat.x || 0) - handleSize/2, (currentSeat.y || 0) - handleSize/2, handleSize, handleSize);
      ctx.fillRect((currentSeat.x || 0) + (currentSeat.width || 0) - handleSize/2, (currentSeat.y || 0) - handleSize/2, handleSize, handleSize);
      ctx.fillRect((currentSeat.x || 0) - handleSize/2, (currentSeat.y || 0) + (currentSeat.height || 0) - handleSize/2, handleSize, handleSize);
      ctx.fillRect((currentSeat.x || 0) + (currentSeat.width || 0) - handleSize/2, (currentSeat.y || 0) + (currentSeat.height || 0) - handleSize/2, handleSize, handleSize);
      
      ctx.setLineDash([]); // Reset dash pattern
      
      // Draw more visible label indicators at corners
      const x = currentSeat.x || 0;
      const y = currentSeat.y || 0;
      const w = currentSeat.width || 0;
      const h = currentSeat.height || 0;
      
      // Draw corner markers with larger size for better visibility
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(x - 5, y - 5, 10, 10);
      ctx.fillRect(x + w - 5, y - 5, 10, 10);
      ctx.fillRect(x - 5, y + h - 5, 10, 10);
      ctx.fillRect(x + w - 5, y + h - 5, 10, 10);
    }
  };

  const syncCanvasSize = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas) {
      const rect = video.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      // Ensure canvas is properly sized and positioned
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.zIndex = '10'; // Ensure canvas is above video
      canvas.style.pointerEvents = 'auto'; // Make sure canvas receives mouse events
      
      // Force immediate redraw
      drawCanvas();
      
      console.log('Canvas synced:', canvas.width, 'x', canvas.height);
    }
  };

  useEffect(() => {
    if (cameraStream) {
      // Ensure canvas is properly sized when camera starts
      syncCanvasSize();
      
      // Set up interval for continuous canvas redrawing
      const interval = setInterval(drawCanvas, 100);
      return () => clearInterval(interval);
    }
  }, [cameraStream, seatPositions, currentSeat, isDrawing, isLabellingMode]);
  
  // Add effect to handle window resize for responsive canvas
  useEffect(() => {
    window.addEventListener('resize', syncCanvasSize);
    return () => window.removeEventListener('resize', syncCanvasSize);
  }, []);

  // Monitoring Functions
  const startMonitoring = async () => {
    if (!selectedSchedule) {
      toast.error('Please select a schedule');
      return;
    }

    if (seatPositions.length === 0) {
      toast.error('Please add seat positions before starting monitoring');
      return;
    }

    try {
      if (!cameraStream) {
        await startCamera();
      }

      // Initialize Flask model
      const modelInitialized = await initializeFlaskModel();
      if (!modelInitialized) {
        return;
      }

      const schedule = schedules.find(s => s._id === selectedSchedule);
      if (!schedule) {
        toast.error('Selected schedule not found');
        return;
      }

      const response = await axios.post('/api/live-monitoring/start', {
        kelas: schedule.kelas,
        mata_kuliah_id: schedule.mata_kuliah_id,
        mata_kuliah: schedule.mata_kuliah,
        sessionName: sessionName || `${schedule.mata_kuliah} - ${schedule.kelas}`,
        seatPositions,
        detection_model_type: detectionModelType
      });

      setCurrentSession(response.data);
      setIsMonitoring(true);
      setIsLabellingMode(false);
      toast.success('Live monitoring started');

      // Start face detection with Flask
      startFlaskDetection(response.data.sessionId);
    } catch (error) {
      toast.error('Failed to start monitoring');
      console.error('Start monitoring error:', error);
    }
  };

  const stopMonitoring = async () => {
    if (!currentSession) return;

    try {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }

      await axios.post(`/api/live-monitoring/stop/${currentSession.sessionId}`);
      
      // Export data automatically
      await exportSessionData();
      
      setIsMonitoring(false);
      setCurrentSession(null);
      setDetectionData([]);
      setModelStatus('inactive');
      
      // Reset seat focus data
      setSeatPositions(prev => prev.map(seat => ({
        ...seat,
        face_detected: false,
        gesture_type: 'unknown',
        confidence: 0,
        focus_start_time: null,
        total_focus_duration: 0
      })));
      
      toast.success('Live monitoring stopped and data exported');
    } catch (error) {
      toast.error('Failed to stop monitoring');
      console.error('Stop monitoring error:', error);
    }
  };

  const startFlaskDetection = (sessionId: string) => {
    if (!sessionId) {
      console.error('Session ID is required for detection');
      toast.error('Missing session ID for detection');
      return;
    }
    
    // Set detection interval to run every 60 seconds (1 minute) exactly as requested
    const ONE_MINUTE = 60 * 1000; // 60 seconds in milliseconds
    
    // Clear any existing interval first
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    
    // Run detection once immediately when monitoring starts
    runDetection(sessionId);
    
    // Then set up interval for every minute
    detectionIntervalRef.current = setInterval(() => {
      runDetection(sessionId);
    }, ONE_MINUTE);
    
    console.log(`Detection started for session: ${sessionId}`);
  };
  
  // Separate function to run detection for better organization
  const runDetection = async (sessionId: string) => {
    if (!sessionId) {
      console.error('Session ID is required for detection');
      return;
    }
    
    if (!isMonitoring || !videoRef.current) {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      return;
    }

    try {
      // Capture frame from video
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Failed to get canvas context');
        return;
      }

      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);
      
      const frameData = canvas.toDataURL('image/jpeg', 0.8);
      if (!frameData || frameData === 'data:,') {
        console.error('Failed to capture frame data');
        return;
      }

      // Ensure we have valid seat positions
      if (!seatPositions || seatPositions.length === 0) {
        console.error('No seat positions defined for detection');
        return;
      }

      // Send frame to Flask for detection
      const response = await axios.post('/api/flask/detect-frame', {
        frameData,
        seatPositions,
        sessionId
      });
      
      // Log detection time
      const detectionTime = new Date().toLocaleTimeString();
      console.log('Detection performed at:', detectionTime);
      toast.success(`Detection performed at ${detectionTime}`, { duration: 2000 });

      if (response.data.success) {
        const updatedSeats = response.data.updated_seats;
        if (!updatedSeats || !Array.isArray(updatedSeats)) {
          console.error('Invalid seat data received from detection API');
          return;
        }
        
        const currentTime = Date.now();

        // Update seat positions with detection results
        const newSeats = updatedSeats.map((seat: any) => {
          const existingSeat = seatPositions.find(s => s.seat_id === seat.seat_id);
          if (!existingSeat) {
            console.warn(`Seat with ID ${seat.seat_id} not found in existing seats`);
            return seat; // Return the new seat data as is
          }
          
          let newSeat = { ...seat };

          // Handle focus duration tracking
          if (seat.gesture_type === 'focused' && !existingSeat.face_detected) {
            // Just started focusing
            newSeat.focus_start_time = currentTime;
            newSeat.total_focus_duration = existingSeat.total_focus_duration || 0;
          } else if (seat.gesture_type !== 'focused' && existingSeat.face_detected && existingSeat.focus_start_time) {
            // Stopped focusing
            newSeat.total_focus_duration = (existingSeat.total_focus_duration || 0) + (currentTime - existingSeat.focus_start_time);
            newSeat.focus_start_time = null;
          } else if (seat.gesture_type === 'focused' && existingSeat.focus_start_time) {
            // Continue focusing
            newSeat.total_focus_duration = existingSeat.total_focus_duration || 0;
            newSeat.focus_start_time = existingSeat.focus_start_time;
          } else {
            // Not focusing
            newSeat.total_focus_duration = existingSeat.total_focus_duration || 0;
            newSeat.focus_start_time = null;
          }

          // Ensure attendance tracking
          if (seat.face_detected && !existingSeat.attendance_time) {
            newSeat.attendance_time = new Date().toISOString();
          } else if (existingSeat.attendance_time) {
            newSeat.attendance_time = existingSeat.attendance_time;
          }

          // Track departure time if student was present but is now gone
          if (!seat.face_detected && existingSeat.face_detected && existingSeat.attendance_time && !existingSeat.departure_time) {
            newSeat.departure_time = new Date().toISOString();
          } else if (existingSeat.departure_time) {
            newSeat.departure_time = existingSeat.departure_time;
          }

          return newSeat;
        });

        setSeatPositions(newSeats);

        // Calculate detection statistics
        const totalDetections = newSeats.filter((seat: any) => seat.face_detected).length;
        const focusedCount = newSeats.filter((seat: any) => seat.gesture_type === 'focused').length;
        const notFocusedCount = totalDetections - focusedCount;
        const sleepingCount = newSeats.filter((seat: any) => seat.gesture_type === 'sleeping').length;
        const phoneUsingCount = newSeats.filter((seat: any) => seat.gesture_type === 'using_phone').length;
        const chattingCount = newSeats.filter((seat: any) => seat.gesture_type === 'chatting').length;
        const yawningCount = newSeats.filter((seat: any) => seat.gesture_type === 'yawning').length;
        const writingCount = newSeats.filter((seat: any) => seat.gesture_type === 'writing').length;
        const focusPercentage = totalDetections > 0 ? Math.round((focusedCount / totalDetections) * 100) : 0;

        const newDetectionData: DetectionData = {
          timestamp: detectionTime,
          totalDetections,
          focusedCount,
          notFocusedCount,
          sleepingCount,
          phoneUsingCount,
          chattingCount,
          yawningCount,
          writingCount,
          focusPercentage,
          seatData: newSeats
        };

        setDetectionData(prev => [...prev.slice(-19), newDetectionData]);

        // Send to backend
        try {
          await axios.post(`/api/live-monitoring/detection/${sessionId}`, newDetectionData);
        } catch (error) {
          console.error('Failed to save detection data to backend:', error);
        }
      } else {
        console.error('Detection failed:', response.data.message || 'Unknown error');
        toast.error('Detection failed: ' + (response.data.message || 'Unknown error'));
      }

    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      console.error('Flask detection error:', errorMessage);
      toast.error('Detection error: ' + errorMessage);
    }
  };

  const exportSessionData = async () => {
    if (!currentSession) return;

    try {
      const schedule = schedules.find(s => s._id === selectedSchedule);
      if (!schedule) return;

      // Calculate per-student statistics
      const studentStats = seatPositions
        .filter(seat => seat.student_id)
        .map(seat => ({
          student_id: seat.student_id,
          seat_id: seat.seat_id,
          total_focus_duration: seat.total_focus_duration,
          attendance_time: seat.attendance_time,
          departure_time: seat.departure_time,
          focus_percentage: seat.total_focus_duration > 0 && currentSession.startTime ? 
            (seat.total_focus_duration / (Date.now() - new Date(currentSession.startTime).getTime())) * 100 : 0
        }));

      // Save to database
      const response = await axios.post('/api/session-records', {
        sessionId: currentSession.sessionId,
        sessionName: sessionName || `${schedule.mata_kuliah} - ${schedule.kelas}`,
        className: schedule.kelas,
        subjectName: schedule.mata_kuliah,
        seatData: seatPositions,
        detectionData,
        studentData: studentStats,
        summary: {
          totalSeats: seatPositions.length,
          averageFocusTime: seatPositions.reduce((sum, seat) => sum + seat.total_focus_duration, 0) / seatPositions.length,
          sessionDuration: Date.now() - new Date(currentSession.startTime).getTime()
        },
        tanggal: schedule.tanggal,
        jamMulai: schedule.jam_mulai,
        jamSelesai: schedule.jam_selesai,
        durasi: schedule.durasi,
        dosenId: schedule.dosen_id
      });

      toast.success('Session data exported successfully');
      return response.data;
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export session data');
      return null;
    }
  };
  
  const downloadSessionData = async () => {
    if (!currentSession) {
      toast.error('No active session to download');
      return;
    }
    
    try {
      const response = await axios.get(`/api/export/excel/session/${currentSession.sessionId}`, {
        responseType: 'blob'
      });
      
      // Create a blob URL and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${sessionName || 'session'}_export.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Session data downloaded successfully');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download session data');
    }
  };
  
  const saveSessionData = async () => {
    if (!currentSession) {
      toast.error('No active session to save');
      return;
    }
    
    try {
      // First export the data to ensure it's saved
      const exportedData = await exportSessionData();
      if (!exportedData) return;
      
      // Then save the session state
      await axios.post(`/api/live-monitoring/save/${currentSession.sessionId}`, {
        seatPositions,
        detectionData
      });
      
      toast.success('Session state saved successfully');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save session state');
    }
  };

  const loadScheduleData = (scheduleId: string) => {
    const schedule = schedules.find(s => s._id === scheduleId);
    if (schedule) {
      setSessionName(`${schedule.mata_kuliah} - ${schedule.kelas} - Meeting ${schedule.pertemuan_ke}`);
      // Load seat positions if available
      if (schedule.seat_positions && schedule.seat_positions.length > 0) {
        setSeatPositions(schedule.seat_positions.map((seat: any) => ({
          ...seat,
          is_occupied: false,
          face_detected: false,
          gesture_type: 'unknown',
          confidence: 0,
          focus_start_time: null,
          total_focus_duration: 0
        })));
      }
    }
  };

  // Statistics
  const latestData = detectionData[detectionData.length - 1];
  const averageFocus = detectionData.length > 0 
    ? Math.round(detectionData.reduce((sum, d) => sum + d.focusPercentage, 0) / detectionData.length)
    : 0;

  const pieData = latestData ? [
    { name: 'Focused', value: latestData.focusedCount, color: '#10B981' },
    { name: 'Not Focused', value: latestData.notFocusedCount, color: '#EF4444' },
    { name: 'Sleeping', value: latestData.sleepingCount, color: '#8B5CF6' },
    { name: 'Using Phone', value: latestData.phoneUsingCount, color: '#F59E0B' },
    { name: 'Chatting', value: latestData.chattingCount, color: '#EC4899' },
    { name: 'Writing', value: latestData.writingCount, color: '#06B6D4' }
  ].filter(item => item.value > 0) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 via-purple-600 to-teal-600 rounded-xl p-6 text-white"
      >
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center">
              <Target className="h-8 w-8 mr-3" />
              Live Focus Monitoring & AI Detection
            </h1>
            <p className="mt-2 opacity-90">Real-time student focus detection with YOLO AI models</p>
          </div>
          <div className="flex items-center space-x-4">
            {isMonitoring && (
              <motion.div 
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="flex items-center bg-red-500 px-3 py-1 rounded-full"
              >
                <div className="w-2 h-2 bg-white rounded-full mr-2"></div>
                <span className="text-sm font-medium">LIVE</span>
              </motion.div>
            )}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsLabellingMode(!isLabellingMode)}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                isLabellingMode 
                  ? 'bg-orange-500 hover:bg-orange-600' 
                  : 'bg-white bg-opacity-20 hover:bg-opacity-30'
              }`}
            >
              {isLabellingMode ? 'Exit Labelling' : 'Enter Labelling Mode'}
            </motion.button>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Control Panel */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Configuration
          </h3>
          
          <div className="space-y-4">
            {/* Flask Status */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Flask Server</span>
                <div className={`flex items-center ${
                  flaskStatus === 'connected' ? 'text-green-600' : 
                  flaskStatus === 'error' ? 'text-red-600' : 'text-gray-400'
                }`}>
                  {flaskStatus === 'connected' ? <CheckCircle className="h-4 w-4" /> :
                   flaskStatus === 'error' ? <XCircle className="h-4 w-4" /> :
                   <AlertCircle className="h-4 w-4" />}
                  <span className="ml-1 text-xs">{flaskStatus}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Model Status</span>
                <div className={`flex items-center ${
                  modelStatus === 'active' ? 'text-green-600' : 
                  modelStatus === 'loading' ? 'text-yellow-600' :
                  modelStatus === 'error' ? 'text-red-600' : 'text-gray-400'
                }`}>
                  {modelStatus === 'loading' && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-1"></div>}
                  <span className="text-xs">{modelStatus}</span>
                </div>
              </div>
              {flaskError && (
                <p className="text-xs text-red-600 mt-2">{flaskError}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                Select Schedule
              </label>
              <select
                value={selectedSchedule}
                onChange={(e) => {
                  setSelectedSchedule(e.target.value);
                  loadScheduleData(e.target.value);
                }}
                disabled={isMonitoring}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">Select Schedule</option>
                {schedules.map((schedule) => (
                  <option key={schedule._id} value={schedule._id}>
                    {schedule.mata_kuliah} - {schedule.kelas} (Meeting {schedule.pertemuan_ke})
                  </option>
                ))}
                </select>
                <button
                  type="button"
                  onClick={getCameraDevices}
                  disabled={isMonitoring}
                  className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm flex items-center justify-center"
                  title="Refresh camera list"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              {cameras.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No cameras detected. Please check your camera permissions.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <BookOpen className="h-4 w-4 mr-2" />
                Session Name
              </label>
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                disabled={isMonitoring}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter session name"
              />
            </div>

            {/* YOLO Model selection removed - now using model_1.py and model_2.py directly */}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Brain className="h-4 w-4 mr-2" />
                Detection Model Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setModelType('model_1')}
                  disabled={isMonitoring || modelStatus === 'loading'}
                  className={`py-2 px-3 text-sm font-medium rounded-md ${detectionModelType === 'model_1' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} ${(isMonitoring || modelStatus === 'loading') ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {modelStatus === 'loading' && detectionModelType === 'model_1' ? (
                    <span className="flex items-center justify-center">
                      <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-1"></span>
                      Loading...
                    </span>
                  ) : (
                    <>
                      Model 1
                      <div className="text-xs mt-1 opacity-80">(Tidur, Main HP)</div>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setModelType('model_2')}
                  disabled={isMonitoring || modelStatus === 'loading'}
                  className={`py-2 px-3 text-sm font-medium rounded-md ${detectionModelType === 'model_2' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} ${(isMonitoring || modelStatus === 'loading') ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {modelStatus === 'loading' && detectionModelType === 'model_2' ? (
                    <span className="flex items-center justify-center">
                      <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-1"></span>
                      Loading...
                    </span>
                  ) : (
                    <>
                      Model 2
                      <div className="text-xs mt-1 opacity-80">(Nguap, Balik Badan)</div>
                    </>
                  )}
                </button>
              </div>
              {flaskError && detectionModelType && (
                <p className="text-xs text-red-600 mt-2">Error with {detectionModelType}: {flaskError}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Camera className="h-4 w-4 mr-2" />
                Camera Device
              </label>
              <div className="flex space-x-2">
                <select
                  value={selectedCamera}
                  onChange={(e) => setSelectedCamera(e.target.value)}
                  disabled={isMonitoring}
                  className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="">Select Camera</option>
                  {cameras.map((camera) => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Target className="h-4 w-4 mr-2" />
                Focus Target Rate (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={targetFocusRate}
                onChange={(e) => setTargetFocusRate(parseInt(e.target.value))}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Grid3X3 className="h-4 w-4 mr-2" />
                Grid Size
              </label>
              <select
                value={gridSize}
                onChange={(e) => setGridSize(parseInt(e.target.value))}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="small">Small (2x2)</option>
                <option value="medium">Medium (3x3)</option>
                <option value="large">Large (4x4)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Users className="h-4 w-4 mr-2" />
                Total Seats
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={totalSeats}
                onChange={(e) => setTotalSeats(parseInt(e.target.value))}
                disabled={isMonitoring}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-4">
              {!cameraStream ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={startCamera}
                  className="w-full flex items-center justify-center px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Start Camera
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={stopCamera}
                  disabled={isMonitoring}
                  className="w-full flex items-center justify-center px-4 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop Camera
                </motion.button>
              )}

              {isLabellingMode && (
                <>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={generateGridSeats}
                    className="w-full flex items-center justify-center px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-medium"
                  >
                    <Grid3X3 className="h-4 w-4 mr-2" />
                    Generate Grid
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={clearAllSeats}
                    className="w-full flex items-center justify-center px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg font-medium"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Seats
                  </motion.button>
                </>
              )}

              {!isMonitoring ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={startMonitoring}
                  disabled={!selectedSchedule || seatPositions.length === 0}
                  className="w-full flex items-center justify-center px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Monitoring
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={stopMonitoring}
                  className="w-full flex items-center justify-center px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg font-medium"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop & Export
                </motion.button>
              )}
              
              {currentSession && (
                <>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={saveSessionData}
                    className="w-full flex items-center justify-center px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Session
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={downloadSessionData}
                    className="w-full flex items-center justify-center px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-medium"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Data
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
toast('Upload feature will be available soon', {
  icon: 'ℹ️',
  duration: 3000
});
                    }}
                    className="w-full flex items-center justify-center px-4 py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg font-medium"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Previous Data
                  </motion.button>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Camera Feed */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Eye className="h-5 w-5 mr-2" />
            Camera Feed & AI Detection
          </h3>
          
          <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
            <video
              ref={videoRef}
              autoPlay
              muted
              className="w-full h-full object-cover"
              style={{ display: cameraStream ? 'block' : 'none' }}
            />
            
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              style={{ 
                display: cameraStream ? 'block' : 'none',
                cursor: isLabellingMode ? 'crosshair' : 'default',
                backgroundColor: 'transparent',
                touchAction: 'none' // Prevent scrolling while drawing
              }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp} // Cancel drawing if mouse leaves canvas
            />
            
            {!cameraStream && (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <Camera className="h-12 w-12 mx-auto mb-2" />
                  <p>Camera not active</p>
                  <p className="text-sm">Start camera to begin</p>
                </div>
              </div>
            )}

            {isMonitoring && (
              <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                AI MONITORING
              </div>
            )}

            {isLabellingMode && (
              <div className="absolute top-4 right-4 bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                LABELLING MODE
              </div>
            )}

            {modelStatus === 'active' && isMonitoring && (
              <div className="absolute bottom-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                YOLO MODEL ACTIVE
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">
              {isLabellingMode ? 'Labelling Instructions:' : 'Monitoring Status:'}
            </h4>
            {isLabellingMode ? (
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Click and drag to create seat bounding boxes</li>
                <li>• Blue: Empty seats, Green: Focused, Orange: Not focused, Red: No face detected</li>
                <li>• Seats defined: {seatPositions.length}/{totalSeats}</li>
              </ul>
            ) : (
              <div className="text-sm text-blue-700 space-y-1">
                <p>• AI detection active within seat boundaries</p>
                <p>• Gesture recognition: {detectionModelType === 'model_1' ? 'normal, tidur, main hp' : 'normal, nguap, balik badan'}</p>
                <p>• Real-time statistics updated every 2 seconds</p>
                <p>• Model Type: {detectionModelType}</p>
                <p>• Detection Type: {detectionModelType === 'model_1' ? 'Model 1 (Tidur, Main HP)' : 'Model 2 (Nguap, Balik Badan)'}</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Statistics Panel */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          {/* Current Stats */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Live Statistics
            </h3>
            
            {latestData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{latestData.totalDetections}</div>
                    <div className="text-sm text-blue-600">Total Detected</div>
                  </div>
                  <div className="bg-gradient-to-r from-green-50 to-green-100 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{latestData.focusPercentage}%</div>
                    <div className="text-sm text-green-600">Focus Rate</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Focused</span>
                    <span className="text-sm font-medium text-green-600">{latestData.focusedCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Not Focused</span>
                    <span className="text-sm font-medium text-red-600">{latestData.notFocusedCount}</span>
                  </div>
                  
                  {detectionModelType === 'model_1' && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Sleeping</span>
                        <span className="text-sm font-medium text-purple-600">{latestData.sleepingCount}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Using Phone</span>
                        <span className="text-sm font-medium text-orange-600">{latestData.phoneUsingCount}</span>
                      </div>
                    </>
                  )}
                  
                  {detectionModelType === 'model_2' && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Yawning</span>
                        <span className="text-sm font-medium text-purple-600">{latestData.yawningCount}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Turning Back</span>
                        <span className="text-sm font-medium text-orange-600">{latestData.writingCount}</span>
                      </div>
                    </>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Average Focus</span>
                    <span className="text-sm font-medium text-blue-600">{averageFocus}%</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <Eye className="h-8 w-8 mx-auto mb-2" />
                <p>No detection data yet</p>
              </div>
            )}
          </div>

          {/* Analytics Panel */}
          {showAnalytics && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Focus Analytics
              </h3>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-gray-500">Target Focus Rate</p>
                  <div className="flex items-end justify-between">
                    <p className="text-2xl font-bold text-blue-600">{targetFocusRate}%</p>
                    <Target className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
                
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-gray-500">Current Focus Rate</p>
                  <div className="flex items-end justify-between">
                    <p className="text-2xl font-bold text-green-600">{averageFocus}%</p>
                    <div className={`${averageFocus >= targetFocusRate ? 'text-green-600' : 'text-red-600'}`}>
                      {averageFocus >= targetFocusRate ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Seat Management */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Seats ({seatPositions.length})
            </h3>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {seatPositions.map((seat) => (
                <div key={seat.seat_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-3 ${
                      seat.gesture_type === 'focused' ? 'bg-green-500' : 
                      seat.face_detected ? 'bg-orange-500' : 
                      seat.is_occupied ? 'bg-red-500' : 'bg-blue-500'
                    }`}></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Seat {seat.seat_id}</p>
                      <p className="text-xs text-gray-500">
                        {seat.gesture_type !== 'unknown' ? seat.gesture_type : 'No detection'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Focus: {Math.round(seat.total_focus_duration / 1000)}s
                      </p>
                    </div>
                  </div>
                  {isLabellingMode && (
                    <button
                      onClick={() => setSeatPositions(seatPositions.filter(s => s.seat_id !== seat.seat_id))}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {seatPositions.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">No seats defined</p>
                <p className="text-xs">Enter labelling mode to add seats</p>
              </div>
            )}
          </div>

          {/* Session Info */}
          {currentSession && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200 p-6"
            >
              <h3 className="text-lg font-semibold text-purple-900 mb-4 flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Session Info
              </h3>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-purple-700">Session:</span>
                  <span className="font-medium text-purple-900">{sessionName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-700">Started:</span>
                  <span className="font-medium text-purple-900">
                    {new Date(currentSession.startTime).toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-700">Average Focus:</span>
                  <span className="font-medium text-purple-900">{averageFocus}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-700">Model:</span>
                  <span className="font-medium text-purple-900">
                    {detectionModelType}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Charts */}
      <AnimatePresence>
        {detectionData.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Focus Trend */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Focus Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={detectionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="focusPercentage" 
                    stroke="#3B82F6" 
                    strokeWidth={3}
                    dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Activity Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Activity Distribution</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-gray-500">
                  <div className="text-center">
                    <EyeOff className="h-8 w-8 mx-auto mb-2" />
                    <p>No activity data</p>
                  </div>
                </div>
              )}
              
              {pieData.length > 0 && (
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  {pieData.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: entry.color }}
                      ></div>
                      <span className="text-sm text-gray-600">{entry.name}: {entry.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}