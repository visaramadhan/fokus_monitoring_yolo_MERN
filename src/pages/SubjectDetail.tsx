import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, User, Calendar, GraduationCap, BarChart3, Download, FileText } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import toast from 'react-hot-toast';

interface MataKuliah {
  _id: string;
  nama: string;
  kode: string;
  sks: number;
  dosen_id: {
    _id: string;
    nama_lengkap: string;
    email: string;
    departemen: string;
  };
  kelas: string[];
  semester: number;
  deskripsi: string;
  createdAt: string;
}

interface Meeting {
  _id: string;
  tanggal: string;
  pertemuan_ke: number;
  kelas: string;
  hasil_akhir_kelas: {
    fokus: number;
    tidak_fokus: number;
    jumlah_hadir: number;
  };
  topik: string;
}

export default function SubjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [subject, setSubject] = useState<MataKuliah | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchSubjectDetail();
      fetchSubjectMeetings();
    }
  }, [id]);

  const fetchSubjectDetail = async () => {
    try {
      const response = await axios.get(`/mata-kuliah/${id}`);
      setSubject(response.data);
    } catch (error) {
      console.error('Error fetching subject detail:', error);
      toast.error('Failed to fetch subject details');
    }
  };

  const fetchSubjectMeetings = async () => {
    try {
      const response = await axios.get('/pertemuan', {
        params: { mata_kuliah_id: id }
      });
      setMeetings(response.data);
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = async () => {
    try {
      const response = await axios.get(`/api/export/pdf/subject/${id}`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `subject-${subject?.nama}-report.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('PDF exported successfully');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF');
    }
  };

  const exportToExcel = async () => {
    try {
      const response = await axios.get(`/api/export/excel/subject/${id}`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `subject-${subject?.nama}-data.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('Excel exported successfully');
    } catch (error) {
      console.error('Error exporting Excel:', error);
      toast.error('Failed to export Excel');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Subject not found</h3>
        <Link to="/mata-kuliah" className="text-blue-600 hover:text-blue-500">
          Back to Mata Kuliah
        </Link>
      </div>
    );
  }

  const averageFocus = meetings.length > 0 
    ? meetings.reduce((sum, meeting) => sum + meeting.hasil_akhir_kelas.fokus, 0) / meetings.length
    : 0;

  const totalStudents = meetings.length > 0
    ? Math.max(...meetings.map(m => m.hasil_akhir_kelas.jumlah_hadir))
    : 0;

  // Prepare chart data
  const focusTrendData = meetings.map(meeting => ({
    meeting: `M${meeting.pertemuan_ke}`,
    focus: Math.round(meeting.hasil_akhir_kelas.fokus),
    attendance: meeting.hasil_akhir_kelas.jumlah_hadir,
    date: new Date(meeting.tanggal).toLocaleDateString()
  })).sort((a, b) => parseInt(a.meeting.slice(1)) - parseInt(b.meeting.slice(1)));

  const classPerformanceData = subject.kelas.map(kelas => {
    const classMeetings = meetings.filter(m => m.kelas === kelas);
    const avgFocus = classMeetings.length > 0 
      ? classMeetings.reduce((sum, m) => sum + m.hasil_akhir_kelas.fokus, 0) / classMeetings.length
      : 0;
    
    return {
      class: kelas,
      focus: Math.round(avgFocus),
      meetings: classMeetings.length
    };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center space-x-4">
          <Link 
            to="/mata-kuliah"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{subject.nama}</h1>
            <p className="text-sm text-gray-500">{subject.kode} - {subject.sks} SKS</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={exportToExcel}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={exportToPDF}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
          >
            <FileText className="h-4 w-4 mr-2" />
            Export PDF
          </motion.button>
        </div>
      </motion.div>

      {/* Subject Info Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Subject Information</h3>
            <div className="space-y-3">
              <div className="flex items-center">
                <BookOpen className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{subject.nama}</p>
                  <p className="text-sm text-gray-500">Subject Name</p>
                </div>
              </div>
              <div className="flex items-center">
                <div className="h-5 w-5 text-gray-400 mr-3 flex items-center justify-center">
                  <span className="text-xs font-bold">#</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{subject.kode}</p>
                  <p className="text-sm text-gray-500">Subject Code</p>
                </div>
              </div>
              <div className="flex items-center">
                <GraduationCap className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{subject.sks} SKS</p>
                  <p className="text-sm text-gray-500">Credit Hours</p>
                </div>
              </div>
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Semester {subject.semester}</p>
                  <p className="text-sm text-gray-500">Academic Semester</p>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Instructor Information</h3>
            <div className="space-y-3">
              <div className="flex items-center">
                <User className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{subject.dosen_id.nama_lengkap}</p>
                  <p className="text-sm text-gray-500">Full Name</p>
                </div>
              </div>
              <div className="flex items-center">
                <div className="h-5 w-5 text-gray-400 mr-3 flex items-center justify-center">
                  <span className="text-xs">@</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{subject.dosen_id.email}</p>
                  <p className="text-sm text-gray-500">Email</p>
                </div>
              </div>
              <div className="flex items-center">
                <div className="h-5 w-5 text-gray-400 mr-3 flex items-center justify-center">
                  <span className="text-xs">🏢</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{subject.dosen_id.departemen}</p>
                  <p className="text-sm text-gray-500">Department</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {subject.deskripsi && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
            <p className="text-gray-600">{subject.deskripsi}</p>
          </div>
        )}
        
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Classes</h3>
          <div className="flex flex-wrap gap-2">
            {subject.kelas.map((kelas, index) => (
              <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                {kelas}
              </span>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Meetings</p>
              <p className="text-2xl font-bold text-gray-900">{meetings.length}</p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <User className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Max Students</p>
              <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Focus Rate</p>
              <p className="text-2xl font-bold text-gray-900">{Math.round(averageFocus)}%</p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <GraduationCap className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Classes Count</p>
              <p className="text-2xl font-bold text-gray-900">{subject.kelas.length}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Focus Trend Chart */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Focus Trend by Meeting</h3>
            <BarChart3 className="h-5 w-5 text-gray-400" />
          </div>
          {focusTrendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={focusTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="meeting" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'focus' ? `${value}%` : value,
                    name === 'focus' ? 'Focus Rate' : 'Attendance'
                  ]}
                />
                <Line 
                  type="monotone" 
                  dataKey="focus" 
                  stroke="#3B82F6" 
                  strokeWidth={3}
                  dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              <div className="text-center">
                <BarChart3 className="h-8 w-8 mx-auto mb-2" />
                <p>No meeting data available</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Class Performance Chart */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Performance by Class</h3>
            <GraduationCap className="h-5 w-5 text-gray-400" />
          </div>
          {classPerformanceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={classPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="class" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'focus' ? `${value}%` : value,
                    name === 'focus' ? 'Avg Focus' : 'Meetings'
                  ]}
                />
                <Bar dataKey="focus" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              <div className="text-center">
                <GraduationCap className="h-8 w-8 mx-auto mb-2" />
                <p>No class data available</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Meetings List */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200"
      >
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Meeting History</h3>
          <div className="flex items-center space-x-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={exportToExcel}
              className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
            >
              <Download className="h-3 w-3 mr-1" />
              Excel
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={exportToPDF}
              className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700"
            >
              <FileText className="h-3 w-3 mr-1" />
              PDF
            </motion.button>
          </div>
        </div>
        {meetings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Meeting</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Topic</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Focus Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attendance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {meetings.slice(0, 10).map((meeting) => (
                  <tr key={meeting._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Meeting {meeting.pertemuan_ke}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {meeting.kelas}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {meeting.topik || 'No topic'}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {meeting.hasil_akhir_kelas.jumlah_hadir}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(meeting.tanggal).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No meetings yet</h3>
            <p className="text-gray-500">Meetings for this subject will appear here.</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}