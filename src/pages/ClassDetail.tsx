import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Users, Calendar, GraduationCap, BarChart3, Download } from 'lucide-react';
import toast from 'react-hot-toast';

interface Student {
  id_mahasiswa: string;
  nama: string;
}

interface Kelas {
  _id: string;
  nama_kelas: string;
  mahasiswa: Student[];
  jumlah_mahasiswa: number;
  tahun_ajaran: string;
  semester: string;
  createdAt: string;
}

interface Meeting {
  _id: string;
  tanggal: string;
  pertemuan_ke: number;
  mata_kuliah: string;
  hasil_akhir_kelas: {
    fokus: number;
    tidak_fokus: number;
    jumlah_hadir: number;
  };
  dosen_id: {
    nama_lengkap: string;
  };
}

export default function ClassDetail() {
  const { id } = useParams<{ id: string }>();
  const [kelas, setKelas] = useState<Kelas | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchClassDetail();
      fetchClassMeetings();
    }
  }, [id]);

  const fetchClassDetail = async () => {
    try {
      const response = await axios.get(`/kelas/${id}`);
      setKelas(response.data);
    } catch (error) {
      console.error('Error fetching class detail:', error);
      toast.error('Failed to fetch class details');
    }
  };

  const fetchClassMeetings = async () => {
    try {
      const response = await axios.get('/pertemuan', {
        params: { kelas: kelas?.nama_kelas }
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
      const response = await axios.get(`/export/pdf/class/${id}`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `class-${kelas?.nama_kelas || 'unknown'}-report.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('PDF exported successfully');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!kelas) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Class not found</h3>
        <Link to="/classes" className="text-blue-600 hover:text-blue-500">
          Back to Classes
        </Link>
      </div>
    );
  }

  const averageFocus = meetings.length > 0 
    ? meetings.reduce((sum, meeting) => sum + meeting.hasil_akhir_kelas.fokus, 0) / meetings.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link 
            to="/classes"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{kelas.nama_kelas}</h1>
            <p className="text-sm text-gray-500">{kelas.tahun_ajaran} - {kelas.semester}</p>
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
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Students</p>
              <p className="text-2xl font-bold text-gray-900">{kelas.jumlah_mahasiswa}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Calendar className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Meetings</p>
              <p className="text-2xl font-bold text-gray-900">{meetings.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Focus Rate</p>
              <p className="text-2xl font-bold text-gray-900">{Math.round(averageFocus)}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <GraduationCap className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Class Created</p>
              <p className="text-sm font-bold text-gray-900">
                {new Date(kelas.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Students List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Students</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {kelas.mahasiswa.map((student) => (
              <div key={student.id_mahasiswa} className="flex items-center p-3 bg-gray-50 rounded-lg">
                <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-blue-600">
                    {student.id_mahasiswa.slice(-2)}
                  </span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">{student.id_mahasiswa}</p>
                  <p className="text-xs text-gray-500">{student.nama || 'Student'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Meetings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Meetings</h3>
        </div>
        {meetings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Meeting</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Instructor</th>
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
                      {meeting.mata_kuliah}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {meeting.dosen_id.nama_lengkap}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2 max-w-20">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
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
            <p className="text-gray-500">Meetings for this class will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}