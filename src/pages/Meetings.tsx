import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Plus, Search, Calendar, Eye, Edit, Trash2, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

interface Meeting {
  _id: string;
  tanggal: string;
  pertemuan_ke: number;
  kelas: string;
  mata_kuliah: string;
  mata_kuliah_id: {
    nama: string;
    kode: string;
  };
  dosen_id: {
    nama_lengkap: string;
  };
  durasi_pertemuan: number;
  topik: string;
  hasil_akhir_kelas: {
    fokus: number;
    tidak_fokus: number;
    jumlah_hadir: number;
  };
  catatan: string;
  createdAt: string;
}

export default function Meetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      const response = await axios.get('/pertemuan');
      setMeetings(response.data);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      toast.error('Failed to fetch meetings');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this meeting?')) {
      try {
        await axios.delete(`/pertemuan/${id}`);
        toast.success('Meeting deleted successfully');
        fetchMeetings();
      } catch (error) {
        console.error('Error deleting meeting:', error);
        toast.error('Failed to delete meeting');
      }
    }
  };

  const filteredMeetings = meetings.filter(meeting => {
    const matchesSearch = meeting.mata_kuliah.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         meeting.kelas.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         meeting.topik.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = !filterClass || meeting.kelas === filterClass;
    const matchesSubject = !filterSubject || meeting.mata_kuliah === filterSubject;
    
    return matchesSearch && matchesClass && matchesSubject;
  });

  const uniqueClasses = [...new Set(meetings.map(m => m.kelas))];
  const uniqueSubjects = [...new Set(meetings.map(m => m.mata_kuliah))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
     
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meetings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage class meetings and focus monitoring sessions
          </p>
        </div>
        <Link
          to="/meetings/create"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Meeting
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-4">
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 mb-2"
        >
          <Filter className="h-4 w-4 mr-2 text-blue-500" />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>
        
        {showFilters && (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
              <Filter className="h-4 w-4 mr-2 text-blue-500" />
              Advanced Filters
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Search meetings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">All Classes</option>
                {uniqueClasses.map(kelas => (
                  <option key={kelas} value={kelas}>{kelas}</option>
                ))}
              </select>

              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">All Subjects</option>
                {uniqueSubjects.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>

              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterClass('');
                  setFilterSubject('');
                }}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Filter className="h-4 w-4 mr-2" />
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Meetings Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Meeting
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subject
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Class
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Instructor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Focus Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Attendance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMeetings.map((meeting) => (
                <tr key={meeting._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-100 rounded-lg mr-3">
                        <Calendar className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          Meeting {meeting.pertemuan_ke}
                        </div>
                        <div className="text-sm text-gray-500">
                          {meeting.durasi_pertemuan} minutes
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{meeting.mata_kuliah}</div>
                    <div className="text-sm text-gray-500">{meeting.mata_kuliah_id?.kode}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {meeting.kelas}
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {meeting.hasil_akhir_kelas.jumlah_hadir} students
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(meeting.tanggal).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <Link
                        to={`/meetings/${meeting._id}`}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(meeting._id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredMeetings.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No meetings found</h3>
          <p className="text-gray-500">
            {meetings.length === 0 
              ? "Get started by creating your first meeting."
              : "Try adjusting your search or filter criteria."
            }
          </p>
        </div>
      )}
    </div>
  );
}