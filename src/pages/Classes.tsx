import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Plus, Search, Users, Eye, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Kelas {
  _id: string;
  nama_kelas: string;
  mahasiswa: Array<{
    id_mahasiswa: string;
    nama: string;
  }>;
  jumlah_mahasiswa: number;
  tahun_ajaran: string;
  semester: string;
  createdAt: string;
}

export default function Classes() {
  const [classes, setClasses] = useState<Kelas[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingClass, setEditingClass] = useState<Kelas | null>(null);

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const response = await axios.get('/kelas');
      setClasses(response.data);
    } catch (error) {
      console.error('Error fetching classes:', error);
      toast.error('Failed to fetch classes');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this class?')) {
      try {
        await axios.delete(`/kelas/${id}`);
        toast.success('Class deleted successfully');
        fetchClasses();
      } catch (error) {
        console.error('Error deleting class:', error);
        toast.error('Failed to delete class');
      }
    }
  };

  const filteredClasses = classes.filter(kelas =>
    kelas.nama_kelas.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage student classes and their members
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Class
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          placeholder="Search classes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Classes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClasses.map((kelas) => (
          <div key={kelas._id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{kelas.nama_kelas}</h3>
                <p className="text-sm text-gray-500 mt-1">{kelas.tahun_ajaran} - {kelas.semester}</p>
                
                <div className="flex items-center mt-4 text-sm text-gray-600">
                  <Users className="h-4 w-4 mr-2" />
                  <span>{kelas.jumlah_mahasiswa} students</span>
                </div>
                
                <div className="text-xs text-gray-500 mt-2">
                  Created: {new Date(kelas.createdAt).toLocaleDateString()}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Link
                  to={`/classes/${kelas._id}`}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Eye className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => setEditingClass(kelas)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(kelas._id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredClasses.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No classes found</h3>
          <p className="text-gray-500">Get started by creating your first class.</p>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingClass) && (
        <ClassModal
          kelas={editingClass}
          onClose={() => {
            setShowCreateModal(false);
            setEditingClass(null);
          }}
          onSuccess={() => {
            fetchClasses();
            setShowCreateModal(false);
            setEditingClass(null);
          }}
        />
      )}
    </div>
  );
}

interface ClassModalProps {
  kelas: Kelas | null;
  onClose: () => void;
  onSuccess: () => void;
}

function ClassModal({ kelas, onClose, onSuccess }: ClassModalProps) {
  const [formData, setFormData] = useState({
    nama_kelas: kelas?.nama_kelas || '',
    tahun_ajaran: kelas?.tahun_ajaran || '2024/2025',
    semester: kelas?.semester || 'Ganjil',
    jumlah_mahasiswa: kelas?.jumlah_mahasiswa || 30
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Generate students array
      const mahasiswa = [];
      for (let i = 1; i <= formData.jumlah_mahasiswa; i++) {
        mahasiswa.push({
          id_mahasiswa: `${formData.nama_kelas.replace(/[^A-Z0-9]/g, '')}${i.toString().padStart(3, '0')}`,
          nama: `Student ${i}`
        });
      }

      const payload = {
        ...formData,
        mahasiswa
      };

      if (kelas) {
        await axios.put(`/kelas/${kelas._id}`, payload);
        toast.success('Class updated successfully');
      } else {
        await axios.post('/kelas', payload);
        toast.success('Class created successfully');
      }
      
      onSuccess();
    } catch (error: any) {
      console.error('Error saving class:', error);
      toast.error(error.response?.data?.message || 'Failed to save class');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {kelas ? 'Edit Class' : 'Create New Class'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Class Name</label>
              <input
                type="text"
                value={formData.nama_kelas}
                onChange={(e) => setFormData({ ...formData, nama_kelas: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Academic Year</label>
              <input
                type="text"
                value={formData.tahun_ajaran}
                onChange={(e) => setFormData({ ...formData, tahun_ajaran: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Semester</label>
              <select
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Number of Students</label>
              <input
                type="number"
                min="1"
                max="100"
                value={formData.jumlah_mahasiswa}
                onChange={(e) => setFormData({ ...formData, jumlah_mahasiswa: parseInt(e.target.value) })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              />
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
                {loading ? 'Saving...' : (kelas ? 'Update' : 'Create')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}