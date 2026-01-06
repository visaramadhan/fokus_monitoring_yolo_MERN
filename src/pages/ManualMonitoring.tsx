import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Square, 
  Clock, 
  Grid3X3, 
  Users, 
  BookOpen, 
  Save, 
  AlertCircle,
  CheckCircle,
  X,
  Plus,
  Database,
  Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

interface Seat {
  id: string;
  label: string; // e.g., "A1", "B3"
  distractions: number;
}

interface DistractionEvent {
  id: string;
  seatId: string;
  timestamp: string; // HH:mm:ss
  elapsedTime: string; // MM:SS from start
  note: string;
}

interface MataKuliah {
  _id: string;
  nama: string;
  kode: string;
  kelas: string[];
  sks: number;
}

export default function ManualMonitoring() {
  const { user } = useAuth();
  // Steps: 'setup' -> 'monitoring' -> 'summary'
  const [step, setStep] = useState<'setup' | 'monitoring' | 'summary'>('setup');
  
  // Data State
  const [subjects, setSubjects] = useState<MataKuliah[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<MataKuliah | null>(null);
  const [sessionNumber, setSessionNumber] = useState(1);

  // Configuration
  const [config, setConfig] = useState({
    className: '',
    subject: '',
    rows: 5,
    cols: 6
  });

  // Session State
  const [seats, setSeats] = useState<Seat[]>([]);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [distractionLog, setDistractionLog] = useState<DistractionEvent[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Modal State
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [noteInput, setNoteInput] = useState('');

  // Fetch Subjects
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const res = await axios.get('/mata-kuliah');
        setSubjects(res.data);
      } catch (error) {
        console.error('Error fetching subjects:', error);
        toast.error('Failed to load subjects');
      } finally {
        setLoadingSubjects(false);
      }
    };
    fetchSubjects();
  }, []);

  // Setup Functions
  const generateGrid = () => {
    if (!config.className || !config.subject) {
      toast.error('Please fill in Class Name and Subject');
      return;
    }
    
    const newSeats: Seat[] = [];
    for (let r = 0; r < config.rows; r++) {
      for (let c = 0; c < config.cols; c++) {
        const rowLabel = String.fromCharCode(65 + r); // A, B, C...
        const colLabel = c + 1;
        const label = `${rowLabel}${colLabel}`;
        newSeats.push({
          id: label,
          label,
          distractions: 0
        });
      }
    }
    setSeats(newSeats);
    setStep('monitoring');
    setTimer(0);
    setDistractionLog([]);
  };

  // Timer Functions
  useEffect(() => {
    if (isSessionActive) {
      timerRef.current = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isSessionActive]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const startSession = () => {
    setIsSessionActive(true);
    toast.success('Monitoring session started');
  };

  const stopSession = () => {
    setIsSessionActive(false);
    setStep('summary');
    toast.success('Session ended');
  };

  // Interaction Functions
  const handleSeatClick = (seat: Seat) => {
    if (!isSessionActive) {
      toast.error('Start the session first');
      return;
    }
    setSelectedSeat(seat);
    setNoteInput('');
  };

  const confirmDistraction = () => {
    if (!selectedSeat) return;

    const now = new Date();
    const timestamp = now.toLocaleTimeString();
    
    const newEvent: DistractionEvent = {
      id: Math.random().toString(36).substr(2, 9),
      seatId: selectedSeat.id,
      timestamp,
      elapsedTime: formatTime(timer),
      note: noteInput || 'Tidak Fokus'
    };

    setDistractionLog(prev => [newEvent, ...prev]);
    
    setSeats(prev => prev.map(s => 
      s.id === selectedSeat.id 
        ? { ...s, distractions: s.distractions + 1 }
        : s
    ));

    toast.success(`Recorded distraction for ${selectedSeat.label}`);
    setSelectedSeat(null);
  };

  const cancelDistraction = () => {
    setSelectedSeat(null);
  };

  const saveToDatabase = async () => {
    if (!selectedSubject) {
      toast.error('Cannot save: No subject selected');
      return;
    }

    setIsSaving(true);
    try {
      const totalEvents = distractionLog.length;
      // Heuristic for focus percentage: 100 - (events * 2), min 0
      // Or we can calculate it based on (Clean Seats / Total Seats)
      const cleanSeats = seats.filter(s => s.distractions === 0).length;
      const focusPercentage = Math.round((cleanSeats / seats.length) * 100);

      // Construct payload for Pertemuan model
      const payload = {
        tanggal: new Date(),
        pertemuan_ke: sessionNumber,
        kelas: config.className,
        mata_kuliah: selectedSubject.nama,
        mata_kuliah_id: selectedSubject._id,
        dosen_id: user?.id,
        durasi_pertemuan: Math.ceil(timer / 60), // in minutes
        topik: 'Manual Monitoring Session',
        // Map seats to data_fokus
        data_fokus: seats.map(seat => ({
          id_siswa: seat.label, // Using seat label as ID since we don't have student mapping
          jumlah_sesi_fokus: 1, // Treat entire session as 1 session
          durasi_fokus: Math.max(0, Math.ceil(timer / 60) - (seat.distractions * 5)), // Penalty 5 mins per distraction
          persen_fokus: seat.distractions === 0 ? 100 : Math.max(0, 100 - (seat.distractions * 10)),
          persen_tidak_fokus: seat.distractions === 0 ? 0 : Math.min(100, seat.distractions * 10),
          status: seat.distractions === 0 ? 'Baik' : seat.distractions <= 2 ? 'Cukup' : 'Kurang'
        })),
        hasil_akhir_kelas: {
          fokus: focusPercentage,
          tidak_fokus: 100 - focusPercentage,
          jumlah_hadir: seats.length,
          fokus_count: cleanSeats,
          tidak_fokus_count: seats.length - cleanSeats
        }
      };

      await axios.post('/pertemuan', payload);
      toast.success('Data saved to database successfully!');
    } catch (error: any) {
      console.error('Error saving data:', error);
      toast.error(error.response?.data?.message || 'Failed to save data');
    } finally {
      setIsSaving(false);
    }
  };

  // Render Helpers
  const renderSetup = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8"
    >
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
        <Grid3X3 className="mr-3 text-blue-600" />
        Setup Manual Monitoring
      </h2>
      
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
            <div className="relative">
              <BookOpen className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              {loadingSubjects ? (
                <div className="pl-10 py-2.5 text-gray-500">Loading subjects...</div>
              ) : (
                <select
                  value={selectedSubject?._id || ''}
                  onChange={(e) => {
                    const subj = subjects.find(s => s._id === e.target.value);
                    setSelectedSubject(subj || null);
                    if (subj) {
                      setConfig(prev => ({ ...prev, subject: subj.nama, className: subj.kelas[0] || '' }));
                    }
                  }}
                  className="pl-10 w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">Select Subject</option>
                  {subjects.map(s => (
                    <option key={s._id} value={s._id}>{s.nama} ({s.kode})</option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Class Name</label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              {selectedSubject && selectedSubject.kelas.length > 0 ? (
                <select
                  value={config.className}
                  onChange={(e) => setConfig({ ...config, className: e.target.value })}
                  className="pl-10 w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">Select Class</option>
                  {selectedSubject.kelas.map((cls, idx) => (
                    <option key={idx} value={cls}>{cls}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={config.className}
                  onChange={(e) => setConfig({ ...config, className: e.target.value })}
                  className="pl-10 w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., IF-4A"
                />
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Session Number (Pertemuan Ke)</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="number"
              min="1"
              max="16"
              value={sessionNumber}
              onChange={(e) => setSessionNumber(parseInt(e.target.value) || 1)}
              className="pl-10 w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rows</label>
            <input
              type="number"
              min="1"
              max="10"
              value={config.rows}
              onChange={(e) => setConfig({ ...config, rows: parseInt(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Columns</label>
            <input
              type="number"
              min="1"
              max="10"
              value={config.cols}
              onChange={(e) => setConfig({ ...config, cols: parseInt(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="pt-4">
          <button
            onClick={generateGrid}
            className="w-full flex justify-center items-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            Create Layout
          </button>
        </div>
      </div>
    </motion.div>
  );

  const renderMonitoring = () => (
    <div className="h-[calc(100vh-100px)] flex flex-col md:flex-row gap-6">
      {/* Left: Grid Area */}
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{config.className}</h3>
            <p className="text-sm text-gray-500">{config.subject} - Pertemuan {sessionNumber}</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 flex items-center shadow-sm">
              <Clock className={`h-5 w-5 mr-2 ${isSessionActive ? 'text-green-500 animate-pulse' : 'text-gray-400'}`} />
              <span className="font-mono text-xl font-bold text-gray-900">{formatTime(timer)}</span>
            </div>
            {!isSessionActive && timer === 0 ? (
              <button
                onClick={startSession}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
              >
                <Play className="h-4 w-4 mr-2" /> Start
              </button>
            ) : (
              <button
                onClick={stopSession}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
              >
                <Square className="h-4 w-4 mr-2" /> Stop
              </button>
            )}
          </div>
        </div>

        {/* Grid Container */}
        <div className="flex-1 overflow-auto p-8 flex items-center justify-center bg-gray-100">
          <div 
            className="grid gap-4"
            style={{ 
              gridTemplateColumns: `repeat(${config.cols}, minmax(80px, 1fr))` 
            }}
          >
            {seats.map((seat) => (
              <motion.button
                key={seat.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSeatClick(seat)}
                className={`
                  relative aspect-square rounded-xl flex flex-col items-center justify-center p-4 border-2 shadow-sm transition-all
                  ${seat.distractions > 0 
                    ? 'bg-red-50 border-red-200 hover:bg-red-100' 
                    : 'bg-white border-green-200 hover:border-green-400 hover:shadow-md'
                  }
                `}
              >
                <span className={`text-2xl font-bold ${seat.distractions > 0 ? 'text-red-600' : 'text-gray-700'}`}>
                  {seat.label}
                </span>
                {seat.distractions > 0 && (
                  <span className="mt-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full border border-red-200">
                    {seat.distractions}x
                  </span>
                )}
                {/* Status Indicator Dot */}
                <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${seat.distractions > 0 ? 'bg-red-500' : 'bg-green-500'}`} />
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Log Area */}
      <div className="w-full md:w-80 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-bold text-gray-900 flex items-center">
            <AlertCircle className="h-5 w-5 mr-2 text-orange-500" />
            Distraction Log
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {distractionLog.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <p>No distractions recorded yet</p>
              <p className="text-sm mt-1">Click a seat to log an event</p>
            </div>
          ) : (
            distractionLog.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm"
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-sm">
                    {log.seatId}
                  </span>
                  <span className="text-xs font-mono text-gray-500">
                    {log.elapsedTime}
                  </span>
                </div>
                <p className="text-sm text-red-600 font-medium">{log.note}</p>
                <p className="text-xs text-gray-400 mt-1">{log.timestamp}</p>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Modal for adding note */}
      <AnimatePresence>
        {selectedSeat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">
                  Record Distraction: <span className="text-blue-600">{selectedSeat.label}</span>
                </h3>
                <button onClick={cancelDistraction} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Note (Optional)</label>
                <textarea
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="e.g., Playing with phone, Sleeping..."
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-red-500 focus:border-red-500 h-24 resize-none"
                  autoFocus
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={cancelDistraction}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDistraction}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-sm"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  const renderSummary = () => {
    const totalEvents = distractionLog.length;
    // Simple calculation for focus rate
    const calculatedFocus = Math.max(0, 100 - (totalEvents * 2)); 

    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-4xl mx-auto"
      >
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-white">
            <h2 className="text-3xl font-bold">Session Summary</h2>
            <p className="opacity-90 mt-1">{config.className} - {config.subject}</p>
          </div>
          
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              <div className="text-center p-6 bg-gray-50 rounded-xl">
                <p className="text-gray-500 font-medium uppercase tracking-wide text-xs">Duration</p>
                <p className="text-4xl font-bold text-gray-900 mt-2">{formatTime(timer)}</p>
              </div>
              <div className="text-center p-6 bg-gray-50 rounded-xl">
                <p className="text-gray-500 font-medium uppercase tracking-wide text-xs">Total Distractions</p>
                <p className="text-4xl font-bold text-red-600 mt-2">{totalEvents}</p>
              </div>
              <div className="text-center p-6 bg-gray-50 rounded-xl">
                <p className="text-gray-500 font-medium uppercase tracking-wide text-xs">Est. Focus Rate</p>
                <p className="text-4xl font-bold text-green-600 mt-2">{calculatedFocus}%</p>
              </div>
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-4">Detailed Log</h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seat</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Note</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {distractionLog.map((log) => (
                    <tr key={log.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {log.elapsedTime} <span className="text-gray-400 font-normal">({log.timestamp})</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.seatId}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{log.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-8 flex justify-end space-x-4">
              <button
                onClick={() => setStep('setup')}
                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
              >
                Start New Session
              </button>
              
              <button
                onClick={saveToDatabase}
                disabled={isSaving || !selectedSubject}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Database className="h-5 w-5 mr-2" />
                    Save to Database
                  </>
                )}
              </button>

              <button
                onClick={() => window.print()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center shadow-sm"
              >
                <Save className="h-5 w-5 mr-2" />
                Print / PDF
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6">
      {step === 'setup' && renderSetup()}
      {step === 'monitoring' && renderMonitoring()}
      {step === 'summary' && renderSummary()}
    </div>
  );
}
