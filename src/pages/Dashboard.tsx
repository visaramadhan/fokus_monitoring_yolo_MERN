import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  BookOpen, 
  Calendar, 
  GraduationCap,
  TrendingUp,
  Eye,
  Clock,
  BarChart3,
  Users,
  Award,
  Target,
  AlertCircle
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { useAuth } from '../contexts/AuthContext';

interface DashboardStats {
  totalKelas: number;
  totalMataKuliah: number;
  totalPertemuan: number;
  totalDosen: number;
  averageFocus: number;
}

interface RecentMeeting {
  _id: string;
  tanggal: string;
  pertemuan_ke: number;
  kelas: string;
  mata_kuliah: string;
  dosen_id: {
    nama_lengkap: string;
  };
  hasil_akhir_kelas: {
    fokus: number;
    tidak_fokus: number;
  };
}

interface ClassPerformance {
  _id: string;
  averageFocus: number;
  totalMeetings: number;
}

interface DosenPerformance {
  _id: string;
  nama_lengkap: string;
  averageFocus: number;
  totalMeetings: number;
  totalClasses: number;
}

interface FocusTrend {
  month: string;
  focus: number;
  meetings: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentMeetings, setRecentMeetings] = useState<RecentMeeting[]>([]);
  const [classPerformance, setClassPerformance] = useState<ClassPerformance[]>([]);
  const [dosenPerformance, setDosenPerformance] = useState<DosenPerformance[]>([]);
  const [focusTrends, setFocusTrends] = useState<FocusTrend[]>([]);
  const [classes, setClasses] = useState<{ _id: string; nama_kelas: string }[]>([]);
  const [subjects, setSubjects] = useState<{ _id: string; nama: string }[]>([]);
  const [focusThreshold, setFocusThreshold] = useState(70);
  const [trendFilterType, setTrendFilterType] = useState<'all' | 'kelas' | 'dosen' | 'mata_kuliah'>('all');
  const [trendFilterValue, setTrendFilterValue] = useState<string>('');
  const [trendInterval, setTrendInterval] = useState<'month' | 'week'>('month');
  const [periodMonths, setPeriodMonths] = useState<number>(6);
  const [periodWeeks, setPeriodWeeks] = useState<number>(8);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchDashboardData();
    fetchClasses();
    fetchSubjects();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [overviewRes, trendsRes] = await Promise.all([
        axios.get('/api/dashboard/overview'),
        axios.get(`/api/dashboard/focus-trends?interval=${trendInterval}`)
      ]);

      const overview = overviewRes.data || {};
      setStats(overview.stats || null);
      setRecentMeetings(Array.isArray(overview.recentMeetings) ? overview.recentMeetings : []);
      setClassPerformance(Array.isArray(overview.classPerformance) ? overview.classPerformance : []);
      setDosenPerformance(Array.isArray(overview.dosenPerformance) ? overview.dosenPerformance : []);
      setFocusTrends(Array.isArray(trendsRes.data) ? trendsRes.data : []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setStats(null);
      setRecentMeetings([]);
      setClassPerformance([]);
      setDosenPerformance([]);
      setFocusTrends([]);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    const fetchTrendsOnly = async () => {
      try {
        let url = `/api/dashboard/focus-trends?interval=${trendInterval}`;
        if (trendFilterType === 'mata_kuliah' && trendFilterValue) {
          const subject = subjects.find(s => s.nama === trendFilterValue);
          if (subject) {
            url += `&subjectId=${subject._id}`;
          }
        }
        const res = await axios.get(url);
        setFocusTrends(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error('Error fetching focus trends:', e);
        setFocusTrends([]);
      }
    };
    fetchTrendsOnly();
  }, [trendInterval, trendFilterType, trendFilterValue, subjects]);
  
  const fetchClasses = async () => {
    try {
      const res = await axios.get('/api/kelas');
      const raw = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : [];
      setClasses(raw.map((k: any) => ({ _id: k._id, nama_kelas: k.nama_kelas })));
    } catch (e) {
      console.error('Error fetching classes list:', e);
      setClasses([]);
    }
  };
  
  const fetchSubjects = async () => {
    try {
      const res = await axios.get('/api/mata-kuliah');
      const raw = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : [];
      setSubjects(raw.map((s: any) => ({ _id: s._id, nama: s.nama })));
    } catch (e) {
      console.error('Error fetching subjects list:', e);
      setSubjects([]);
    }
  };

  const statCards = [
    {
      title: 'Total Classes',
      value: stats?.totalKelas || 0,
      icon: GraduationCap,
      color: 'bg-blue-500',
      change: '+2.5%',
      bgGradient: 'from-blue-500 to-blue-600'
    },
    {
      title: 'Subjects',
      value: stats?.totalMataKuliah || 0,
      icon: BookOpen,
      color: 'bg-green-500',
      change: '+1.2%',
      bgGradient: 'from-green-500 to-green-600'
    },
    {
      title: 'Meetings',
      value: stats?.totalPertemuan || 0,
      icon: Calendar,
      color: 'bg-purple-500',
      change: '+12.3%',
      bgGradient: 'from-purple-500 to-purple-600'
    },
    {
      title: 'Average Focus',
      value: `${stats?.averageFocus || 0}%`,
      icon: TrendingUp,
      color: 'bg-orange-500',
      change: '+5.1%',
      bgGradient: 'from-orange-500 to-orange-600'
    }
  ];

  const pieData = classPerformance.slice(0, 5).map((item, index) => ({
    name: item._id,
    value: Math.round(item.averageFocus),
    color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][index]
  }));

  const dosenBarData = dosenPerformance.slice(0, 8).map(dosen => ({
    name: dosen.nama_lengkap.split(' ')[0], // First name only for chart
    focus: Math.round(dosen.averageFocus),
    meetings: dosen.totalMeetings
  }));
  
  const kondusifCount = classPerformance.filter(k => (k.averageFocus || 0) >= focusThreshold).length;
  const tidakKondusifCount = (classPerformance.length || 0) - kondusifCount;
  const kondusifPercent = classPerformance.length > 0 ? Math.round((kondusifCount / classPerformance.length) * 100) : 0;
  const tidakKondusifPercent = classPerformance.length > 0 ? Math.round((tidakKondusifCount / classPerformance.length) * 100) : 0;
  
  const sortedBestClasses = [...classPerformance].sort((a, b) => (b.averageFocus || 0) - (a.averageFocus || 0)).slice(0, 5);
  const sortedWorstClasses = [...classPerformance].sort((a, b) => (a.averageFocus || 0) - (b.averageFocus || 0)).slice(0, 5);
  
  const classIdByName: Record<string, string> = classes.reduce((acc, c) => {
    acc[c.nama_kelas] = c._id;
    return acc;
  }, {} as Record<string, string>);
  
  const computeTrendData = (): FocusTrend[] => {
    if (trendFilterType === 'all' || !trendFilterValue) {
      const len = trendInterval === 'month' ? periodMonths : periodWeeks;
      return focusTrends.slice(Math.max(0, focusTrends.length - len));
    }
    const filtered = recentMeetings.filter(m => 
      trendFilterType === 'kelas' 
        ? m.kelas === trendFilterValue 
        : trendFilterType === 'dosen' 
          ? m.dosen_id.nama_lengkap === trendFilterValue
          : m.mata_kuliah === trendFilterValue
    );
    if (trendInterval === 'month') {
      const end = new Date();
      const start = new Date();
      start.setMonth(end.getMonth() - (periodMonths - 1));
      const months: string[] = [];
      const tmp = new Date(start.getFullYear(), start.getMonth(), 1);
      while (tmp <= end) {
        months.push(`${tmp.getFullYear()}-${String(tmp.getMonth() + 1).padStart(2, '0')}`);
        tmp.setMonth(tmp.getMonth() + 1);
      }
      const bucket: Record<string, { sum: number; count: number }> = {};
      months.forEach(m => { bucket[m] = { sum: 0, count: 0 }; });
      filtered.forEach(m => {
        const d = new Date(m.tanggal);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!bucket[key]) bucket[key] = { sum: 0, count: 0 };
        bucket[key].sum += m.hasil_akhir_kelas.fokus || 0;
        bucket[key].count += 1;
      });
      return months.map(m => ({
        month: m,
        focus: bucket[m].count > 0 ? Math.round(bucket[m].sum / bucket[m].count) : 0,
        meetings: bucket[m].count
      }));
    } else {
      const end = new Date();
      const weeks: string[] = [];
      const len = periodWeeks;
      const getIsoWeek = (d: Date) => {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum = date.getUTCDay() || 7;
        date.setUTCDate(date.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
      };
      const tmp = new Date(end);
      for (let i = 0; i < len; i++) {
        weeks.unshift(getIsoWeek(tmp));
        tmp.setDate(tmp.getDate() - 7);
      }
      const bucket: Record<string, { sum: number; count: number }> = {};
      weeks.forEach(w => { bucket[w] = { sum: 0, count: 0 }; });
      filtered.forEach(m => {
        const d = new Date(m.tanggal);
        const key = getIsoWeek(d);
        if (!bucket[key]) bucket[key] = { sum: 0, count: 0 };
        bucket[key].sum += m.hasil_akhir_kelas.fokus || 0;
        bucket[key].count += 1;
      });
      return weeks.map(w => ({
        month: w,
        focus: bucket[w].count > 0 ? Math.round(bucket[w].sum / bucket[w].count) : 0,
        meetings: bucket[w].count
      }));
    }
  };
  
  const trendData = computeTrendData();
  
  const focusValues = recentMeetings.map(m => m.hasil_akhir_kelas.fokus || 0);
  const focusMean = focusValues.length ? focusValues.reduce((s, v) => s + v, 0) / focusValues.length : 0;
  const focusVariance = focusValues.length ? focusValues.reduce((s, v) => s + Math.pow(v - focusMean, 2), 0) / focusValues.length : 0;
  const focusStdDev = Math.round(Math.sqrt(focusVariance));
  const meetingsAboveThreshold = recentMeetings.filter(m => (m.hasil_akhir_kelas.fokus || 0) >= focusThreshold).length;
  const consistencyPercent = recentMeetings.length ? Math.round((meetingsAboveThreshold / recentMeetings.length) * 100) : 0;
  
  const flaggedClasses = [...classPerformance]
    .filter(k => (k.averageFocus || 0) < focusThreshold)
    .sort((a, b) => (a.averageFocus || 0) - (b.averageFocus || 0))
    .slice(0, 10);
  
  const exportFlaggedCSV = () => {
    const headers = ['Class','Average Focus','Meetings','Note'];
    const rows = flaggedClasses.map(k => {
      const note = (k.averageFocus || 0) < focusThreshold ? 'Below threshold' : '';
      return [k._id, Math.round(k.averageFocus || 0).toString(), (k.totalMeetings || 0).toString(), note];
    });
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flagged-classes.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-xl p-6 text-white"
      >
        <h1 className="text-2xl font-bold">Welcome back, {user?.nama_lengkap}!</h1>
        <p className="mt-2 opacity-90">
          {user?.role === 'admin' 
            ? "Here's an overview of the focus monitoring system performance."
            : "Here's what's happening with your classes today."
          }
        </p>
      </motion.div>

      {/* Executive Summary */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Executive Summary</h3>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-600">Focus Threshold</span>
            <input
              type="range"
              min={50}
              max={90}
              value={focusThreshold}
              onChange={(e) => setFocusThreshold(parseInt(e.target.value))}
              className="w-32"
            />
            <span className="text-sm font-medium text-gray-900">{focusThreshold}%</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Kelas Kondusif</p>
            <p className="text-2xl font-bold text-green-600">{kondusifPercent}%</p>
            <p className="text-xs text-gray-500">{kondusifCount} of {classPerformance.length}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Kelas Tidak Kondusif</p>
            <p className="text-2xl font-bold text-red-600">{tidakKondusifPercent}%</p>
            <p className="text-xs text-gray-500">{tidakKondusifCount} of {classPerformance.length}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Stabilitas</p>
            <p className="text-2xl font-bold text-gray-900">{focusStdDev}</p>
            <p className="text-xs text-gray-500">Std Dev Focus</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Konsistensi</p>
            <p className="text-2xl font-bold text-gray-900">{consistencyPercent}%</p>
            <p className="text-xs text-gray-500">Meetings ≥ threshold</p>
          </div>
        </div>
        {sortedWorstClasses.length > 0 && (
          <div className="mt-6">
            <p className="text-sm font-medium text-gray-900 mb-2">Kelas Bermasalah</p>
            <div className="space-y-2">
              {sortedWorstClasses.slice(0,3).map(kelas => (
                <div key={kelas._id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{kelas._id}</p>
                    <p className="text-xs text-gray-500">{kelas.totalMeetings} meetings</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-600">{Math.round(kelas.averageFocus)}%</p>
                    {classIdByName[kelas._id] && (
                      <Link to={`/classes/${classIdByName[kelas._id]}`} className="text-xs text-blue-600 hover:text-blue-500">
                        Detail
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <motion.div 
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                <p className="text-sm text-green-600 mt-1">{card.change}</p>
              </div>
              <div className={`bg-gradient-to-r ${card.bgGradient} p-3 rounded-lg`}>
                <card.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Focus Trends */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Focus Trends</h3>
            <div className="flex items-center space-x-2">
              <select
                value={trendInterval}
                onChange={(e) => setTrendInterval(e.target.value as 'month' | 'week')}
                className="text-sm border border-gray-300 rounded-md px-2 py-1"
              >
                <option value="week">Mingguan</option>
                <option value="month">Bulanan</option>
              </select>
              <select
                value={trendFilterType}
                onChange={(e) => { setTrendFilterType(e.target.value as 'all' | 'kelas' | 'dosen' | 'mata_kuliah'); setTrendFilterValue(''); }}
                className="text-sm border border-gray-300 rounded-md px-2 py-1"
              >
                <option value="all">All</option>
                <option value="kelas">By Class</option>
                <option value="dosen">By Instructor</option>
                <option value="mata_kuliah">By Subject</option>
              </select>
              {trendFilterType === 'kelas' && (
                <select
                  value={trendFilterValue}
                  onChange={(e) => setTrendFilterValue(e.target.value)}
                  className="text-sm border border-gray-300 rounded-md px-2 py-1"
                >
                  <option value="">Select Class</option>
                  {classes.map(c => (
                    <option key={c._id} value={c.nama_kelas}>{c.nama_kelas}</option>
                  ))}
                </select>
              )}
              {trendFilterType === 'dosen' && (
                <select
                  value={trendFilterValue}
                  onChange={(e) => setTrendFilterValue(e.target.value)}
                  className="text-sm border border-gray-300 rounded-md px-2 py-1"
                >
                  <option value="">Select Instructor</option>
                  {dosenPerformance.map(d => (
                    <option key={d._id} value={d.nama_lengkap}>{d.nama_lengkap}</option>
                  ))}
                </select>
              )}
              {trendFilterType === 'mata_kuliah' && (
                <select
                  value={trendFilterValue}
                  onChange={(e) => setTrendFilterValue(e.target.value)}
                  className="text-sm border border-gray-300 rounded-md px-2 py-1"
                >
                  <option value="">Select Subject</option>
                  {subjects.map(s => (
                    <option key={s._id} value={s.nama}>{s.nama}</option>
                  ))}
                </select>
              )}
              {trendInterval === 'month' ? (
                <select
                  value={periodMonths}
                  onChange={(e) => setPeriodMonths(parseInt(e.target.value))}
                  className="text-sm border border-gray-300 rounded-md px-2 py-1"
                >
                  <option value={3}>3m</option>
                  <option value={6}>6m</option>
                  <option value={12}>12m</option>
                </select>
              ) : (
                <select
                  value={periodWeeks}
                  onChange={(e) => setPeriodWeeks(parseInt(e.target.value))}
                  className="text-sm border border-gray-300 rounded-md px-2 py-1"
                >
                  <option value={4}>4w</option>
                  <option value={8}>8w</option>
                  <option value={12}>12w</option>
                </select>
              )}
              <BarChart3 className="h-5 w-5 text-gray-400" />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="focus" 
                stroke="#3B82F6" 
                strokeWidth={3}
                dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Class Performance */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Top Classes by Focus</h3>
            <Eye className="h-5 w-5 text-gray-400" />
          </div>
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
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {pieData.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                ></div>
                <span className="text-sm text-gray-600">{entry.name}: {entry.value}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Ranking Classes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Top 5 Paling Fokus</h3>
            <Target className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {sortedBestClasses.map((kelas, index) => (
              <div key={kelas._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${index === 0 ? 'bg-green-500' : 'bg-blue-500'}`}>
                    {index + 1}
                  </div>
                  <div className="ml-3">
                    <p className="font-medium text-gray-900">{kelas._id}</p>
                    <p className="text-sm text-gray-500">{kelas.totalMeetings} meetings</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">{Math.round(kelas.averageFocus)}%</p>
                  {classIdByName[kelas._id] && (
                    <Link to={`/classes/${classIdByName[kelas._id]}`} className="text-xs text-blue-600 hover:text-blue-500">
                      Detail
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Top 5 Paling Tidak Fokus</h3>
            <AlertCircle className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {sortedWorstClasses.map((kelas, index) => (
              <div key={kelas._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${index === 0 ? 'bg-red-500' : 'bg-orange-500'}`}>
                    {index + 1}
                  </div>
                  <div className="ml-3">
                    <p className="font-medium text-gray-900">{kelas._id}</p>
                    <p className="text-sm text-gray-500">{kelas.totalMeetings} meetings</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-red-600">{Math.round(kelas.averageFocus)}%</p>
                  {classIdByName[kelas._id] && (
                    <Link to={`/classes/${classIdByName[kelas._id]}`} className="text-xs text-blue-600 hover:text-blue-500">
                      Detail
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Instructor Performance (Admin Only) */}
      {user?.role === 'admin' && dosenPerformance.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Instructor Performance</h3>
            <Award className="h-5 w-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dosenBarData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="focus" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Performance Comparison (Admin Only) */}
      {user?.role === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Performing Classes */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Top Performing Classes</h3>
              <Target className="h-5 w-5 text-gray-400" />
            </div>
            <div className="space-y-4">
              {classPerformance.slice(0, 5).map((kelas, index) => (
                <div key={kelas._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                      index === 0 ? 'bg-yellow-500' : 
                      index === 1 ? 'bg-gray-400' : 
                      index === 2 ? 'bg-orange-500' : 'bg-blue-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="ml-3">
                      <p className="font-medium text-gray-900">{kelas._id}</p>
                      <p className="text-sm text-gray-500">{kelas.totalMeetings} meetings</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">{Math.round(kelas.averageFocus)}%</p>
                    <p className="text-xs text-gray-500">avg focus</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Top Performing Instructors */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Top Performing Instructors</h3>
              <Users className="h-5 w-5 text-gray-400" />
            </div>
            <div className="space-y-4">
              {dosenPerformance.slice(0, 5).map((dosen, index) => (
                <div key={dosen._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                      index === 0 ? 'bg-yellow-500' : 
                      index === 1 ? 'bg-gray-400' : 
                      index === 2 ? 'bg-orange-500' : 'bg-blue-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="ml-3">
                      <p className="font-medium text-gray-900">{dosen.nama_lengkap}</p>
                      <p className="text-sm text-gray-500">{dosen.totalMeetings} meetings, {dosen.totalClasses} classes</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">{Math.round(dosen.averageFocus)}%</p>
                    <p className="text-xs text-gray-500">avg focus</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* Recent Meetings */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200"
      >
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Recent Meetings</h3>
            <Clock className="h-5 w-5 text-gray-400" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Meeting
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Class
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subject
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Instructor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Focus Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentMeetings.map((meeting) => (
                <tr key={meeting._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Meeting {meeting.pertemuan_ke}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {meeting.kelas}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {meeting.mata_kuliah}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {meeting.dosen_id.nama_lengkap}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2 max-w-20">
                        <div 
                          className={`h-2 rounded-full ${
                            meeting.hasil_akhir_kelas.fokus >= 80 ? 'bg-green-500' :
                            meeting.hasil_akhir_kelas.fokus >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${meeting.hasil_akhir_kelas.fokus}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {Math.round(meeting.hasil_akhir_kelas.fokus)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(meeting.tanggal).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
      
      {/* KPI & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">KPI & Indikator</h3>
            <TrendingUp className="h-5 w-5 text-gray-400" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Focus Rate</p>
              <p className="text-2xl font-bold text-gray-900">{Math.round(stats?.averageFocus || 0)}%</p>
              <p className="text-xs text-gray-500">Persentase fokus rata-rata</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Threshold</p>
              <p className="text-2xl font-bold text-gray-900">{focusThreshold}%</p>
              <p className="text-xs text-gray-500">Batas kondusif</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Stabilitas</p>
              <p className="text-2xl font-bold text-gray-900">{focusStdDev}</p>
              <p className="text-xs text-gray-500">Variasi fokus antar pertemuan</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Konsistensi</p>
              <p className="text-2xl font-bold text-gray-900">{consistencyPercent}%</p>
              <p className="text-xs text-gray-500">Proporsi pertemuan di atas threshold</p>
            </div>
          </div>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Insight & Evaluasi</h3>
            <button
              onClick={exportFlaggedCSV}
              className="px-3 py-1 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Export CSV
            </button>
          </div>
          {flaggedClasses.length === 0 ? (
            <p className="text-sm text-gray-600">Tidak ada kelas yang diflag saat ini.</p>
          ) : (
            <div className="space-y-3">
              {flaggedClasses.map(kelas => (
                <div key={kelas._id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{kelas._id}</p>
                    <p className="text-xs text-gray-500">Rata-rata fokus {Math.round(kelas.averageFocus)}%</p>
                  </div>
                  <div className="text-right">
                    {classIdByName[kelas._id] && (
                      <Link to={`/classes/${classIdByName[kelas._id]}`} className="text-xs text-blue-600 hover:text-blue-500">
                        Lihat Detail
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
