import { useState, useEffect, useRef } from 'react';
import { Play, Square, Download, Users, BookOpen, User, Calendar, Eye, Camera } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useStatusModal } from '../contexts/StatusModalContext';

interface UserOption {
  _id: string;
  role: string;
  nama_lengkap?: string;
  username?: string;
}

interface MataKuliah {
  _id: string;
  nama: string;
  kode: string;
  kelas: string[];
}

interface Schedule {
  _id: string;
  kelas: string;
  mata_kuliah: string;
  dosen_name: string;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  pertemuan_ke: number;
  topik: string;
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
}

interface RecordEventRow {
  timestamp: string;
  id: string;
  label: string;
  status: string;
  confidence: number;
}

interface CameraDevice {
  deviceId: string;
  label: string;
}

interface AnalyzeMetrics {
  status: string;
  people_count?: number;
  focused_count?: number;
  not_focused_count?: number;
  people?: Array<{
    id?: string;
    label?: string;
    status?: string;
    confidence?: number;
  }>;
}

interface RecordSummaryRow {
  id: string;
  label: string;
  focused: number;
  notFocused: number;
  total: number;
  firstSeen: string;
  lastSeen: string;
}

export default function LiveMonitoring() {
  const { user } = useAuth();
  const { showSuccess, showError } = useStatusModal();

  // Selection states
  const [selectedDosenId, setSelectedDosenId] = useState<string>('');
  const [dosenOptions, setDosenOptions] = useState<UserOption[]>([]);
  const [selectedKelas, setSelectedKelas] = useState<string>('');
  const [availableKelas, setAvailableKelas] = useState<string[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [activeSchedule, setActiveSchedule] = useState<Schedule | null>(null);

  // Monitoring states
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);
  const [recordStatusText, setRecordStatusText] = useState<string>('');
  const [recordEvents, setRecordEvents] = useState<RecordEventRow[]>([]);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [annotatedImage, setAnnotatedImage] = useState<string>('');
  const [analyzeMetrics, setAnalyzeMetrics] = useState<AnalyzeMetrics | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [recordSummary, setRecordSummary] = useState<RecordSummaryRow[]>([]);
  const [lastMonitoringReport, setLastMonitoringReport] = useState<{
    status: string;
    events: RecordEventRow[];
    summary: RecordSummaryRow[];
    schedule: Schedule | null;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyzeIntervalRef = useRef<number | null>(null);
  const isAnalyzingRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  const formatNow = () => {
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  };

  const mapEventRows = (rows: any[]): RecordEventRow[] =>
    rows.map((row: any) => ({
      timestamp: String(row?.[0] ?? ''),
      id: String(row?.[1] ?? ''),
      label: String(row?.[2] ?? ''),
      status: String(row?.[3] ?? ''),
      confidence: Number(row?.[4] ?? 0),
    }));

  const mapSummaryRows = (rows: any[]): RecordSummaryRow[] =>
    rows.map((row: any) => ({
      id: String(row?.[0] ?? ''),
      label: String(row?.[1] ?? ''),
      focused: Number(row?.[2] ?? 0),
      notFocused: Number(row?.[3] ?? 0),
      total: Number(row?.[4] ?? 0),
      firstSeen: String(row?.[5] ?? ''),
      lastSeen: String(row?.[6] ?? ''),
    }));

  const parseDownloadFilename = (contentDisposition?: string) => {
    if (!contentDisposition) return null;
    const utfMatch = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
    if (utfMatch?.[1]) {
      return decodeURIComponent(utfMatch[1]);
    }
    const basicMatch = contentDisposition.match(/filename\s*=\s*"([^"]+)"/i) || contentDisposition.match(/filename\s*=\s*([^;]+)/i);
    if (basicMatch?.[1]) {
      return basicMatch[1].trim();
    }
    return null;
  };

  const toDateOnly = (value: string | Date) => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const formatScheduleDate = (value: string) =>
    new Date(value).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

  const toMinutes = (time: string) => {
    const [hours = '0', minutes = '0'] = String(time || '').split(':');
    return Number(hours) * 60 + Number(minutes);
  };

  const getSchedulePresentation = (schedule: Schedule) => {
    const today = toDateOnly(new Date());
    const scheduleDate = toDateOnly(schedule.tanggal);
    const isPast = scheduleDate.getTime() < today.getTime();
    const isFuture = scheduleDate.getTime() > today.getTime();

    if (schedule.status === 'cancelled') {
      return {
        label: 'Cancelled',
        canSelect: false,
        badgeClass: 'bg-red-100 text-red-700',
        cardClass: 'border-red-100 bg-red-50 opacity-75 cursor-not-allowed',
      };
    }

    if (schedule.status === 'completed' || isPast) {
      return {
        label: 'Done',
        canSelect: false,
        badgeClass: 'bg-emerald-100 text-emerald-700',
        cardClass: 'border-emerald-100 bg-emerald-50 opacity-80 cursor-not-allowed',
      };
    }

    if (isFuture) {
      return {
        label: 'Upcoming',
        canSelect: false,
        badgeClass: 'bg-slate-100 text-slate-600',
        cardClass: 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed',
      };
    }

    if (schedule.status === 'ongoing') {
      return {
        label: 'Ongoing',
        canSelect: true,
        badgeClass: 'bg-amber-100 text-amber-700',
        cardClass: 'border-amber-200 bg-amber-50',
      };
    }

    return {
      label: 'Scheduled',
      canSelect: true,
      badgeClass: 'bg-blue-100 text-blue-700',
      cardClass: 'border-blue-200 bg-blue-50',
    };
  };

  // Fetch initial data
  useEffect(() => {
    if (user?.role === 'admin') {
      fetchDosen();
    } else {
      if (user) {
        setSelectedDosenId(user.id);
      }
    }
  }, [user?.role, user?.id]);

  useEffect(() => {
    void loadCameras();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if ((user?.role === 'admin' && selectedDosenId) || user?.role === 'dosen') {
      fetchAvailableKelas();
    } else if (user?.role === 'admin') {
      setAvailableKelas([]);
      setSelectedKelas('');
      setSelectedScheduleId('');
      setSchedules([]);
    }
  }, [user?.role, user?.id, selectedDosenId]);

  // Fetch schedules when dependencies change
  useEffect(() => {
    if (selectedDosenId && selectedKelas) {
      fetchSchedules();
    } else {
      setSchedules([]);
      setSelectedScheduleId('');
    }
  }, [selectedDosenId, selectedKelas]);

  useEffect(() => {
    if (!isMonitoring) {
      setAnnotatedImage('');
      setAnalyzeMetrics(null);
      setIsVideoReady(false);
      return;
    }

    let alive = true;
    const fetchRecordStatus = async () => {
      try {
        const response = await axios.get('/api/ai-service/focus/record/status');
        if (!alive) return;
        setRecordStatusText(String(response.data?.status || ''));
        const rows = Array.isArray(response.data?.events) ? response.data.events : [];
        const summaryRows = Array.isArray(response.data?.summary) ? response.data.summary : [];
        setRecordEvents(mapEventRows(rows));
        setRecordSummary(mapSummaryRows(summaryRows));
      } catch (err) {
        if (!alive) return;
        console.error('Error fetching recording status:', err);
      }
    };

    void fetchRecordStatus();
    const timer = window.setInterval(fetchRecordStatus, 3000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [isMonitoring]);

  useEffect(() => {
    if (videoRef.current) {
      setIsVideoReady(false);
      videoRef.current.srcObject = cameraStream;
      if (cameraStream) {
        const playVideo = async () => {
          try {
            await videoRef.current?.play();
          } catch (error) {
            console.error('Error playing video stream:', error);
          }
        };
        void playVideo();
      }
    }
    streamRef.current = cameraStream;
  }, [cameraStream, isMonitoring]);

  useEffect(() => {
    if (!isMonitoring || !cameraStream || !isVideoReady) {
      if (analyzeIntervalRef.current) {
        window.clearInterval(analyzeIntervalRef.current);
        analyzeIntervalRef.current = null;
      }
      return;
    }

    const run = () => {
      void analyzeCurrentFrame();
    };

    run();
    analyzeIntervalRef.current = window.setInterval(run, 1500);

    return () => {
      if (analyzeIntervalRef.current) {
        window.clearInterval(analyzeIntervalRef.current);
        analyzeIntervalRef.current = null;
      }
    };
  }, [isMonitoring, cameraStream, isVideoReady]);

  const fetchDosen = async () => {
    try {
      const res = await axios.get('/api/users');
      const dosenList = (res.data || []).filter((u: UserOption) => u.role === 'dosen');
      setDosenOptions(dosenList);
    } catch (err) {
      console.error('Error fetching dosen:', err);
    }
  };

  const fetchAvailableKelas = async () => {
    try {
      const params: any = {};
      if (user?.role === 'admin' && selectedDosenId) {
        params.dosen_id = selectedDosenId;
      } else if (user?.role === 'dosen') {
        params.dosen_id = user.id;
      }

      const scheduleRes = await axios.get('/api/jadwal', { params });
      const scheduleList = Array.isArray(scheduleRes.data) ? scheduleRes.data : [];
      const kelasSet = new Set<string>();
      scheduleList.forEach((schedule: Schedule) => {
        if (schedule?.kelas) {
          kelasSet.add(schedule.kelas);
        }
      });

      setAvailableKelas(Array.from(kelasSet).sort());
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  const fetchSchedules = async () => {
    try {
      const params: any = {
        kelas: selectedKelas,
      };
      if (selectedDosenId) {
        params.dosen_id = selectedDosenId;
      }

      const res = await axios.get('/api/jadwal', { params });
      const scheduleList = Array.isArray(res.data) ? res.data : [];
      scheduleList.sort((a: Schedule, b: Schedule) => {
        const dateDiff = toDateOnly(a.tanggal).getTime() - toDateOnly(b.tanggal).getTime();
        if (dateDiff !== 0) return dateDiff;
        return toMinutes(a.jam_mulai) - toMinutes(b.jam_mulai);
      });
      setSchedules(scheduleList);
    } catch (err) {
      console.error('Error fetching schedules:', err);
      showError('Gagal', 'Gagal memuat jadwal');
    }
  };

  const loadCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const nextCameras = devices
        .filter((device) => device.kind === 'videoinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${index + 1}`,
        }));
      setCameras(nextCameras);
      if (!selectedCameraId && nextCameras.length > 0) {
        setSelectedCameraId(nextCameras[0].deviceId);
      }
    } catch (err) {
      console.error('Error loading cameras:', err);
    }
  };

  const stopCameraStream = () => {
    if (analyzeIntervalRef.current) {
      window.clearInterval(analyzeIntervalRef.current);
      analyzeIntervalRef.current = null;
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }
    setCameraStream(null);
    setAnnotatedImage('');
    setAnalyzeMetrics(null);
    setIsVideoReady(false);
  };

  const openCamera = async () => {
    try {
      setIsCameraLoading(true);
      stopCameraStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: selectedCameraId ? { deviceId: { exact: selectedCameraId } } : true,
        audio: false,
      });
      setCameraStream(stream);
      await loadCameras();
      showSuccess('Berhasil', 'Kamera aktif.');
    } catch (err: any) {
      console.error('Error opening camera:', err);
      showError('Gagal', 'Tidak bisa membuka kamera.');
    } finally {
      setIsCameraLoading(false);
    }
  };

  const analyzeCurrentFrame = async () => {
    if (isAnalyzingRef.current) return;
    if (!videoRef.current || !captureCanvasRef.current) return;
    if (!cameraStream) return;

    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video.videoWidth || !video.videoHeight) return;

    isAnalyzingRef.current = true;
    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);
      const response = await axios.post('/api/ai-service/focus/analyze-frame', {
        image_base64: imageBase64,
        use_trained: true,
      });
      setAnnotatedImage(String(response.data?.annotated_image_base64 || ''));
      const metrics = (response.data?.metrics || null) as AnalyzeMetrics | null;
      setAnalyzeMetrics(metrics);
      if (isMonitoring && metrics?.people && metrics.people.length > 0) {
        const timestamp = formatNow();
        const nextEvents = metrics.people.map((person, index) => ({
          timestamp,
          id: String(person?.id ?? `person-${index + 1}`),
          label: String(person?.label ?? `Person ${index + 1}`),
          status: String(person?.status ?? ''),
          confidence: Number(person?.confidence ?? 0),
        }));
        setRecordEvents((prev) => {
          const merged = [...prev, ...nextEvents];
          const nextTotal = merged.length;
          setRecordStatusText((prevStatus) => {
            if (prevStatus && prevStatus.includes('Total event:')) {
              return prevStatus.replace(/Total event:\s*\d+/, `Total event: ${nextTotal}`);
            }
            return `Recording aktif | Mulai: ${timestamp} | Selesai: berjalan | Total event: ${nextTotal}`;
          });
          return merged.slice(-100);
        });
      }
    } catch (err) {
      console.error('Error analyzing frame:', err);
    } finally {
      isAnalyzingRef.current = false;
    }
  };

  const startMonitoring = async () => {
    if (!selectedScheduleId) {
      showError('Gagal', 'Pilih jadwal terlebih dahulu');
      return;
    }
    if (!cameraStream) {
      showError('Gagal', 'Buka kamera terlebih dahulu.');
      return;
    }

    try {
      // Get schedule
      const schedule = schedules.find(s => s._id === selectedScheduleId);
      if (!schedule) {
        showError('Gagal', 'Jadwal tidak ditemukan');
        return;
      }
      if (!getSchedulePresentation(schedule).canSelect) {
        showError('Gagal', 'Hanya jadwal hari ini yang bisa dipilih untuk monitoring');
        return;
      }
      setActiveSchedule(schedule);

      // Update schedule status to ongoing
      await axios.put(`/api/jadwal/${selectedScheduleId}`, { status: 'ongoing' });

      // Start session
      const sessionRes = await axios.post('/api/live-monitoring/start', {
        jadwal_id: selectedScheduleId,
        kelas: schedule.kelas,
        mata_kuliah: schedule.mata_kuliah,
        dosen_id: selectedDosenId
      });

      const sessionId = sessionRes.data.sessionId;
      setCurrentSessionId(sessionId);
      setSessionStartTime(Date.now());
      setRecordStatusText('Recording aktif | Menunggu event pertama...');
      setRecordEvents([]);
      setRecordSummary([]);
      setAnalyzeMetrics(null);
      setLastMonitoringReport(null);

      // Start AI service recording
      await axios.post('/api/ai-service/focus/record/start');

      setIsMonitoring(true);
      showSuccess('Berhasil', 'Monitoring dimulai');
    } catch (err: any) {
      console.error('Error starting monitoring:', err);
      showError('Gagal', err?.response?.data?.message || 'Gagal memulai monitoring');
    }
  };

  const stopMonitoring = async () => {
    try {
      // Stop AI service recording
      const recordStopRes = await axios.post('/api/ai-service/focus/record/stop');
      const finalStatus = String(recordStopRes.data?.status || 'Recording selesai');
      const finalEvents = mapEventRows(Array.isArray(recordStopRes.data?.events) ? recordStopRes.data.events : []);
      const finalSummary = mapSummaryRows(Array.isArray(recordStopRes.data?.summary) ? recordStopRes.data.summary : []);

      // Stop session
      await axios.post(`/api/live-monitoring/stop/${currentSessionId}`, {
        record_status: finalStatus,
        record_events: finalEvents,
        record_summary: finalSummary,
      });

      // Update schedule status to completed
      if (selectedScheduleId) {
        await axios.put(`/api/jadwal/${selectedScheduleId}`, { status: 'completed' });
      }

      setRecordStatusText(finalStatus);
      setRecordEvents(finalEvents);
      setRecordSummary(finalSummary);
      setLastMonitoringReport({
        status: finalStatus,
        events: finalEvents,
        summary: finalSummary,
        schedule: activeSchedule,
      });
      setIsMonitoring(false);
      setCurrentSessionId('');
      setAnalyzeMetrics(null);

      showSuccess('Berhasil', 'Monitoring selesai, data tersimpan');
    } catch (err: any) {
      console.error('Error stopping monitoring:', err);
      showError('Gagal', err?.response?.data?.message || 'Gagal menghentikan monitoring');
    }
  };

  const downloadExcel = async () => {
    try {
      const response = await axios.get('/api/ai-service/focus/record/export', {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().slice(0,10);
      const filename =
        parseDownloadFilename(response.headers['content-disposition']) ||
        `focus-monitoring-${timestamp}.xlsx`;
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Error downloading Excel:', err);
      showError('Gagal', 'Gagal mengunduh laporan Excel');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 flex items-center gap-3">
          <Eye className="w-8 h-8 text-blue-600" />
          Live Monitoring Fokus Siswa
        </h1>

        {!isMonitoring ? (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-semibold text-gray-700 mb-6">Pilih Jadwal Monitoring</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {user?.role === 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Dosen Pengampu
                  </label>
                  <select
                    value={selectedDosenId}
                    onChange={(e) => {
                      setSelectedDosenId(e.target.value);
                      setSelectedKelas('');
                      setSelectedScheduleId('');
                      setSchedules([]);
                      setActiveSchedule(null);
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- Pilih Dosen --</option>
                    {dosenOptions.map((dosen) => (
                      <option key={dosen._id} value={dosen._id}>
                        {dosen.nama_lengkap || dosen.username}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {user?.role === 'dosen' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Dosen Pengampu
                  </label>
                  <div className="w-full px-4 py-3 border border-blue-200 bg-blue-50 rounded-lg text-blue-900 font-medium">
                    {user?.nama_lengkap || user?.username || '-'}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Kelas
                </label>
                <select
                  value={selectedKelas}
                  onChange={(e) => {
                    setSelectedKelas(e.target.value);
                    setSelectedScheduleId('');
                    setActiveSchedule(null);
                  }}
                  disabled={user?.role === 'admin' && !selectedDosenId}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Pilih Kelas --</option>
                  {availableKelas.map((kelas) => (
                    <option key={kelas} value={kelas}>
                      {kelas}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex items-center justify-between gap-4 mb-3">
                <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Jadwal Kelas
                </label>
                <span className="text-xs text-gray-500">
                  Jadwal lama tampil sebagai `Done`, jadwal mendatang tampil pudar dan tidak bisa dipilih.
                </span>
              </div>

              <div className="space-y-3 max-h-[320px] overflow-auto pr-1">
                {!selectedKelas ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500 text-center">
                    Pilih kelas terlebih dahulu untuk melihat daftar jadwal.
                  </div>
                ) : schedules.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500 text-center">
                    Belum ada jadwal untuk kelas ini.
                  </div>
                ) : (
                  schedules.map((schedule) => {
                    const presentation = getSchedulePresentation(schedule);
                    const isSelected = selectedScheduleId === schedule._id;
                    return (
                      <button
                        key={schedule._id}
                        type="button"
                        onClick={() => {
                          if (!presentation.canSelect) return;
                          setSelectedScheduleId(schedule._id);
                          setActiveSchedule(schedule);
                        }}
                        disabled={!presentation.canSelect}
                        className={`w-full rounded-2xl border px-4 py-4 text-left transition-all ${presentation.cardClass} ${isSelected ? 'ring-2 ring-blue-500 border-blue-400 shadow-md' : 'hover:shadow-sm'}`}
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="text-base font-semibold text-gray-900">
                              {schedule.mata_kuliah} - {schedule.kelas}
                            </div>
                            <div className="mt-1 text-sm text-gray-600">
                              {formatScheduleDate(schedule.tanggal)}
                            </div>
                            <div className="mt-1 text-sm text-gray-600">
                              {schedule.jam_mulai} - {schedule.jam_selesai} | Pertemuan {schedule.pertemuan_ke}
                            </div>
                            {schedule.topik && (
                              <div className="mt-1 text-sm text-gray-500">
                                Topik: {schedule.topik}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col items-start md:items-end gap-2">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${presentation.badgeClass}`}>
                              {presentation.label}
                            </span>
                            {presentation.canSelect ? (
                              <span className="text-xs text-blue-700">Bisa dipilih untuk monitoring</span>
                            ) : (
                              <span className="text-xs text-gray-500">Tidak bisa dipilih</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Kamera</label>
                <select
                  value={selectedCameraId}
                  onChange={(e) => setSelectedCameraId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Pilih Kamera --</option>
                  {cameras.map((camera) => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:w-56 flex items-end">
                <button
                  onClick={cameraStream ? stopCameraStream : openCamera}
                  type="button"
                  disabled={isCameraLoading}
                  className="w-full py-3 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <Camera className="w-5 h-5" />
                  {cameraStream ? 'Tutup Kamera' : isCameraLoading ? 'Membuka...' : 'Buka Kamera'}
                </button>
              </div>
            </div>

            <div className="bg-gray-950 rounded-2xl overflow-hidden mb-6" style={{ aspectRatio: '16 / 9' }}>
              {cameraStream ? (
                <div className="relative w-full h-full">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    onLoadedMetadata={() => setIsVideoReady(true)}
                    onCanPlay={() => setIsVideoReady(true)}
                    className="w-full h-full object-cover"
                  />
                  {annotatedImage && (
                    <img
                      src={annotatedImage}
                      alt="AI preview"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                  <Camera className="w-12 h-12 mb-3" />
                  <p>Kamera belum aktif</p>
                </div>
              )}
            </div>

            <button
              onClick={startMonitoring}
              disabled={!selectedScheduleId || !cameraStream}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Play className="w-5 h-5" />
              Mulai Monitoring
            </button>

            {lastMonitoringReport && (
              <div className="mt-8 bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-800">Rekap Monitoring Terakhir</h3>
                    <p className="text-sm text-slate-600">{lastMonitoringReport.status}</p>
                  </div>
                  <button
                    onClick={downloadExcel}
                    className="py-3 px-5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download className="w-5 h-5" />
                    Unduh Excel
                  </button>
                </div>

                {lastMonitoringReport.schedule && (
                  <div className="text-sm text-slate-700">
                    {lastMonitoringReport.schedule.mata_kuliah} | {lastMonitoringReport.schedule.kelas} | Pertemuan {lastMonitoringReport.schedule.pertemuan_ke}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="rounded-lg bg-white border border-slate-200 px-4 py-3">
                    <div className="text-slate-500">Total Event</div>
                    <div className="text-xl font-semibold text-slate-800">{lastMonitoringReport.events.length}</div>
                  </div>
                  <div className="rounded-lg bg-white border border-slate-200 px-4 py-3">
                    <div className="text-slate-500">Jumlah Siswa Terdeteksi</div>
                    <div className="text-xl font-semibold text-slate-800">{lastMonitoringReport.summary.length}</div>
                  </div>
                  <div className="rounded-lg bg-white border border-slate-200 px-4 py-3">
                    <div className="text-slate-500">Status</div>
                    <div className="text-sm font-semibold text-slate-800">Siap diunduh ke Excel</div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-white">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">ID</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Label</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Focused</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Not Focused</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Total</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">First Seen</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Last Seen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {lastMonitoringReport.summary.length > 0 ? (
                        lastMonitoringReport.summary.map((row) => (
                          <tr key={`${row.id}-${row.firstSeen}`}>
                            <td className="px-4 py-3 text-slate-700">{row.id}</td>
                            <td className="px-4 py-3 text-slate-700">{row.label}</td>
                            <td className="px-4 py-3 text-slate-700">{row.focused}</td>
                            <td className="px-4 py-3 text-slate-700">{row.notFocused}</td>
                            <td className="px-4 py-3 text-slate-700">{row.total}</td>
                            <td className="px-4 py-3 text-slate-700">{row.firstSeen}</td>
                            <td className="px-4 py-3 text-slate-700">{row.lastSeen}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                            Belum ada ringkasan event yang tersimpan.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {activeSchedule && (
              <div className="bg-white rounded-xl shadow-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <BookOpen className="w-6 h-6 text-blue-600" />
                  <div>
                    <h3 className="font-semibold text-lg">{activeSchedule.mata_kuliah}</h3>
                    <p className="text-gray-600">
                      {activeSchedule.kelas} - {activeSchedule.dosen_name} - Pertemuan {activeSchedule.pertemuan_ke}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    Berjalan {Math.floor((Date.now() - sessionStartTime) / 1000)} detik
                  </span>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="relative bg-gray-950" style={{ aspectRatio: '16 / 9' }}>
                {cameraStream ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      onLoadedMetadata={() => setIsVideoReady(true)}
                      onCanPlay={() => setIsVideoReady(true)}
                      className="w-full h-full object-cover"
                    />
                    {annotatedImage && (
                      <img
                        src={annotatedImage}
                        alt="AI preview"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                    <Camera className="w-12 h-12 mb-3" />
                    <p>Kamera belum aktif</p>
                  </div>
                )}
              </div>
              <div className="border-t border-gray-100 px-6 py-4 grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div className="rounded-lg bg-slate-50 px-4 py-3">
                  <div className="text-gray-500">Status AI</div>
                  <div className="font-semibold text-gray-800">{analyzeMetrics?.status || 'menunggu'}</div>
                </div>
                <div className="rounded-lg bg-slate-50 px-4 py-3">
                  <div className="text-gray-500">Jumlah Orang</div>
                  <div className="font-semibold text-gray-800">{analyzeMetrics?.people_count ?? 0}</div>
                </div>
                <div className="rounded-lg bg-slate-50 px-4 py-3">
                  <div className="text-gray-500">Focused</div>
                  <div className="font-semibold text-green-700">{analyzeMetrics?.focused_count ?? 0}</div>
                </div>
                <div className="rounded-lg bg-slate-50 px-4 py-3">
                  <div className="text-gray-500">Not Focused</div>
                  <div className="font-semibold text-red-700">{analyzeMetrics?.not_focused_count ?? 0}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Timestamp Table</h3>
                <span className="text-sm text-gray-500">{recordEvents.length} event</span>
              </div>

              <div className="mb-4 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-900">
                {recordStatusText || 'Menunggu data recording...'}
              </div>

              <div className="max-h-[420px] overflow-auto border border-gray-100 rounded-xl">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Timestamp</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">ID</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Label</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {recordEvents.length > 0 ? (
                      recordEvents.slice().reverse().map((event, index) => (
                        <tr key={`${event.timestamp}-${event.id}-${index}`}>
                          <td className="px-4 py-3 text-gray-700">{event.timestamp}</td>
                          <td className="px-4 py-3 text-gray-700">{event.id}</td>
                          <td className="px-4 py-3 text-gray-700">{event.label}</td>
                          <td className="px-4 py-3 text-gray-700">{event.status}</td>
                          <td className="px-4 py-3 text-gray-700">{event.confidence.toFixed(3)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                          Belum ada event yang terekam.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={cameraStream ? stopCameraStream : openCamera}
                type="button"
                disabled={isCameraLoading}
                className="flex-1 py-4 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Camera className="w-5 h-5" />
                {cameraStream ? 'Tutup Kamera' : isCameraLoading ? 'Membuka...' : 'Buka Kamera'}
              </button>
              <button
                onClick={stopMonitoring}
                className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Square className="w-5 h-5" />
                Selesaikan Monitoring
              </button>
              <button
                onClick={downloadExcel}
                className="flex-1 py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-5 h-5" />
                Unduh Laporan Excel
              </button>
            </div>
          </div>
        )}
      </div>
      <canvas ref={captureCanvasRef} className="hidden" />
    </div>
  );
}
