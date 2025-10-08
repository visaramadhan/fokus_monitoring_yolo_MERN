import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Calendar, Clock, Users, BarChart3, Eye, EyeOff, Download } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import toast from 'react-hot-toast';

interface StudentFocus {
  id_siswa: string;
  fokus: number[];
  jumlah_sesi_fokus: number;
  durasi_fokus: number;
  waktu_hadir: number;
  persen_fokus: number;
  persen_tidak_fokus: number;
  status: string;
}

interface Meeting {
  _id: string;
  tanggal: string;
  pertemuan_ke: number;
  kelas: string;
  mata_kuliah: string;
  mata_kuliah_id: {
    nama: string;
    kode: string;
    sks: number;
  };
  dosen_id: {
    nama_lengkap: string;
    email: string;
    departemen: string;
  };
  durasi_pertemuan: number;
  topik: string;
  data_fokus: StudentFocus[];
  hasil_akhir_kelas: {
    fokus: number;
    tidak_fokus: number;
    jumlah_hadir: number;
  };
  catatan: string;
  createdAt: string;
}

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllStudents, setShowAllStudents] = useState(false);

  useEffect(() => {
    if (id) {
      fetchMeetingDetail();
    }
  }, [id]);

  const fetchMeetingDetail = async () => {
    try {
      const response = await axios.get(`/pertemuan/${id}`);
      setMeeting(response.data);
    } catch (error) {
      console.error('Error fetching meeting detail:', error);
      toast.error('Failed to fetch meeting details');
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = async () => {
    try {
      const response = await axios.get(`/export/pdf/meeting/${id}`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = meeting ? `meeting-${meeting.pertemuan_ke}-${meeting.mata_kuliah}-report.pdf` : 'meeting-report.pdf';
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
      const response = await axios.get(`/export/excel/meeting/${id}`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = meeting ? `meeting-${meeting.pertemuan_ke}-${meeting.mata_kuliah}-report.xlsx` : 'meeting-report.xlsx';
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

  if (!meeting) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Meeting not found</h3>
        <Link to="/meetings" className="text-blue-600 hover:text-blue-500">
          Back to Meetings
        </Link>
      </div>
    );
  }

  const pieData = [
    { name: 'Focused', value: meeting.hasil_akhir_kelas.fokus, color: '#10B981' },
    { name: 'Not Focused', value: meeting.hasil_akhir_kelas.tidak_fokus, color: '#EF4444' }
  ];

  const statusData = meeting.data_fokus.reduce((acc, student) => {
    acc[student.status] = (acc[student.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusChartData = Object.entries(statusData).map(([status, count]) => ({
    status,
    count,
    color: status === 'Baik' ? '#10B981' : status === 'Cukup' ? '#F59E0B' : '#EF4444'
  }));

  const displayedStudents = showAllStudents ? meeting.data_fokus : meeting.data_fokus.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link 
            to="/meetings"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Meeting {meeting.pertemuan_ke} - {meeting.mata_kuliah}
            </h1>
            <p className="text-sm text-gray-500">{meeting.kelas} • {new Date(meeting.tanggal).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={exportToPDF}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </button>
          <button
            onClick={exportToExcel}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Meeting Info Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Meeting Information</h3>
            <div className="space-y-3">
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(meeting.tanggal).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                  <p className="text-sm text-gray-500">Meeting Date</p>
                </div>
              </div>
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{meeting.durasi_pertemuan} minutes</p>
                  <p className="text-sm text-gray-500">Duration</p>
                </div>
              </div>
              <div className="flex items-center">
                <Users className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{meeting.hasil_akhir_kelas.jumlah_hadir} students</p>
                  <p className="text-sm text-gray-500">Attendance</p>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Subject & Instructor</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{meeting.mata_kuliah}</p>
                <p className="text-sm text-gray-500">{meeting.mata_kuliah_id.kode} - {meeting.mata_kuliah_id.sks} SKS</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{meeting.dosen_id.nama_lengkap}</p>
                <p className="text-sm text-gray-500">{meeting.dosen_id.departemen}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{meeting.kelas}</p>
                <p className="text-sm text-gray-500">Class</p>
              </div>
            </div>
          </div>
        </div>
        
        {meeting.topik && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Topic</h3>
            <p className="text-gray-600">{meeting.topik}</p>
          </div>
        )}
        
        {meeting.catatan && (
          <div className="mt-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Notes</h3>
            <p className="text-gray-600">{meeting.catatan}</p>
          </div>
        )}
      </div>

      {/* Focus Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overall Focus Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Focus Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${Math.round(value as number)}%`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center space-x-6 mt-4">
            {pieData.map((entry, index) => (
              <div key={index} className="flex items-center">
                <div 
                  className="w-3 h-3 rounded-full mr-2" 
                  style={{ backgroundColor: entry.color }}
                ></div>
                <span className="text-sm text-gray-600">
                  {entry.name}: {Math.round(entry.value)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Student Status Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Student Status Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={statusChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="status" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Student Focus Details */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Student Focus Details</h3>
          <button
            onClick={() => setShowAllStudents(!showAllStudents)}
            className="inline-flex items-center px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-500"
          >
            {showAllStudents ? (
              <>
                <EyeOff className="h-4 w-4 mr-1" />
                Show Less
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-1" />
                Show All ({meeting.data_fokus.length})
              </>
            )}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Focus Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Focus Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sessions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Focus Pattern</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayedStudents.map((student) => (
                <tr key={student.id_siswa} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {student.id_siswa}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2 max-w-20">
                        <div 
                          className={`h-2 rounded-full ${
                            student.persen_fokus >= 80 ? 'bg-green-500' :
                            student.persen_fokus >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${student.persen_fokus}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {student.persen_fokus}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {student.durasi_fokus} / {student.waktu_hadir} min
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {student.jumlah_sesi_fokus} / {student.fokus.length}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      student.status === 'Baik' ? 'bg-green-100 text-green-800' :
                      student.status === 'Cukup' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {student.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-1">
                      {student.fokus.map((focus, index) => (
                        <div
                          key={index}
                          className={`w-3 h-3 rounded-sm ${
                            focus === 1 ? 'bg-green-500' : 'bg-red-300'
                          }`}
                          title={`Session ${index + 1}: ${focus === 1 ? 'Focused' : 'Not Focused'}`}
                        ></div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}