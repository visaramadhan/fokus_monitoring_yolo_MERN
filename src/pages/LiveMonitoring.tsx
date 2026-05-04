import { useState, useEffect, useRef, Fragment } from 'react';
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
import { useAuth } from '../contexts/AuthContext';
import { useStatusModal } from '../contexts/StatusModalContext';

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
  label_counts?: Record<string, number>;
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

interface MataKuliah {
  _id: string;
  nama: string;
  kode: string;
  kelas: string[];
}

interface UserOption {
  _id: string;
  role: string;
  nama_lengkap?: string;
  username?: string;
}

interface ModelFile {
  name: string;
  path: string;
  size: number;
  uploadedAt: string;
}

interface YoloDetection {
  class_name: string;
  confidence: number;
  bbox: { x1: number; y1: number; x2: number; y2: number };
}

interface DetectionRecord {
  id: string;
  timestamp: string;
  elapsedTime: string;
  totalDetections: number;
  focusedCount: number;
  notFocusedCount: number;
  yawningCount: number;
  chattingCount: number;
  focusPercentage: number;
  summary: string;
}

export default function LiveMonitoring() {
  const { user } = useAuth();
  const { showSuccess, showError } = useStatusModal();
  
  // Session Management
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentSession, setCurrentSession] = useState<LiveSession | null>(null);
  const [detectionData, setDetectionData] = useState<DetectionData[]>([]);
  const [detectionRecords, setDetectionRecords] = useState<DetectionRecord[]>([]);
  
  // Configuration
  const [selectedSchedule, setSelectedSchedule] = useState('');
  const [activeSchedule, setActiveSchedule] = useState<Schedule | null>(null);
  const [selectedDosenId, setSelectedDosenId] = useState('');
  const [dosenOptions, setDosenOptions] = useState<UserOption[]>([]);
  const [subjects, setSubjects] = useState<MataKuliah[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedClassName, setSelectedClassName] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showCameraSettings, setShowCameraSettings] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [targetFocusRate, setTargetFocusRate] = useState(80); // Target focus rate in percentage
  const [gridSize, setGridSize] = useState<'small' | 'medium' | 'large'>('medium'); // Grid size for seat layout
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
  const [annotatedImage, setAnnotatedImage] = useState<string>('');
  const [yoloDetections, setYoloDetections] = useState<YoloDetection[]>([]);
  const [modelInfo, setModelInfo] = useState<{ names: Record<string, string>; num_classes: number } | null>(null);
  const [detectionConf, setDetectionConf] = useState(0.5);
  const [detectionWidth, setDetectionWidth] = useState(640);
  const [detectionJpegQuality, setDetectionJpegQuality] = useState(0.72);
  const [recordIntervalSec, setRecordIntervalSec] = useState(3);
  const [lastInferenceMs, setLastInferenceMs] = useState<number | null>(null);
  const [isTestingDetection, setIsTestingDetection] = useState(false);

  const selectedSubject = subjects.find((s) => s._id === selectedSubjectId) || null;
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectionIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingRef = useRef(false);
  const lastBackendSaveAtRef = useRef(0);
  const sessionStartedAtRef = useRef<number | null>(null);
  const lastRecordAtRef = useRef(0);
  const isMonitoringRef = useRef(false);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastCaptureDimsRef = useRef<{ width: number; height: number } | null>(null);
  const detectionMemoryRef = useRef<Map<string, { det: YoloDetection; lastSeen: number }>>(new Map());
  const requestDrawRef = useRef<number | null>(null);

  const todayStr = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const isToday = (dateValue: any) => {
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  };

  const formatElapsed = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    isMonitoringRef.current = isMonitoring;
  }, [isMonitoring]);

  useEffect(() => {
    getCameraDevices();
    fetchModels();
    checkFlaskStatus();
    
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      if (detectionIntervalRef.current) {
        clearTimeout(detectionIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const fetchDosen = async () => {
      if (user?.role !== 'admin') return;
      try {
        const res = await axios.get('/api/users');
        const dosen = (res.data || []).filter((u: UserOption) => u.role === 'dosen');
        setDosenOptions(dosen);
      } catch (error) {
        showError('Gagal', 'Gagal memuat data dosen.');
      }
    };
    fetchDosen();
  }, [user?.role]);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        setLoadingSubjects(true);
        if (user?.role === 'admin' && !selectedDosenId) {
          setSubjects([]);
          setSelectedSubjectId('');
          setSelectedClassName('');
          setSelectedSchedule('');
          return;
        }
        const params: any = {};
        if (user?.role === 'admin' && selectedDosenId) {
          params.dosen_id = selectedDosenId;
        }
        const res = await axios.get('/api/mata-kuliah', { params });
        setSubjects(res.data || []);
      } catch (error) {
        showError('Gagal', 'Gagal mengambil data mata kuliah.');
      } finally {
        setLoadingSubjects(false);
      }
    };
    if (user?.role) {
      fetchSubjects();
    }
  }, [user?.role, selectedDosenId]);

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
      showError('Gagal', 'Gagal mengambil daftar kamera.');
      console.error('Camera enumeration error:', error);
    }
  };

  const fetchSchedules = async () => {
    try {
      if (user?.role === 'admin' && !selectedDosenId) {
        setSchedules([]);
        return;
      }
      if (!selectedSubjectId || !selectedClassName) {
        setSchedules([]);
        return;
      }
      const params: any = {
        status: 'available',
        date: todayStr(),
        mata_kuliah_id: selectedSubjectId,
        kelas: selectedClassName
      };
      if (user?.role === 'admin' && selectedDosenId) {
        params.dosen_id = selectedDosenId;
      }
      const response = await axios.get('/api/jadwal', { params });
      setSchedules(response.data || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      showError('Gagal', 'Gagal mengambil data schedule.');
    }
  };

  useEffect(() => {
    if (user?.role) {
      fetchSchedules();
    }
  }, [user?.role, selectedDosenId, selectedSubjectId, selectedClassName]);

  const fetchModels = async () => {
    try {
      const response = await axios.get('/api/models/list');
      setModels(response.data);
      // No need to set selectedModel as we're using detection_model_type instead
    } catch (error) {
      console.error('Error fetching models:', error);
      showError('Gagal', 'Gagal mengambil daftar model.');
    }
  };

  const checkFlaskStatus = async () => {
    try {
      await axios.get('/flask/health', { timeout: 5000 });
      setFlaskStatus('connected');
      setFlaskError('');

      setModelStatus('loading');
      try {
        const infoResponse = await axios.get('/flask/api/model-info');
        if (infoResponse.data?.success) {
          setModelInfo({
            names: infoResponse.data.names || {},
            num_classes: infoResponse.data.num_classes || 0
          });
          setModelStatus('active');
          setFlaskError('');
        } else {
          setModelStatus('inactive');
          setFlaskError(infoResponse.data?.message || 'Model info not available');
        }
      } catch (infoError: any) {
        setModelStatus('inactive');
        const msg = infoError?.response?.data?.message || infoError?.message || 'Failed to get model info';
        setFlaskError(msg);
        console.error('Error getting model info:', infoError);
      }
    } catch (error) {
      setFlaskStatus('error');
      setFlaskError('Flask server not responding. Please ensure Flask server is running on port 5001.');
      console.error('Flask status check failed:', error);
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
        await videoRef.current.play().catch(() => {});
        requestAnimationFrame(() => {
          syncCanvasSize();
        });
      }
      showSuccess('Berhasil', 'Kamera berhasil dimulai.');
    } catch (error) {
      showError('Gagal', 'Gagal memulai kamera.');
      console.error('Camera start error:', error);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    showSuccess('Berhasil', 'Kamera dihentikan.');
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

    const width = Math.abs(currentSeat.width || 0);
    const height = Math.abs(currentSeat.height || 0);
    if (width < 1 || height < 1) {
      setIsDrawing(false);
      setCurrentSeat(null);
      drawCanvas();
      return;
    }

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
      student_id: null,
      face_detected: false,
      gesture_type: 'unknown',
      confidence: 0,
      focus_start_time: null,
      total_focus_duration: 0,
      attendance_time: null,
      departure_time: null
    };

    setSeatPositions([...seatPositions, newSeat]);
    showSuccess('Berhasil', `Seat ${newSeat.seat_id} ditambahkan.`);

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
      showError('Tidak Bisa', 'Mulai kamera terlebih dahulu.');
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
    showSuccess('Berhasil', `Berhasil generate ${newSeats.length} seat (${rows}x${cols}).`);
    
    // Force redraw canvas to show the grid
    requestDraw();
    
    // If we're in monitoring mode, start detection
    if (isMonitoring && !isLabellingMode && currentSession?.sessionId) {
      startFlaskDetection(currentSession.sessionId);
    }
  };

  const clearAllSeats = () => {
    setSeatPositions([]);
    showSuccess('Berhasil', 'Semua seat berhasil dihapus.');
  };

  // Canvas Drawing
  const requestDraw = () => {
    if (requestDrawRef.current !== null) return;
    requestDrawRef.current = requestAnimationFrame(() => {
      requestDrawRef.current = null;
      drawCanvas();
    });
  };

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
      
      if (seat.face_detected && (seat.gesture_type === 'focused' || seat.gesture_type === 'memperhatikan')) {
        strokeColor = '#10B981'; // Green for focused
        fillColor = 'rgba(16, 185, 129, 0.3)';
      } else if (seat.face_detected && seat.gesture_type !== 'focused' && seat.gesture_type !== 'memperhatikan') {
        strokeColor = '#F59E0B'; // Orange for detected but not focused
        fillColor = 'rgba(245, 158, 11, 0.3)';
      } else if (seat.is_occupied) {
        strokeColor = '#EF4444'; // Red for occupied but no face
        fillColor = 'rgba(239, 68, 68, 0.3)';
      }

      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = fillColor;
      ctx.lineWidth = 2;
      ctx.fillRect(seat.x, seat.y, seat.width, seat.height);
      ctx.strokeRect(seat.x, seat.y, seat.width, seat.height);
      
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

    if (isMonitoring && yoloDetections.length > 0) {
      for (const det of yoloDetections) {
        const label = String(det.class_name || '');
        const norm = label.trim().toLowerCase();
        const color =
          norm === 'memperhatikan' || norm === 'focused'
            ? '#22c55e'
            : norm === 'nguap' || norm === 'yawning'
              ? '#f59e0b'
              : norm === 'balikbadan' || norm === 'looking_away' || norm === 'chatting'
                ? '#ef4444'
                : '#3b82f6';

        const x1 = det.bbox.x1;
        const y1 = det.bbox.y1;
        const w = det.bbox.x2 - det.bbox.x1;
        const h = det.bbox.y2 - det.bbox.y1;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x1, y1, w, h);

        const pct = Math.round((det.confidence || 0) * 100);
        const text = `${label} ${pct}%`;
        ctx.font = 'bold 13px Arial';
        const tw = ctx.measureText(text).width;
        ctx.fillStyle = color;
        ctx.fillRect(x1, y1 - 20, tw + 8, 20);
        ctx.fillStyle = '#000000';
        ctx.fillText(text, x1 + 4, y1 - 5);
      }
    }

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
      canvas.style.pointerEvents = isLabellingMode || isDrawing ? 'auto' : 'none';
      
      requestDraw();
    }
  };

  useEffect(() => {
    if (cameraStream) {
      syncCanvasSize();
    }
  }, [cameraStream]);

  useEffect(() => {
    if (cameraStream) {
      requestDraw();
    }
  }, [cameraStream, seatPositions, currentSeat, isDrawing, isLabellingMode, isMonitoring, yoloDetections]);
  
  // Add effect to handle window resize for responsive canvas
  useEffect(() => {
    window.addEventListener('resize', syncCanvasSize);
    return () => window.removeEventListener('resize', syncCanvasSize);
  }, []);

  // Monitoring Functions
  const startMonitoring = async () => {
    if (!selectedSchedule) {
      showError('Tidak Bisa Mulai', 'Pilih schedule terlebih dahulu.');
      return;
    }

    try {
      if (!cameraStream) {
        await startCamera();
      }

      const schedule = schedules.find(s => s._id === selectedSchedule);
      if (!schedule) {
        showError('Tidak Bisa Mulai', 'Schedule tidak ditemukan.');
        return;
      }
      setActiveSchedule(schedule);
      if (!isToday(schedule.tanggal)) {
        showError('Tidak Bisa Mulai', 'Schedule hanya bisa dilakukan pada tanggal yang dijadwalkan.');
        return;
      }
      if (user?.role === 'admin' && !selectedDosenId) {
        showError('Tidak Bisa Mulai', 'Pilih dosen pengampu terlebih dahulu.');
        return;
      }

      await axios.put(`/api/jadwal/${selectedSchedule}`, { status: 'ongoing' });
      await fetchSchedules();

      const toId = (value: any) => (typeof value === 'string' ? value : value?._id);

      const response = await axios.post('/api/live-monitoring/start', {
        kelas: schedule.kelas,
        mata_kuliah_id: toId(schedule.mata_kuliah_id) || schedule.mata_kuliah_id,
        mata_kuliah: schedule.mata_kuliah,
        sessionName: sessionName || `${schedule.mata_kuliah} - ${schedule.kelas}`,
        ...(user?.role === 'admin' ? { dosen_id: selectedDosenId } : {})
      });

      setCurrentSession(response.data);
      setIsMonitoring(true);
      setIsLabellingMode(false);
      setDetectionData([]);
      setDetectionRecords([]);
      setAnnotatedImage('');
      setYoloDetections([]);
      detectionMemoryRef.current.clear();
      sessionStartedAtRef.current = Date.now();
      lastRecordAtRef.current = 0;
      showSuccess('Berhasil', 'Live monitoring dimulai.');

      // Start face detection with Flask
      startFlaskDetection(response.data.sessionId);
    } catch (error) {
      showError('Gagal Memulai', 'Gagal memulai live monitoring.');
      console.error('Start monitoring error:', error);
    }
  };

  const stopMonitoring = async () => {
    if (!currentSession) return;

    try {
      setIsMonitoring(false);
      isMonitoringRef.current = false;
      if (detectionIntervalRef.current) {
        clearTimeout(detectionIntervalRef.current);
      }

      await axios.post(`/api/live-monitoring/stop/${currentSession.sessionId}`);
      
      // Export data automatically
      const exported = await exportSessionData();
      
      setIsMonitoring(false);
      setCurrentSession(null);
      setActiveSchedule(null);
      setDetectionData([]);
      setDetectionRecords([]);
      sessionStartedAtRef.current = null;
      lastRecordAtRef.current = 0;
      setModelStatus('inactive');
      setAnnotatedImage('');
      setYoloDetections([]);
      detectionMemoryRef.current.clear();
      
      // Reset seat focus data
      setSeatPositions(prev => prev.map(seat => ({
        ...seat,
        face_detected: false,
        gesture_type: 'unknown',
        confidence: 0,
        focus_start_time: null,
        total_focus_duration: 0
      })));
      
      if (exported) {
        showSuccess('Berhasil', 'Live monitoring berhenti dan data berhasil diexport.');
      } else {
        showError('Export Gagal', 'Live monitoring berhenti, tetapi export gagal. Coba export ulang dari halaman records.');
      }
    } catch (error) {
      showError('Gagal Menghentikan', 'Gagal menghentikan live monitoring.');
      console.error('Stop monitoring error:', error);
    }
  };

  const startFlaskDetection = (sessionId: string) => {
    if (!sessionId) {
      console.error('Session ID is required for detection');
      showError('Deteksi Tidak Bisa Dimulai', 'Session ID kosong.');
      return;
    }
    
    // Clear any existing interval first
    if (detectionIntervalRef.current) {
      clearTimeout(detectionIntervalRef.current);
    }
    
    // Run detection once immediately when monitoring starts
    runDetection(sessionId);
    
    const intervalMs = 250;
    const tick = async () => {
      if (!isMonitoringRef.current) return;
      await runDetection(sessionId);
      if (!isMonitoringRef.current) return;
      detectionIntervalRef.current = setTimeout(tick, intervalMs);
    };
    detectionIntervalRef.current = setTimeout(tick, intervalMs);
    
    console.log(`Detection started for session: ${sessionId}`);
  };

  useEffect(() => {
    if (isMonitoring && currentSession?.sessionId) {
      startFlaskDetection(currentSession.sessionId);
    }
  }, [isMonitoring, currentSession?.sessionId]);
  
  const captureFrameDataUrl = async (opts?: { targetWidth?: number; targetHeight?: number; quality?: number }) => {
    const video = videoRef.current;
    if (!video) return null;

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    if (!videoWidth || !videoHeight) return null;

    const canvas = captureCanvasRef.current || document.createElement('canvas');
    captureCanvasRef.current = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const quality = Math.max(0.1, Math.min(0.95, opts?.quality ?? detectionJpegQuality));
    const targetWidth = Math.max(320, Math.min(1920, Math.floor(opts?.targetWidth ?? detectionWidth)));
    const targetHeight = Math.max(
      1,
      Math.floor(
        opts?.targetHeight ??
          Math.round(videoHeight * (targetWidth / videoWidth))
      )
    );

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    lastCaptureDimsRef.current = { width: targetWidth, height: targetHeight };
    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
    });
    if (!blob) return null;

    const frameData: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read frame blob'));
      reader.readAsDataURL(blob);
    });
    if (!frameData || frameData === 'data:,') return null;
    return frameData;
  };

  const testDetectionOnce = async () => {
    if (isTestingDetection) return;
    setIsTestingDetection(true);
    try {
      if (!cameraStream) {
        await startCamera();
      }
      const frameData = await captureFrameDataUrl({ targetWidth: detectionWidth, quality: detectionJpegQuality });
      if (!frameData) {
        showError('Tidak Bisa', 'Kamera belum siap. Tunggu 1-2 detik lalu coba lagi.');
        return;
      }

      const startTime = Date.now();
      const response = await axios.post('/flask/api/detect/frame', {
        image_base64: frameData,
        conf: detectionConf,
        imgsz: detectionWidth,
        include_annotated: true
      });

      if (!response.data?.success) {
        const msg = response.data?.message || 'Unknown error';
        setModelStatus('error');
        setFlaskError(msg);
        showError('Gagal', msg);
        return;
      }

      const detections: YoloDetection[] = Array.isArray(response.data.detections) ? response.data.detections : [];
      setYoloDetections(detections);
      if (typeof response.data.annotated_image === 'string') {
        setAnnotatedImage(response.data.annotated_image);
      }
      setModelStatus('active');
      setFlaskError('');
      setLastInferenceMs(Date.now() - startTime);
      showSuccess('Berhasil', `Detections: ${detections.length}`);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      setModelStatus('error');
      setFlaskError(errorMessage);
      showError('Gagal', errorMessage);
    } finally {
      setIsTestingDetection(false);
    }
  };

  // Separate function to run detection for better organization
  const runDetection = async (sessionId: string) => {
    if (!sessionId) {
      console.error('Session ID is required for detection');
      return;
    }
    
    if (!isMonitoringRef.current || !videoRef.current) return;

    try {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      const normalizeLabel = (value: unknown) => String(value ?? '').trim().toLowerCase();

      const frameData = await captureFrameDataUrl({ targetWidth: detectionWidth, quality: detectionJpegQuality });
      if (!frameData) return;

      const startTime = Date.now();
      const response = await axios.post('/flask/api/detect/frame', {
        image_base64: frameData,
        conf: detectionConf,
        imgsz: detectionWidth,
        include_annotated: false
      });

      if (!response.data?.success) {
        const msg = response.data?.message || 'Unknown error';
        setModelStatus('error');
        setFlaskError(msg);
        console.error('Detection failed:', msg);
        return;
      }

      const rawDetections: YoloDetection[] = Array.isArray(response.data.detections) ? response.data.detections : [];

      const nowMs = Date.now();
      const memory = detectionMemoryRef.current;
      const keyForDet = (d: YoloDetection) => {
        const q = (n: number, step: number) => Math.round(n / step) * step;
        const b = d.bbox;
        const x = q(b.x1, 24);
        const y = q(b.y1, 24);
        const w = q(b.x2 - b.x1, 24);
        const h = q(b.y2 - b.y1, 24);
        return `${normalizeLabel(d.class_name)}:${x}:${y}:${w}:${h}`;
      };

      for (const det of rawDetections) {
        memory.set(keyForDet(det), { det, lastSeen: nowMs });
      }

      for (const [key, value] of memory.entries()) {
        if (nowMs - value.lastSeen > 500) {
          memory.delete(key);
        }
      }

      const smoothedDetections = Array.from(memory.values()).map(v => v.det);
      setYoloDetections(smoothedDetections);

      const overlayCanvas = canvasRef.current;
      const captureDims = lastCaptureDimsRef.current;
      const scaleX = overlayCanvas && captureDims?.width ? overlayCanvas.width / captureDims.width : 1;
      const scaleY = overlayCanvas && captureDims?.height ? overlayCanvas.height / captureDims.height : 1;

      const scaledDetections = smoothedDetections.map(d => ({
        ...d,
        bbox: {
          x1: d.bbox.x1 * scaleX,
          y1: d.bbox.y1 * scaleY,
          x2: d.bbox.x2 * scaleX,
          y2: d.bbox.y2 * scaleY
        }
      }));

      const modelLabelSet = new Set(Object.values(modelInfo?.names ?? {}).map(normalizeLabel));
      const behaviorLabels = [
        'memperhatikan',
        'focused',
        'nguap',
        'yawning',
        'balikbadan',
        'looking_away',
        'chatting',
        'sleeping',
        'using_phone',
        'writing'
      ];
      const hasBehaviorLabels = behaviorLabels.some(l => modelLabelSet.has(l));
      const usePersonOnly = !hasBehaviorLabels && modelLabelSet.has('person');
      const candidateDetections = usePersonOnly
        ? scaledDetections.filter(d => normalizeLabel(d.class_name) === 'person')
        : scaledDetections;

      const focusedLabels = new Set(
        ['memperhatikan', 'focused'].some(l => modelLabelSet.has(l)) ? ['memperhatikan', 'focused'] : modelLabelSet.has('person') ? ['person'] : ['memperhatikan', 'focused']
      );
      const yawningLabels = new Set(['nguap', 'yawning']);
      const lookingAwayLabels = new Set(['balikbadan', 'looking_away', 'chatting']);

      let seatSnapshot: SeatPosition[] = [];
      setSeatPositions(prev => {

        const iou = (a: { x1: number; y1: number; x2: number; y2: number }, b: { x1: number; y1: number; x2: number; y2: number }) => {
          const xA = Math.max(a.x1, b.x1);
          const yA = Math.max(a.y1, b.y1);
          const xB = Math.min(a.x2, b.x2);
          const yB = Math.min(a.y2, b.y2);
          const interW = Math.max(0, xB - xA);
          const interH = Math.max(0, yB - yA);
          const inter = interW * interH;
          const areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
          const areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
          const denom = areaA + areaB - inter;
          return denom > 0 ? inter / denom : 0;
        };

        const closeFocusWindow = (seat: SeatPosition) => {
          if (seat.focus_start_time) {
            return {
              ...seat,
              total_focus_duration: seat.total_focus_duration + Math.max(0, nowMs - seat.focus_start_time),
              focus_start_time: null
            };
          }
          return seat;
        };

        const nextSeats = prev.map(seat => {
          const seatBox = { x1: seat.x, y1: seat.y, x2: seat.x + seat.width, y2: seat.y + seat.height };
          let best: YoloDetection | null = null;
          let bestScore = 0;

          for (const det of candidateDetections) {
            const detBox = det.bbox;
            const score = iou(seatBox, detBox);
            if (score > bestScore) {
              bestScore = score;
              best = det;
            }
          }

          if (!best || bestScore < 0.05) {
            const seatClosed = closeFocusWindow(seat);
            return {
              ...seatClosed,
              face_detected: false,
              is_occupied: false,
              gesture_type: 'unknown',
              confidence: 0,
              departure_time: seat.attendance_time ? seatClosed.departure_time || new Date().toISOString() : seatClosed.departure_time
            };
          }

          const className = String(best.class_name || '').toLowerCase();
          const isFocused = focusedLabels.has(normalizeLabel(className));
          const attendance_time = seat.attendance_time || new Date().toISOString();

          let updated: SeatPosition = {
            ...seat,
            face_detected: true,
            is_occupied: true,
            gesture_type: best.class_name,
            confidence: best.confidence,
            attendance_time,
            departure_time: null
          };

          if (isFocused) {
            if (!updated.focus_start_time) updated.focus_start_time = nowMs;
          } else {
            updated = closeFocusWindow(updated);
          }

          return updated;
        });
        seatSnapshot = nextSeats;
        return nextSeats;
      });

      setModelStatus('active');
      setFlaskError('');
      setLastInferenceMs(Date.now() - startTime);

      const detectionTime = new Date().toLocaleTimeString();
      const totalDetections = smoothedDetections.length;
      const focusedCount = smoothedDetections.filter(d => focusedLabels.has(normalizeLabel(d.class_name))).length;
      const yawningCount = smoothedDetections.filter(d => yawningLabels.has(normalizeLabel(d.class_name))).length;
      const chattingCount = smoothedDetections.filter(d => lookingAwayLabels.has(normalizeLabel(d.class_name))).length;
      const notFocusedCount = Math.max(0, totalDetections - focusedCount);
      const focusPercentage = totalDetections > 0 ? Math.round((focusedCount / totalDetections) * 100) : 0;
      const label_counts = smoothedDetections.reduce<Record<string, number>>((acc, det) => {
        const key = normalizeLabel(det.class_name);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const now = Date.now();
      const intervalMs = Math.max(1000, Math.round(recordIntervalSec * 1000));
      const shouldRecord = now - lastRecordAtRef.current >= intervalMs;
      if (shouldRecord) {
        lastRecordAtRef.current = now;

        const seatsForRecord = seatSnapshot.length > 0 ? seatSnapshot : seatPositions;
        const newDetectionData: DetectionData = {
          timestamp: detectionTime,
          totalDetections,
          focusedCount,
          notFocusedCount,
          sleepingCount: 0,
          phoneUsingCount: 0,
          chattingCount,
          yawningCount,
          writingCount: 0,
          focusPercentage,
          label_counts,
          seatData: seatsForRecord
        };

        setDetectionData(prev => [...prev.slice(-119), newDetectionData]);

        const startedAt = sessionStartedAtRef.current;
        const elapsedSeconds = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
        const summaryParts = [
          `fokus ${focusedCount}`,
          `tidak ${notFocusedCount}`,
          yawningCount > 0 ? `nguap ${yawningCount}` : null,
          chattingCount > 0 ? `balikbadan ${chattingCount}` : null
        ].filter(Boolean);

        const record: DetectionRecord = {
          id: `${now}-${Math.random().toString(16).slice(2)}`,
          timestamp: detectionTime,
          elapsedTime: formatElapsed(elapsedSeconds),
          totalDetections,
          focusedCount,
          notFocusedCount,
          yawningCount,
          chattingCount,
          focusPercentage,
          summary: summaryParts.join(' • ')
        };

        setDetectionRecords(prev => [record, ...prev].slice(0, 200));

        if (now - lastBackendSaveAtRef.current >= intervalMs && currentSession?.sessionId === sessionId) {
          lastBackendSaveAtRef.current = now;
          const seat_data = seatsForRecord.map(seat => ({
            seat_id: String(seat.seat_id),
            student_id: seat.student_id || null,
            is_focused: focusedLabels.has(normalizeLabel(seat.gesture_type)),
            is_occupied: seat.is_occupied,
            attendance_time: seat.attendance_time,
            departure_time: seat.departure_time
          }));
          try {
            await axios.post(`/api/live-monitoring/detection/${sessionId}`, {
              totalDetections,
              focusedCount,
              notFocusedCount,
              sleepingCount: 0,
              phoneUsingCount: 0,
              chattingCount,
              yawningCount,
              writingCount: 0,
              focusPercentage,
              record_interval_ms: intervalMs,
              total_seats: seatsForRecord.length,
              seat_data
            });
          } catch (error) {
            const err: any = error;
            const status = err?.response?.status;
            const msg = err?.response?.data?.message || err?.message || 'Unknown error';
            console.error('Failed to save detection data to backend:', status ? `[${status}] ${msg}` : msg);
          }
        }
      }
      requestDraw();

    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      console.error('Flask detection error:', errorMessage);
      setFlaskError(errorMessage);
    }
    finally {
      isProcessingRef.current = false;
    }
  };

  const exportSessionData = async () => {
    if (!currentSession) return;

    try {
      const schedule = activeSchedule || schedules.find(s => s._id === selectedSchedule);
      if (!schedule) {
        showError('Export Gagal', 'Schedule belum dipilih. Pilih schedule dulu sebelum export.');
        return null;
      }
      if (!isToday(schedule.tanggal)) {
        showError('Export Gagal', 'Schedule hanya bisa dilakukan pada tanggal yang dijadwalkan.');
        return null;
      }

      const startMs = currentSession.startTime ? new Date(currentSession.startTime).getTime() : sessionStartedAtRef.current || Date.now();
      const sessionDurationMs = Math.max(1, Date.now() - startMs);
      const sessionDurationMin = Math.max(1, Math.round(sessionDurationMs / 60000));
      const averageFocusPct =
        detectionData.length > 0
          ? detectionData.reduce((sum, d) => sum + (Number(d.focusPercentage) || 0), 0) / detectionData.length
          : 0;

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
            (seat.total_focus_duration / sessionDurationMs) * 100 : 0
        }));

      const toId = (value: any) => (typeof value === 'string' ? value : value?._id);
      const mataKuliahId = toId(schedule.mata_kuliah_id) || schedule.mata_kuliah_id;
      const dosenId = toId(schedule.dosen_id) || (user?.role === 'admin' ? selectedDosenId : user?.id);

      const dataFokus = seatPositions.map(seat => {
        const pct = Math.max(0, Math.min(100, seat.total_focus_duration > 0 ? (seat.total_focus_duration / sessionDurationMs) * 100 : 0));
        const persenFokus = Math.round(pct);
        const durasiFokusMin = Math.max(0, Math.round(seat.total_focus_duration / 60000));
        const jumlahSesiFokus = durasiFokusMin;
        let status: 'Baik' | 'Cukup' | 'Kurang' = 'Kurang';
        if (persenFokus >= 80) status = 'Baik';
        else if (persenFokus >= 60) status = 'Cukup';

        return {
          id_siswa: seat.student_id || `S${seat.seat_id}`,
          jumlah_sesi_fokus: jumlahSesiFokus,
          durasi_fokus: durasiFokusMin,
          persen_fokus: persenFokus,
          persen_tidak_fokus: 100 - persenFokus,
          status
        };
      });

      const focusedCount = seatPositions.filter(s => s.total_focus_duration > 0).length;
      const focusPercentage = seatPositions.length > 0 ? Math.round((focusedCount / seatPositions.length) * 100) : 0;

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
          averageFocusTimePct: averageFocusPct,
          sessionDuration: sessionDurationMs
        },
        tanggal: schedule.tanggal,
        jamMulai: schedule.jam_mulai,
        jamSelesai: schedule.jam_selesai,
        durasi: schedule.durasi,
        dosenId: toId(schedule.dosen_id) || schedule.dosen_id
      });

      await axios.post('/api/pertemuan', {
        sessionId: currentSession.sessionId,
        tanggal: schedule.tanggal || new Date(),
        pertemuan_ke: schedule.pertemuan_ke || 1,
        kelas: schedule.kelas,
        mata_kuliah: schedule.mata_kuliah,
        mata_kuliah_id: mataKuliahId,
        dosen_id: dosenId,
        durasi_pertemuan: sessionDurationMin,
        topik: schedule.topik || 'Live Monitoring Session',
        data_fokus: dataFokus,
        hasil_akhir_kelas: {
          fokus: focusPercentage,
          tidak_fokus: 100 - focusPercentage,
          jumlah_hadir: seatPositions.length,
          fokus_count: focusedCount,
          tidak_fokus_count: Math.max(0, seatPositions.length - focusedCount)
        }
      });

      if (selectedSchedule) {
        await axios.put(`/api/jadwal/${selectedSchedule}`, { status: 'completed' });
      }

      showSuccess('Berhasil', 'Session berhasil diexport dan tersimpan.');
      await fetchSchedules();
      setSelectedSchedule('');
      setActiveSchedule(null);
      return response.data;
    } catch (error) {
      console.error('Export error:', error);
      showError('Export Gagal', 'Gagal export session data.');
      return null;
    }
  };
  
  const downloadSessionData = async () => {
    if (!currentSession) {
      showError('Tidak Bisa', 'Tidak ada sesi aktif untuk diunduh.');
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
      
      showSuccess('Berhasil', 'Session berhasil diunduh.');
    } catch (error) {
      console.error('Download error:', error);
      showError('Gagal', 'Gagal mengunduh session data.');
    }
  };
  
  const saveSessionData = async () => {
    if (!currentSession) {
      showError('Gagal Menyimpan', 'Tidak ada sesi aktif untuk disimpan.');
      return;
    }
    
    try {
      // First export the data to ensure it's saved
      const exportedData = await exportSessionData();
      if (!exportedData) return;
      
      // Then save the session state
      await axios.post(`/api/live-monitoring/saveState/${currentSession.sessionId}`, { 
        state: { seatPositions, detectionData } 
      });
      
      showSuccess('Berhasil', 'State sesi berhasil disimpan.');
    } catch (error) {
      console.error('Save error:', error);
      showError('Gagal Menyimpan', 'Gagal menyimpan state sesi.');
    }
  };

  const loadScheduleData = (scheduleId: string) => {
    const schedule = schedules.find(s => s._id === scheduleId);
    if (schedule) {
      setActiveSchedule(schedule);
      const toId = (value: any) => (typeof value === 'string' ? value : value?._id);
      const mkId = toId(schedule.mata_kuliah_id) || schedule.mata_kuliah_id;
      if (mkId && mkId !== selectedSubjectId) setSelectedSubjectId(mkId);
      if (schedule.kelas && schedule.kelas !== selectedClassName) setSelectedClassName(schedule.kelas);
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

          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <div className="font-semibold mb-2">Panduan Penggunaan (Live)</div>
            <div className="space-y-1">
              <div>1) Pilih data: {user?.role === 'admin' ? 'Dosen → Mata Kuliah → Kelas → Jadwal (Hari Ini)' : 'Mata Kuliah → Kelas → Jadwal (Hari Ini)'}</div>
              <div>2) Start Monitoring: sistem mengunci jadwal menjadi Ongoing (jadwal hilang dari list).</div>
              <div>3) (Opsional) Enter Labelling Mode untuk menggambar seat, atau Generate Grid.</div>
              <div>4) Stop & Export: data disimpan + jadwal menjadi Completed (tetap tidak muncul).</div>
            </div>
          </div>
          
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

            {user?.role === 'admin' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <User className="h-4 w-4 mr-2" />
                  Guru/Dosen
                </label>
                <select
                  value={selectedDosenId}
                  onChange={(e) => {
                    setSelectedDosenId(e.target.value);
                    setSelectedSubjectId('');
                    setSelectedClassName('');
                    setSelectedSchedule('');
                    setActiveSchedule(null);
                    setSessionName('');
                    setSeatPositions([]);
                  }}
                  disabled={isMonitoring}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="">Pilih dosen</option>
                  {dosenOptions.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.nama_lengkap || d.username || d._id}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <BookOpen className="h-4 w-4 mr-2" />
                Mata Kuliah
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => {
                  setSelectedSubjectId(e.target.value);
                  setSelectedClassName('');
                  setSelectedSchedule('');
                  setActiveSchedule(null);
                  setSessionName('');
                  setSeatPositions([]);
                }}
                disabled={
                  isMonitoring ||
                  loadingSubjects ||
                  (user?.role === 'admin' && !selectedDosenId)
                }
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">
                  {user?.role === 'admin' && !selectedDosenId
                    ? 'Pilih dosen dulu'
                    : loadingSubjects
                      ? 'Memuat...'
                      : 'Pilih mata kuliah'}
                </option>
                {subjects.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.nama} ({s.kode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Users className="h-4 w-4 mr-2" />
                Kelas
              </label>
              <select
                value={selectedClassName}
                onChange={(e) => {
                  setSelectedClassName(e.target.value);
                  setSelectedSchedule('');
                  setActiveSchedule(null);
                  setSessionName('');
                  setSeatPositions([]);
                }}
                disabled={isMonitoring || !selectedSubjectId}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">
                  {!selectedSubjectId ? 'Pilih mata kuliah dulu' : 'Pilih kelas'}
                </option>
                {(selectedSubject?.kelas || []).map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                Jadwal (Hari Ini)
              </label>
              <select
                value={selectedSchedule}
                onChange={(e) => {
                  setSelectedSchedule(e.target.value);
                  if (!e.target.value) {
                    setActiveSchedule(null);
                    setSessionName('');
                    return;
                  }
                  loadScheduleData(e.target.value);
                }}
                disabled={
                  isMonitoring ||
                  !selectedSubjectId ||
                  !selectedClassName ||
                  (user?.role === 'admin' && !selectedDosenId)
                }
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">
                  {!selectedSubjectId || !selectedClassName
                    ? 'Pilih mata kuliah & kelas dulu'
                    : schedules.length === 0
                      ? 'Tidak ada jadwal hari ini'
                      : 'Pilih jadwal'}
                </option>
                {schedules.map((schedule) => (
                  <option key={schedule._id} value={schedule._id}>
                    {schedule.mata_kuliah} - {schedule.kelas} • {schedule.jam_mulai}-{schedule.jam_selesai} • P{schedule.pertemuan_ke}
                  </option>
                ))}
              </select>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Brain className="h-4 w-4 mr-2" />
                Model Info
              </label>
              <div className="p-3 rounded-md bg-gray-50 border border-gray-200 text-sm text-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Classes</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={checkFlaskStatus}
                      disabled={modelStatus === 'loading'}
                      className="text-blue-600 hover:text-blue-700 font-medium disabled:opacity-60"
                    >
                      Refresh
                    </button>
                    <button
                      type="button"
                      onClick={testDetectionOnce}
                      disabled={isTestingDetection}
                      className="text-blue-600 hover:text-blue-700 font-medium disabled:opacity-60"
                    >
                      Test
                    </button>
                  </div>
                </div>
                {modelInfo?.num_classes ? (
                  <div className="space-y-1">
                    <div className="text-gray-600">{modelInfo.num_classes} class</div>
                    <div className="text-gray-600 break-words">
                      {Object.values(modelInfo.names).join(', ')}
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-600">Belum ada data model-info.</div>
                )}
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Confidence</span>
                    <span className="font-medium">{detectionConf.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.01}
                    max={0.5}
                    step={0.01}
                    value={detectionConf}
                    onChange={(e) => setDetectionConf(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Frame width</span>
                    <span className="font-medium">{detectionWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min={640}
                    max={1920}
                    step={64}
                    value={detectionWidth}
                    onChange={(e) => setDetectionWidth(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span>JPEG quality</span>
                    <span className="font-medium">{detectionJpegQuality.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.4}
                    max={0.95}
                    step={0.05}
                    value={detectionJpegQuality}
                    onChange={(e) => setDetectionJpegQuality(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Record every</span>
                    <span className="font-medium">{recordIntervalSec}s</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={recordIntervalSec}
                    onChange={(e) => setRecordIntervalSec(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
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
                onChange={(e) => setGridSize(e.target.value as 'small' | 'medium' | 'large')}
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
                <Fragment>
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
                </Fragment>
              )}

              {!isMonitoring ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={startMonitoring}
                  disabled={!selectedSchedule}
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
                <Fragment>
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
                </Fragment>
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

            {annotatedImage && (
              <img
                src={annotatedImage}
                alt="Annotated detection"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ pointerEvents: 'none' }}
              />
            )}
            
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              style={{ 
                display: cameraStream ? 'block' : 'none',
                cursor: isLabellingMode ? 'crosshair' : 'default',
                backgroundColor: 'transparent',
                touchAction: 'none',
                pointerEvents: isLabellingMode ? 'auto' : 'none'
              }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
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
                MODEL ACTIVE
              </div>
            )}
          </div>

          {isMonitoring && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">Detections</h4>
                <span className="text-sm text-gray-600">{yoloDetections.length} objects</span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                <span>Last inference</span>
                <span>{lastInferenceMs !== null ? `${lastInferenceMs} ms` : '-'}</span>
              </div>
              {yoloDetections.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {yoloDetections.slice(0, 6).map((d, idx) => (
                    <div key={`${d.class_name}-${idx}`} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{d.class_name}</span>
                      <span className="text-gray-500">{Math.round(d.confidence * 100)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  Tidak ada deteksi. Coba turunkan confidence atau pastikan objek sesuai label model (mis. memperhatikan/nguap/balikbadan).
                </div>
              )}
            </div>
          )}

          {isMonitoring && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">Record Log</h4>
                <span className="text-sm text-gray-600">{detectionRecords.length} records</span>
              </div>
              {detectionRecords.length > 0 ? (
                <div className="space-y-2 max-h-56 overflow-auto">
                  {detectionRecords.slice(0, 20).map((r) => (
                    <div key={r.id} className="flex items-start justify-between text-sm">
                      <div className="text-gray-700">
                        <div className="font-medium">{r.elapsedTime}</div>
                        <div className="text-gray-500">{r.timestamp}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-gray-700">{r.summary}</div>
                        <div className="text-gray-500">{r.focusPercentage}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  Belum ada record. Pastikan monitoring berjalan, atau klik Test lalu tunggu sesuai interval.
                </div>
              )}
            </div>
          )}

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
                <p>• AI detection runs on full frame (webcam)</p>
                <p>• Frame size sent to backend: {detectionWidth}px width (JPEG {detectionJpegQuality.toFixed(2)})</p>
                <p>• Requests throttled (no overlapping inference)</p>
                <p>• Recording interval: {recordIntervalSec}s</p>
                {modelInfo?.num_classes ? (
                  <p>• Classes: {Object.values(modelInfo.names).join(', ')}</p>
                ) : (
                  <p>• Classes: (load model-info to view)</p>
                )}
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

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Yawning</span>
                  <span className="text-sm font-medium text-purple-600">{latestData.yawningCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Balik Badan</span>
                  <span className="text-sm font-medium text-orange-600">{latestData.chattingCount}</span>
                </div>
                  
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
                    {modelInfo?.num_classes ? 'Ultralytics YOLO (.pt)' : 'Not loaded'}
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
