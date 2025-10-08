import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
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
  Target
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
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [overviewRes, trendsRes] = await Promise.all([
        axios.get('/dashboard/overview'),
        axios.get('/dashboard/focus-trends')
      ]);

      setStats(overviewRes.data.stats);
      setRecentMeetings(overviewRes.data.recentMeetings);
      setClassPerformance(overviewRes.data.classPerformance);
      setDosenPerformance(overviewRes.data.dosenPerformance || []);
      setFocusTrends(trendsRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
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
            <BarChart3 className="h-5 w-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={focusTrends}>
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
    </div>
  );
}