import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { ArrowLeft, Calendar, Clock, Users, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

interface CreateMeetingForm {
  tanggal: string;
  pertemuan_ke: number;
  kelas: string;
  mata_kuliah_id: string;
  durasi_pertemuan: number;
  topik: string;
  catatan: string;
}

interface MataKuliah {
  _id: string;
  nama: string;
  kode: string;
  kelas: string[];
  dosen_id: {
    nama_lengkap: string;
  };
}

interface Kelas {
  _id: string;
  nama_kelas: string;
  mahasiswa: Array<{
    id_mahasiswa: string;
    nama: string;
  }>;
}

export default function CreateMeeting() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<MataKuliah[]>([]);
  const [classes, setClasses] = useState<Kelas[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<MataKuliah | null>(null);
  const [selectedClass, setSelectedClass] = useState<Kelas | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<CreateMeetingForm>({
    defaultValues: {
      tanggal: new Date().toISOString().split('T')[0],
      pertemuan_ke: 1,
      durasi_pertemuan: 100
    }
  });

  const watchedSubjectId = watch('mata_kuliah_id');
  const watchedKelas = watch('kelas');

  useEffect(() => {
    fetchSubjects();
    fetchClasses();
  }, []);

  useEffect(() => {
    if (watchedSubjectId) {
      const subject = subjects.find(s => s._id === watchedSubjectId);
      setSelectedSubject(subject || null);
    }
  }, [watchedSubjectId, subjects]);

  useEffect(() => {
    if (watchedKelas) {
      const kelas = classes.find(k => k.nama_kelas === watchedKelas);
      setSelectedClass(kelas || null);
    }
  }, [watchedKelas, classes]);

  const fetchSubjects = async () => {
    try {
      const response = await axios.get('/mata-kuliah');
      setSubjects(response.data);
    } catch (error) {
      console.error('Error fetching subjects:', error);
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await axios.get('/kelas');
      setClasses(response.data);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const generateFocusData = (students: Array<{ id_mahasiswa: string }>) => {
    return students.map(student => {
      // Generate random focus pattern (12 sessions of 5 minutes each)
      const fokusPattern = [];
      for (let session = 0; session < 12; session++) {
        fokusPattern.push(Math.random() > 0.3 ? 1 : 0); // 70% chance of being focused
      }
      
      const jumlahSesiFokus = fokusPattern.filter(f => f === 1).length;
      const persenFokus = Math.round((jumlahSesiFokus / 12) * 100);
      const persenTidakFokus = 100 - persenFokus;
      
      let status = 'Kurang';
      if (persenFokus >= 80) status = 'Baik';
      else if (persenFokus >= 60) status = 'Cukup';

      return {
        id_siswa: student.id_mahasiswa,
        fokus: fokusPattern,
        jumlah_sesi_fokus: jumlahSesiFokus,
        durasi_fokus: jumlahSesiFokus * 5,
        waktu_hadir: 60,
        persen_fokus: persenFokus,
        persen_tidak_fokus: persenTidakFokus,
        status: status
      };
    });
  };

  const onSubmit = async (data: CreateMeetingForm) => {
    if (!selectedSubject || !selectedClass) {
      toast.error('Please select both subject and class');
      return;
    }

    setLoading(true);
    try {
      const focusData = generateFocusData(selectedClass.mahasiswa);
      
      const meetingData = {
        ...data,
        mata_kuliah: selectedSubject.nama,
        dosen_id: selectedSubject.dosen_id,
        data_fokus: focusData
      };

      const response = await axios.post('/pertemuan', meetingData);
      toast.success('Meeting created successfully');
      navigate(`/meetings/${response.data._id}`);
    } catch (error: any) {
      console.error('Error creating meeting:', error);
      toast.error(error.response?.data?.message || 'Failed to create meeting');
    } finally {
      setLoading(false);
    }
  };

  const availableClasses = selectedSubject ? selectedSubject.kelas : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link 
          to="/meetings"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Meeting</h1>
          <p className="text-sm text-gray-500">Set up a new focus monitoring session</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Meeting Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        {...register('tanggal', { required: 'Date is required' })}
                        type="date"
                        className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>
                    {errors.tanggal && (
                      <p className="mt-1 text-sm text-red-600">{errors.tanggal.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Meeting Number
                    </label>
                    <input
                      {...register('pertemuan_ke', { 
                        required: 'Meeting number is required',
                        min: { value: 1, message: 'Meeting number must be at least 1' }
                      })}
                      type="number"
                      min="1"
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                    {errors.pertemuan_ke && (
                      <p className="mt-1 text-sm text-red-600">{errors.pertemuan_ke.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duration (minutes)
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        {...register('durasi_pertemuan', { 
                          required: 'Duration is required',
                          min: { value: 30, message: 'Duration must be at least 30 minutes' }
                        })}
                        type="number"
                        min="30"
                        className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>
                    {errors.durasi_pertemuan && (
                      <p className="mt-1 text-sm text-red-600">{errors.durasi_pertemuan.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Subject and Class */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Subject & Class</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subject
                    </label>
                    <div className="relative">
                      <BookOpen className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <select
                        {...register('mata_kuliah_id', { required: 'Subject is required' })}
                        className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      >
                        <option value="">Select Subject</option>
                        {subjects.map((subject) => (
                          <option key={subject._id} value={subject._id}>
                            {subject.nama} ({subject.kode})
                          </option>
                        ))}
                      </select>
                    </div>
                    {errors.mata_kuliah_id && (
                      <p className="mt-1 text-sm text-red-600">{errors.mata_kuliah_id.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Class
                    </label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <select
                        {...register('kelas', { required: 'Class is required' })}
                        className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        disabled={!selectedSubject}
                      >
                        <option value="">Select Class</option>
                        {availableClasses.map((kelas) => (
                          <option key={kelas} value={kelas}>
                            {kelas}
                          </option>
                        ))}
                      </select>
                    </div>
                    {errors.kelas && (
                      <p className="mt-1 text-sm text-red-600">{errors.kelas.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Additional Details */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Topic
                    </label>
                    <input
                      {...register('topik')}
                      type="text"
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter meeting topic"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      {...register('catatan')}
                      rows={3}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter any additional notes"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <Link
                  to="/meetings"
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Meeting'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-6">
          {/* Subject Preview */}
          {selectedSubject && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Selected Subject</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedSubject.nama}</p>
                  <p className="text-sm text-gray-500">{selectedSubject.kode}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Instructor</p>
                  <p className="text-sm text-gray-500">{selectedSubject.dosen_id.nama_lengkap}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Available Classes</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedSubject.kelas.map((kelas, index) => (
                      <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {kelas}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Class Preview */}
          {selectedClass && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Selected Class</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedClass.nama_kelas}</p>
                  <p className="text-sm text-gray-500">{selectedClass.mahasiswa.length} students</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 mb-2">Students</p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {selectedClass.mahasiswa.slice(0, 5).map((student) => (
                      <div key={student.id_mahasiswa} className="text-xs text-gray-600">
                        {student.id_mahasiswa}
                      </div>
                    ))}
                    {selectedClass.mahasiswa.length > 5 && (
                      <div className="text-xs text-gray-500">
                        ... and {selectedClass.mahasiswa.length - 5} more
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* YOLO Integration Info */}
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">YOLO Integration</h3>
            <p className="text-sm text-blue-700 mb-3">
              This meeting will generate sample focus data. In production, connect your YOLO model to:
            </p>
            <div className="bg-blue-100 rounded-lg p-3">
              <code className="text-xs text-blue-800">
                POST /api/yolo-detection
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}