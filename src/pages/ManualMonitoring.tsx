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
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useStatusModal } from '../contexts/StatusModalContext';

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

interface UserOption {
  _id: string;
  role: string;
  nama_lengkap?: string;
  username?: string;
}

interface Schedule {
  _id: string;
  kelas: string;
  mata_kuliah: string;
  dosen_name?: string;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  pertemuan_ke: number;
  topik?: string;
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  mata_kuliah_id?: string | { _id?: string };
  kelas_id?: string | { _id?: string };
}

export default function ManualMonitoring() {
  const { user } = useAuth();
  const { showSuccess, showError } = useStatusModal();
  // Steps: 'setup' -> 'monitoring' -> 'summary'
  const [step, setStep] = useState<'setup' | 'monitoring' | 'summary'>('setup');
  
  // Data State
  const [subjects, setSubjects] = useState<MataKuliah[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<MataKuliah | null>(null);
  const [sessionNumber, setSessionNumber] = useState(1);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
  const [dosenOptions, setDosenOptions] = useState<UserOption[]>([]);
  const [selectedDosenId, setSelectedDosenId] = useState<string>('');

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

  const totalStudents = seats.length;
  const focusedStudents = seats.filter((seat) => seat.distractions === 0).length;
  const notFocusedStudents = totalStudents - focusedStudents;
  const focusRate = totalStudents > 0 ? (focusedStudents / totalStudents) * 100 : 0;
  const realtimeSummaryCards = [
    {
      label: 'Total Student',
      value: totalStudents,
      valueClass: 'text-slate-900',
      cardClass: 'border-slate-200 bg-slate-50',
      accentClass: 'bg-slate-700',
    },
    {
      label: 'Focused',
      value: focusedStudents,
      valueClass: 'text-emerald-700',
      cardClass: 'border-emerald-100 bg-emerald-50',
      accentClass: 'bg-emerald-500',
    },
    {
      label: 'Not Focused',
      value: notFocusedStudents,
      valueClass: 'text-rose-700',
      cardClass: 'border-rose-100 bg-rose-50',
      accentClass: 'bg-rose-500',
    },
    {
      label: 'Focus Rate',
      value: `${focusRate.toFixed(1)}%`,
      valueClass: 'text-blue-700',
      cardClass: 'border-blue-100 bg-blue-50',
      accentClass: 'bg-blue-500',
    },
  ];

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

  // Fetch Subjects
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        setLoadingSubjects(true);
        if (user?.role === 'admin' && !selectedDosenId) {
          setSubjects([]);
          setSelectedSubject(null);
          return;
        }
        const params: any = {};
        if (user?.role === 'admin' && selectedDosenId) {
          params.dosen_id = selectedDosenId;
        }
        const res = await axios.get('/api/mata-kuliah', { params });
        setSubjects(res.data);
      } catch (error) {
        console.error('Error fetching subjects:', error);
        showError('Gagal', 'Gagal memuat data mata kuliah.');
      } finally {
        setLoadingSubjects(false);
      }
    };
    fetchSubjects();
  }, [user?.role, selectedDosenId]);
  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        setLoadingSchedules(true);
        if (user?.role === 'admin' && !selectedDosenId) {
          setSchedules([]);
          return;
        }
        if (!selectedSubject?._id || !config.className) {
          setSchedules([]);
          return;
        }
        const params: any = {
          mata_kuliah_id: selectedSubject._id,
          kelas: config.className
        };
        if (user?.role === 'admin' && selectedDosenId) {
          params.dosen_id = selectedDosenId;
        }
        const res = await axios.get('/api/jadwal', { params });
        const nextSchedules = Array.isArray(res.data) ? res.data : [];
        nextSchedules.sort((a: Schedule, b: Schedule) => {
          const dateDiff = toDateOnly(a.tanggal).getTime() - toDateOnly(b.tanggal).getTime();
          if (dateDiff !== 0) return dateDiff;
          return toMinutes(a.jam_mulai) - toMinutes(b.jam_mulai);
        });
        setSchedules(nextSchedules);
      } catch (error) {
        showError('Gagal', 'Gagal memuat data schedule.');
      } finally {
        setLoadingSchedules(false);
      }
    };
    fetchSchedules();
  }, [user?.role, selectedDosenId, selectedSubject?._id, config.className]);

  // Setup Functions
  const generateGrid = () => {
    if (!config.className || !config.subject) {
      showError('Validasi', 'Isi Class Name dan Subject terlebih dahulu.');
      return;
    }
    if (!selectedScheduleId) {
      showError('Validasi', 'Pilih schedule terlebih dahulu.');
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
    showSuccess('Berhasil', 'Sesi monitoring dimulai.');
  };

  const stopSession = () => {
    setIsSessionActive(false);
    setStep('summary');
    showSuccess('Berhasil', 'Sesi selesai.');
  };

  // Interaction Functions
  const handleSeatClick = (seat: Seat) => {
    if (!isSessionActive) {
      showError('Tidak Bisa', 'Mulai sesi terlebih dahulu.');
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

    showSuccess('Berhasil', `Distraction tercatat untuk ${selectedSeat.label}.`);
    setSelectedSeat(null);
  };

  const cancelDistraction = () => {
    setSelectedSeat(null);
  };

  const saveToDatabase = async () => {
    if (!selectedSubject && !selectedScheduleId) {
      showError('Gagal Menyimpan', 'Tidak bisa menyimpan: mata kuliah atau schedule belum dipilih.');
      return;
    }

    setIsSaving(true);
    try {
      const totalEvents = distractionLog.length;
      const cleanSeats = seats.filter(s => s.distractions === 0).length;
      const focusPercentage = Math.round((cleanSeats / seats.length) * 100);
      const selectedSchedule = schedules.find((s) => s._id === selectedScheduleId);
      const scheduleSubjectId =
        selectedSchedule
          ? (typeof selectedSchedule.mata_kuliah_id === 'string'
              ? selectedSchedule.mata_kuliah_id
              : (selectedSchedule.mata_kuliah_id?._id as string | undefined))
          : undefined;

      const mataKuliahId = scheduleSubjectId || selectedSubject?._id;
      const scheduleKelasId =
        selectedSchedule
          ? (typeof selectedSchedule.kelas_id === 'string'
              ? selectedSchedule.kelas_id
              : (selectedSchedule.kelas_id?._id as string | undefined))
          : undefined;
      const mataKuliahName = selectedSchedule?.mata_kuliah || selectedSubject?.nama || config.subject;
      const kelasName = selectedSchedule?.kelas || config.className;

      if (!mataKuliahId || !mataKuliahName || !kelasName) {
        showError('Gagal Menyimpan', 'Data tidak lengkap: mata kuliah/kelas belum terisi dengan benar.');
        return;
      }
      if (selectedSchedule?.tanggal && !isToday(selectedSchedule.tanggal)) {
        showError('Gagal Menyimpan', 'Schedule hanya bisa dilakukan pada tanggal yang dijadwalkan.');
        return;
      }

      const payload = {
        jadwal_id: selectedScheduleId || undefined,
        kelas_id: scheduleKelasId || undefined,
        tanggal: selectedSchedule?.tanggal ? new Date(selectedSchedule.tanggal) : new Date(),
        pertemuan_ke: selectedSchedule?.pertemuan_ke || sessionNumber,
        kelas: kelasName,
        mata_kuliah: mataKuliahName,
        mata_kuliah_id: mataKuliahId,
        dosen_id: user?.role === 'admin' ? selectedDosenId : user?.id,
        durasi_pertemuan: Math.ceil(timer / 60),
        topik: 'Manual Monitoring Session',
        data_fokus: seats.map(seat => ({
          id_siswa: seat.label,
          jumlah_sesi_fokus: 1,
          durasi_fokus: Math.max(0, Math.ceil(timer / 60) - (seat.distractions * 5)),
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

      await axios.post('/api/pertemuan', payload);
      if (selectedScheduleId) {
        await axios.put(`/api/jadwal/${selectedScheduleId}`, { status: 'completed' });
      }
      showSuccess('Berhasil', 'Data berhasil disimpan ke database.');
      setSelectedScheduleId('');
      setIsSessionActive(false);
      setStep('setup');
    } catch (error: any) {
      console.error('Error saving data:', error);
      showError('Gagal Menyimpan', error.response?.data?.message || error.message || 'Gagal menyimpan data.');
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

      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <div className="font-semibold mb-2">Panduan Penggunaan (Manual)</div>
        <div className="space-y-1">
          <div>1) Pilih data: {user?.role === 'admin' ? 'Dosen → Mata Kuliah → Kelas → Jadwal (Hari Ini)' : 'Mata Kuliah → Kelas → Jadwal (Hari Ini)'}</div>
          <div>2) Atur layout kursi (Rows/Columns) → Create Layout.</div>
          <div>3) Monitoring: Start → klik kursi untuk catat tidak fokus → Stop → Summary.</div>
          <div>4) Save to Database: membuat data pertemuan/rekap dan mengubah status jadwal menjadi Completed, sehingga jadwal tidak muncul lagi.</div>
        </div>
      </div>
      
      <div className="space-y-6">
        {user?.role === 'admin' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Dosen Pengampu</label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <select
                value={selectedDosenId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedDosenId(id);
                  setSelectedSubject(null);
                  setSelectedScheduleId('');
                  setConfig((prev) => ({ ...prev, subject: '', className: '' }));
                }}
                className="pl-10 w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">Pilih Dosen</option>
                {dosenOptions.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.nama_lengkap || d.username || d._id}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
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
                    setSelectedScheduleId('');
                    setSessionNumber(1);
                    setConfig(prev => ({ ...prev, subject: subj?.nama || '', className: '' }));
                  }}
                  className="pl-10 w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  disabled={user?.role === 'admin' ? !selectedDosenId : false}
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
                  onChange={(e) => {
                    setConfig({ ...config, className: e.target.value });
                    setSelectedScheduleId('');
                    setSessionNumber(1);
                  }}
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
                  onChange={(e) => {
                    setConfig({ ...config, className: e.target.value });
                    setSelectedScheduleId('');
                    setSessionNumber(1);
                  }}
                  className="pl-10 w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., IF-4A"
                />
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-4">
            <label className="block text-sm font-medium text-gray-700">Pilih Schedule</label>
            <span className="text-xs text-gray-500">
              Jadwal lama tampil sebagai `Done`, jadwal mendatang tampil pudar dan tidak bisa dipilih.
            </span>
          </div>
          <div className="space-y-3 max-h-[320px] overflow-auto pr-1">
            {loadingSchedules ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500 text-center">
                Loading schedules...
              </div>
            ) : !selectedSubject?._id || !config.className || (user?.role === 'admin' ? !selectedDosenId : false) ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500 text-center">
                Pilih dosen, mata kuliah, dan kelas terlebih dahulu untuk melihat daftar schedule.
              </div>
            ) : schedules.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500 text-center">
                Belum ada schedule untuk kombinasi mata kuliah dan kelas ini.
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
                      setSessionNumber(schedule.pertemuan_ke || 1);
                      setConfig((prev) => ({
                        ...prev,
                        subject: schedule.mata_kuliah || prev.subject,
                        className: schedule.kelas || prev.className,
                      }));
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
                          <span className="text-xs text-blue-700">Bisa dipilih untuk manual monitoring</span>
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
              disabled={!!selectedScheduleId}
              className="pl-10 w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
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

        <div className="border-b border-gray-100 px-6 py-5">
          <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Realtime Monitoring Summary</h3>
              <p className="text-sm text-gray-500">Ringkasan di bawah ini berubah mengikuti catatan manual selama sesi berjalan.</p>
            </div>
            <span className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-medium ${isSessionActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
              Status Session: {isSessionActive ? 'Active' : 'Paused'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {realtimeSummaryCards.map((card) => (
              <div
                key={card.label}
                className={`rounded-xl border px-4 py-4 shadow-sm ${card.cardClass}`}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${card.accentClass} ${isSessionActive ? 'animate-pulse' : ''}`}></span>
                  <div className="text-sm font-medium text-gray-500">{card.label}</div>
                </div>
                <div className={`mt-2 text-3xl font-bold ${card.valueClass}`}>{card.value}</div>
              </div>
            ))}
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 mb-8">
              {realtimeSummaryCards.map((card) => (
                <div
                  key={card.label}
                  className={`rounded-xl border px-4 py-4 shadow-sm ${card.cardClass}`}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${card.accentClass}`}></span>
                    <div className="text-sm font-medium text-gray-500">{card.label}</div>
                  </div>
                  <div className={`mt-2 text-3xl font-bold ${card.valueClass}`}>{card.value}</div>
                </div>
              ))}
            </div>

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
                disabled={isSaving || (!selectedSubject && !selectedScheduleId)}
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <Grid3X3 className="w-8 h-8 text-pink-600" />
              Manual Monitoring Fokus Siswa
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Pencatatan fokus siswa secara manual berbasis layout kursi dan schedule.
            </p>
          </div>
          {selectedScheduleId ? (
            <span className="inline-flex w-fit rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 border border-blue-100">
              Schedule dipilih
            </span>
          ) : (
            <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 border border-slate-200">
              Pilih schedule dulu
            </span>
          )}
        </div>

        {step === 'setup' && renderSetup()}
        {step === 'monitoring' && renderMonitoring()}
        {step === 'summary' && renderSummary()}
      </div>
    </div>
  );
}
