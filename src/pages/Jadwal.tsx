import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Calendar, Clock, Users, BookOpen, Eye, Edit, Trash2, User } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

interface Schedule {
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
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  createdAt: string;
}

interface Subject {
  _id: string;
  nama: string;
  kode: string;
  kelas: string[];
  dosen_id: {
    _id: string;
    nama_lengkap: string;
  };
}

export default function Jadwal() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  useEffect(() => {
    fetchSchedules();
    fetchSubjects();
  }, []);

  const fetchSchedules = async () => {
    try {
      const response = await axios.get('/jadwal');
      setSchedules(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      toast.error('Failed to fetch schedules');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async () => {
    try {
      const response = await axios.get('/mata-kuliah');
      setSubjects(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching subjects:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this schedule?')) {
      try {
        await axios.delete(`/jadwal/${id}`);
        toast.success('Schedule deleted successfully');
        fetchSchedules();
      } catch (error) {
        console.error('Error deleting schedule:', error);
        toast.error('Failed to delete schedule');
      }
    }
  };

  const filteredSchedules = Array.isArray(schedules) ? schedules.filter(schedule => {
    const matchesSearch = schedule.mata_kuliah.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         schedule.kelas.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         schedule.topik.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filter by user role
    if (user?.role === 'dosen') {
      return matchesSearch && schedule.dosen_id === user.id;
    }
    
    return matchesSearch;
  }) : [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'ongoing': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Class Schedule</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage class schedules and meeting times
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Schedule
        </motion.button>
      </motion.div>
      
      {/* Stats Overview */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <div className="bg-white p-4 rounded-lg shadow flex items-center space-x-4">
          <div className="bg-blue-100 p-3 rounded-full">
            <Calendar className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Schedules</p>
            <p className="text-xl font-semibold">{schedules.length}</p>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow flex items-center space-x-4">
          <div className="bg-green-100 p-3 rounded-full">
            <Clock className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Upcoming</p>
            <p className="text-xl font-semibold">
              {schedules.filter(s => s.status === 'scheduled').length}
            </p>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow flex items-center space-x-4">
          <div className="bg-purple-100 p-3 rounded-full">
            <Users className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Classes</p>
            <p className="text-xl font-semibold">
              {Array.from(new Set(schedules.map(s => s.kelas))).length}
            </p>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow flex items-center space-x-4">
          <div className="bg-amber-100 p-3 rounded-full">
            <BookOpen className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Subjects</p>
            <p className="text-xl font-semibold">
              {Array.from(new Set(schedules.map(s => s.mata_kuliah_id))).length}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Search */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative max-w-md"
      >
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          placeholder="Search schedules..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </motion.div>

      {/* Schedule Grid */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {filteredSchedules.map((schedule) => (
          <motion.div 
            key={schedule._id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  <div className="p-2 bg-blue-100 rounded-lg mr-3">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{schedule.mata_kuliah}</h3>
                    <p className="text-sm text-gray-500">{schedule.kelas}</p>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    <span>{schedule.dosen_name}</span>
                  </div>
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    <span>{new Date(schedule.tanggal).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    <span>{schedule.jam_mulai} - {schedule.jam_selesai}</span>
                  </div>
                  <div>
                    <span className="font-medium">Meeting:</span> {schedule.pertemuan_ke}
                  </div>
                  <div>
                    <span className="font-medium">Duration:</span> {schedule.durasi} minutes
                  </div>
                  {schedule.ruangan && (
                    <div>
                      <span className="font-medium">Room:</span> {schedule.ruangan}
                    </div>
                  )}
                </div>
                
                {schedule.topik && (
                  <p className="text-sm text-gray-500 mt-3 line-clamp-2">
                    <span className="font-medium">Topic:</span> {schedule.topik}
                  </p>
                )}
                
                <div className="flex items-center justify-between mt-4">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(schedule.status)}`}>
                    {schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)}
                  </span>
                  <div className="text-xs text-gray-500">
                    {new Date(schedule.createdAt).toLocaleDateString()}
                  </div>
                </div>
                
                <div className="flex items-center mt-3 text-sm text-gray-600">
                  <User className="h-4 w-4 mr-1 text-gray-500" />
                  <span>{schedule.dosen_name}</span>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 ml-4">
                <button
                  onClick={() => setEditingSchedule(schedule)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(schedule._id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {filteredSchedules.length === 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No schedules found</h3>
          <p className="text-gray-500">Get started by creating your first schedule.</p>
        </motion.div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingSchedule) && (
        <ScheduleModal
          schedule={editingSchedule}
          subjects={subjects}
          onClose={() => {
            setShowCreateModal(false);
            setEditingSchedule(null);
          }}
          onSuccess={() => {
            fetchSchedules();
            setShowCreateModal(false);
            setEditingSchedule(null);
          }}
        />
      )}
    </div>
  );
}

interface ScheduleModalProps {
  schedule: Schedule | null;
  subjects: Subject[];
  onClose: () => void;
  onSuccess: () => void;
}

function ScheduleModal({ schedule, subjects, onClose, onSuccess }: ScheduleModalProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    mata_kuliah_id: schedule?.mata_kuliah_id || '',
    kelas: schedule?.kelas || '',
    tanggal: schedule?.tanggal?.split('T')[0] || new Date().toISOString().split('T')[0],
    jam_mulai: schedule?.jam_mulai || '08:00',
    jam_selesai: schedule?.jam_selesai || '09:40',
    pertemuan_ke: schedule?.pertemuan_ke || 1,
    topik: schedule?.topik || '',
    ruangan: schedule?.ruangan || '',
    status: schedule?.status || 'scheduled'
  });
  const [loading, setLoading] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  useEffect(() => {
    if (formData.mata_kuliah_id) {
      const subject = subjects.find(s => s._id === formData.mata_kuliah_id);
      setSelectedSubject(subject || null);
    }
  }, [formData.mata_kuliah_id, subjects]);

  useEffect(() => {
    // Calculate duration when times change
    if (formData.jam_mulai && formData.jam_selesai) {
      const start = new Date(`2000-01-01T${formData.jam_mulai}`);
      const end = new Date(`2000-01-01T${formData.jam_selesai}`);
      const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
      if (duration > 0) {
        setFormData(prev => ({ ...prev, durasi: duration }));
      }
    }
  }, [formData.jam_mulai, formData.jam_selesai]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const subject = subjects.find(s => s._id === formData.mata_kuliah_id);
      if (!subject) {
        toast.error('Please select a valid subject');
        return;
      }

      // Calculate duration
      const start = new Date(`2000-01-01T${formData.jam_mulai}`);
      const end = new Date(`2000-01-01T${formData.jam_selesai}`);
      const durasi = Math.round((end.getTime() - start.getTime()) / (1000 * 60));

      const payload = {
        ...formData,
        mata_kuliah: subject.nama,
        dosen_id: subject.dosen_id._id,
        dosen_name: subject.dosen_id.nama_lengkap,
        durasi
      };

      if (schedule) {
        await axios.put(`/jadwal/${schedule._id}`, payload);
        toast.success('Schedule updated successfully');
      } else {
        await axios.post('/jadwal', payload);
        toast.success('Schedule created successfully');
      }
      
      onSuccess();
    } catch (error: any) {
      console.error('Error saving schedule:', error);
      toast.error(error.response?.data?.message || 'Failed to save schedule');
    } finally {
      setLoading(false);
    }
  };

  // Filter subjects based on user role
  const availableSubjects = user?.role === 'dosen' 
    ? subjects.filter(s => s.dosen_id._id === user.id)
    : subjects;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {schedule ? 'Edit Schedule' : 'Create New Schedule'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Subject</label>
              <select
                value={formData.mata_kuliah_id}
                onChange={(e) => setFormData({ ...formData, mata_kuliah_id: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              >
                <option value="">Select Subject</option>
                {availableSubjects.map((subject) => (
                  <option key={subject._id} value={subject._id}>
                    {subject.nama} ({subject.kode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Class</label>
              <select
                value={formData.kelas}
                onChange={(e) => setFormData({ ...formData, kelas: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
                disabled={!selectedSubject}
              >
                <option value="">Select Class</option>
                {selectedSubject?.kelas.map((kelas) => (
                  <option key={kelas} value={kelas}>
                    {kelas}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Date</label>
              <input
                type="date"
                value={formData.tanggal}
                onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Start Time</label>
                <input
                  type="time"
                  value={formData.jam_mulai}
                  onChange={(e) => setFormData({ ...formData, jam_mulai: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">End Time</label>
                <input
                  type="time"
                  value={formData.jam_selesai}
                  onChange={(e) => setFormData({ ...formData, jam_selesai: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Meeting Number</label>
              <input
                type="number"
                min="1"
                value={formData.pertemuan_ke}
                onChange={(e) => setFormData({ ...formData, pertemuan_ke: parseInt(e.target.value) })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Topic</label>
              <input
                type="text"
                value={formData.topik}
                onChange={(e) => setFormData({ ...formData, topik: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter meeting topic"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Room</label>
              <input
                type="text"
                value={formData.ruangan}
                onChange={(e) => setFormData({ ...formData, ruangan: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter room number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="scheduled">Scheduled</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'Saving...' : (schedule ? 'Update' : 'Create')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}