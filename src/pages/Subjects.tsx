import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Plus, Search, BookOpen, Eye, Edit, Trash2, User } from 'lucide-react';
import toast from 'react-hot-toast';

interface MataKuliah {
  _id: string;
  nama: string;
  kode: string;
  sks: number;
  dosen_id: {
    _id: string;
    nama_lengkap: string;
  };
  kelas: string[];
  semester: number;
  deskripsi: string;
  createdAt: string;
}

interface DosenOption {
  _id: string;
  nama_lengkap: string;
}

export default function Subjects() {
  const [subjects, setSubjects] = useState<MataKuliah[]>([]);
  const [dosens, setDosens] = useState<DosenOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<MataKuliah | null>(null);

  useEffect(() => {
    fetchSubjects();
    fetchDosens();
  }, []);

  const fetchSubjects = async () => {
    try {
      const response = await axios.get('/mata-kuliah');
      setSubjects(response.data);
    } catch (error) {
      console.error('Error fetching subjects:', error);
      toast.error('Failed to fetch subjects');
    } finally {
      setLoading(false);
    }
  };

  const fetchDosens = async () => {
    try {
      const response = await axios.get('/users');
      setDosens(response.data.filter((user: any) => user.role === 'dosen'));
    } catch (error) {
      console.error('Error fetching dosens:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this subject?')) {
      try {
        await axios.delete(`/mata-kuliah/${id}`);
        toast.success('Subject deleted successfully');
        fetchSubjects();
      } catch (error) {
        console.error('Error deleting subject:', error);
        toast.error('Failed to delete subject');
      }
    }
  };

  const filteredSubjects = subjects.filter(subject =>
    subject.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
    subject.kode.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-2xl font-bold text-gray-900">Subjects</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage course subjects and their details
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Subject
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
          placeholder="Search subjects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Subjects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSubjects.map((subject) => (
          <div key={subject._id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  <div className="p-2 bg-green-100 rounded-lg mr-3">
                    <BookOpen className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{subject.nama}</h3>
                    <p className="text-sm text-gray-500">{subject.kode}</p>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    <span>{subject.dosen_id.nama_lengkap}</span>
                  </div>
                  <div>
                    <span className="font-medium">SKS:</span> {subject.sks}
                  </div>
                  <div>
                    <span className="font-medium">Semester:</span> {subject.semester}
                  </div>
                  <div>
                    <span className="font-medium">Classes:</span> {subject.kelas.join(', ')}
                  </div>
                </div>
                
                {subject.deskripsi && (
                  <p className="text-sm text-gray-500 mt-3 line-clamp-2">
                    {subject.deskripsi}
                  </p>
                )}
                
                <div className="text-xs text-gray-500 mt-3">
                  Created: {new Date(subject.createdAt).toLocaleDateString()}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Link
                  to={`/subjects/${subject._id}`}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Eye className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => setEditingSubject(subject)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(subject._id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredSubjects.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No subjects found</h3>
          <p className="text-gray-500">Get started by creating your first subject.</p>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingSubject) && (
        <SubjectModal
          subject={editingSubject}
          dosens={dosens}
          onClose={() => {
            setShowCreateModal(false);
            setEditingSubject(null);
          }}
          onSuccess={() => {
            fetchSubjects();
            setShowCreateModal(false);
            setEditingSubject(null);
          }}
        />
      )}
    </div>
  );
}

interface SubjectModalProps {
  subject: MataKuliah | null;
  dosens: DosenOption[];
  onClose: () => void;
  onSuccess: () => void;
}

function SubjectModal({ subject, dosens, onClose, onSuccess }: SubjectModalProps) {
  const [formData, setFormData] = useState({
    nama: subject?.nama || '',
    kode: subject?.kode || '',
    sks: subject?.sks || 2,
    dosen_id: subject?.dosen_id._id || '',
    kelas: subject?.kelas.join(', ') || '',
    semester: subject?.semester || 1,
    deskripsi: subject?.deskripsi || ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        kelas: formData.kelas.split(',').map(k => k.trim()).filter(k => k)
      };

      if (subject) {
        await axios.put(`/mata-kuliah/${subject._id}`, payload);
        toast.success('Subject updated successfully');
      } else {
        await axios.post('/mata-kuliah', payload);
        toast.success('Subject created successfully');
      }
      
      onSuccess();
    } catch (error: any) {
      console.error('Error saving subject:', error);
      toast.error(error.response?.data?.message || 'Failed to save subject');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {subject ? 'Edit Subject' : 'Create New Subject'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Subject Name</label>
              <input
                type="text"
                value={formData.nama}
                onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Subject Code</label>
              <input
                type="text"
                value={formData.kode}
                onChange={(e) => setFormData({ ...formData, kode: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">SKS</label>
              <input
                type="number"
                min="1"
                max="6"
                value={formData.sks}
                onChange={(e) => setFormData({ ...formData, sks: parseInt(e.target.value) })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Instructor</label>
              <select
                value={formData.dosen_id}
                onChange={(e) => setFormData({ ...formData, dosen_id: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              >
                <option value="">Select Instructor</option>
                {dosens.map((dosen) => (
                  <option key={dosen._id} value={dosen._id}>
                    {dosen.nama_lengkap}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Classes (comma separated)</label>
              <input
                type="text"
                value={formData.kelas}
                onChange={(e) => setFormData({ ...formData, kelas: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="TI-1A, TI-2B"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Semester</label>
              <input
                type="number"
                min="1"
                max="8"
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value) })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={formData.deskripsi}
                onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
                rows={3}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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
                {loading ? 'Saving...' : (subject ? 'Update' : 'Create')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}