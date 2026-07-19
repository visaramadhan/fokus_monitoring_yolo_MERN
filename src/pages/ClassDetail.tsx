import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Users, Calendar, GraduationCap, BarChart3, Download, FileSpreadsheet } from 'lucide-react';
import { useStatusModal } from '../contexts/StatusModalContext';

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

function getYearOptions(meetings: Meeting[]) {
  return Array.from(
    new Set(
      meetings
        .map((meeting) => new Date(meeting.tanggal).getFullYear())
        .filter((year) => !Number.isNaN(year))
        .map((year) => String(year))
    )
  ).sort((a, b) => Number(b) - Number(a));
}

function buildReportParams(
  mode: 'all' | 'year' | 'custom',
  reportYear: string,
  reportStartDate: string,
  reportEndDate: string
) {
  const params: Record<string, string> = {};
  if (mode === 'year' && reportYear) {
    params.year = reportYear;
  }
  if (mode === 'custom' && reportStartDate && reportEndDate) {
    params.startDate = reportStartDate;
    params.endDate = reportEndDate;
  }
  return params;
}

export default function ClassDetail() {
  const { id } = useParams<{ id: string }>();
  const { showSuccess, showError } = useStatusModal();
  const [kelas, setKelas] = useState<Kelas | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusThreshold, setFocusThreshold] = useState(70);
  const [meetingYearFilter, setMeetingYearFilter] = useState('');
  const [pdfRangeMode, setPdfRangeMode] = useState<'all' | 'year' | 'custom'>('all');
  const [reportYear, setReportYear] = useState('');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');

  useEffect(() => {
    if (id) {
      fetchClassDetail();
    }
  }, [id]);

  useEffect(() => {
    if (kelas?.nama_kelas) {
      fetchClassMeetings(kelas.nama_kelas);
    }
  }, [kelas?.nama_kelas]);

  const fetchClassDetail = async () => {
    try {
      const response = await axios.get(`/api/kelas/${id}`);
      setKelas(response.data);
    } catch (error) {
      console.error('Error fetching class detail:', error);
      showError('Gagal', 'Gagal mengambil detail kelas.');
    }
  };

  const fetchClassMeetings = async (kelasName: string) => {
    try {
      const response = await axios.get('/api/pertemuan', {
        params: { kelas: kelasName }
      });
      setMeetings(response.data);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      showError('Gagal', 'Gagal mengambil data pertemuan kelas.');
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = async () => {
    try {
      if (pdfRangeMode === 'year' && !reportYear) {
        showError('Validasi', 'Pilih tahun rekap terlebih dahulu.');
        return;
      }
      if (pdfRangeMode === 'custom' && (!reportStartDate || !reportEndDate)) {
        showError('Validasi', 'Lengkapi tanggal awal dan akhir untuk export PDF.');
        return;
      }

      const params = buildReportParams(pdfRangeMode, reportYear, reportStartDate, reportEndDate);

      const response = await axios.get(`/api/export/pdf/class/${id}`, {
        params,
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `class-${kelas?.nama_kelas || 'unknown'}-report.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      showSuccess('Berhasil', 'PDF berhasil diunduh.');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      showError('Gagal', 'Gagal export PDF.');
    }
  };

  const exportToExcel = async () => {
    try {
      if (pdfRangeMode === 'year' && !reportYear) {
        showError('Validasi', 'Pilih tahun rekap terlebih dahulu.');
        return;
      }
      if (pdfRangeMode === 'custom' && (!reportStartDate || !reportEndDate)) {
        showError('Validasi', 'Lengkapi tanggal awal dan akhir untuk export Excel.');
        return;
      }

      const params = buildReportParams(pdfRangeMode, reportYear, reportStartDate, reportEndDate);
      const response = await axios.get(`/api/export/excel/class/${id}`, {
        params,
        responseType: 'blob'
      });

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `class-${kelas?.nama_kelas || 'unknown'}-report.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);

      showSuccess('Berhasil', 'Excel berhasil diunduh.');
    } catch (error) {
      console.error('Error exporting Excel:', error);
      showError('Gagal', 'Gagal export Excel.');
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

  const availableYears = getYearOptions(meetings);
  const filteredMeetings = meetings.filter((meeting) => {
    if (!meetingYearFilter) return true;
    return String(new Date(meeting.tanggal).getFullYear()) === meetingYearFilter;
  });

  const averageFocus = filteredMeetings.length > 0 
    ? filteredMeetings.reduce((sum, meeting) => sum + meeting.hasil_akhir_kelas.fokus, 0) / filteredMeetings.length
    : 0;
  const meetingsAboveThreshold = filteredMeetings.filter(m => (m.hasil_akhir_kelas.fokus || 0) >= focusThreshold).length;
  const meetingsBelowThreshold = filteredMeetings.length - meetingsAboveThreshold;
  const reasonSummary = (() => {
    if (filteredMeetings.length === 0) return 'Belum ada pertemuan untuk dianalisis pada filter yang dipilih.';
    if (averageFocus >= focusThreshold && meetingsBelowThreshold <= Math.ceil(filteredMeetings.length * 0.3)) {
      return 'Kelas cenderung kondusif: rata-rata fokus di atas threshold dan mayoritas pertemuan memenuhi standar.';
    }
    if (averageFocus < focusThreshold && meetingsBelowThreshold >= Math.ceil(filteredMeetings.length * 0.5)) {
      return 'Kelas cenderung tidak kondusif: rata-rata fokus di bawah threshold dan banyak pertemuan tidak memenuhi standar.';
    }
    return 'Kondisi fluktuatif: terdapat variasi fokus antar pertemuan yang signifikan.';
  })();

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
            onClick={exportToExcel}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export Excel
          </button>
          <button
            onClick={exportToPDF}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Filter Tahun Riwayat</h3>
          <p className="mt-1 text-xs text-gray-500">Mempengaruhi statistik dan daftar pertemuan pada halaman ini.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <select
              value={meetingYearFilter}
              onChange={(e) => setMeetingYearFilter(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Semua Tahun</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setMeetingYearFilter('')}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Rentang Rekap PDF</h3>
          <p className="mt-1 text-xs text-gray-500">Pilih ruang lingkup data sebelum export PDF.</p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <select
              value={pdfRangeMode}
              onChange={(e) => setPdfRangeMode(e.target.value as 'all' | 'year' | 'custom')}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Semua Data</option>
              <option value="year">Per Tahun</option>
              <option value="custom">Rentang Tanggal</option>
            </select>
            {pdfRangeMode === 'year' && (
              <select
                value={reportYear}
                onChange={(e) => setReportYear(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Pilih Tahun</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            )}
            {pdfRangeMode === 'custom' && (
              <>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </>
            )}
          </div>
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
              <p className="text-2xl font-bold text-gray-900">{filteredMeetings.length}</p>
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Analitik Kekondusifan</h3>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-600">Threshold</span>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Rata-rata Fokus</p>
            <p className="text-2xl font-bold text-gray-900">{Math.round(averageFocus)}%</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Pertemuan ≥ Threshold</p>
            <p className="text-2xl font-bold text-green-600">{meetingsAboveThreshold}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Pertemuan &lt; Threshold</p>
            <p className="text-2xl font-bold text-red-600">{meetingsBelowThreshold}</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-gray-700">{reasonSummary}</p>
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
        {filteredMeetings.length > 0 ? (
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Detail</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMeetings.slice(0, 10).map((meeting) => (
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        to={`/meetings/${meeting._id}`}
                        className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 font-medium text-blue-700 hover:bg-blue-100"
                      >
                        Lihat Rekap
                      </Link>
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
            <p className="text-gray-500">Belum ada riwayat meeting pada filter tahun yang dipilih.</p>
          </div>
        )}
      </div>
    </div>
  );
}
