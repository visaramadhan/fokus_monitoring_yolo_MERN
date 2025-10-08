import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import axios from 'axios';
import { User, Mail, Building, Hash, Save, BookOpen, Calendar, BarChart3, Award, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

interface ProfileForm {
  nama_lengkap: string;
  email: string;
  departemen: string;
  nip: string;
}

interface DosenStats {
  totalSubjects: number;
  totalClasses: number;
  totalMeetings: number;
  averageFocus: number;
  subjects: Array<{
    _id: string;
    nama: string;
    kode: string;
    kelas: string[];
    averageFocus: number;
    totalMeetings: number;
  }>;
  focusTrends: Array<{
    month: string;
    focus: number;
    meetings: number;
  }>;
  classPerformance: Array<{
    class: string;
    focus: number;
    meetings: number;
  }>;
}

interface AdminStats {
  totalDosen: number;
  totalAdmin: number;
  totalUsers: number;
  systemStats: {
    totalSubjects: number;
    totalClasses: number;
    totalMeetings: number;
    averageFocus: number;
  };
}

export default function Profile() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dosenStats, setDosenStats] = useState<DosenStats | null>(null);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  
  const { register, handleSubmit, formState: { errors } } = useForm<ProfileForm>({
    defaultValues: {
      nama_lengkap: user?.nama_lengkap || '',
      email: user?.email || '',
      departemen: user?.departemen || '',
      nip: user?.nip || ''
    }
  });

  useEffect(() => {
    if (user) {
      fetchUserStats();
    }
  }, [user]);

  const fetchUserStats = async () => {
    try {
      if (user?.role === 'dosen') {
        const response = await axios.get('/api/profile/dosen-stats');
        setDosenStats(response.data);
      } else if (user?.role === 'admin') {
        const response = await axios.get('/api/profile/admin-stats');
        setAdminStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const onSubmit = async (data: ProfileForm) => {
    if (!user) return;
    
    setLoading(true);
    try {
      await axios.put(`/users/${user.id}`, data);
      toast.success('Profile updated successfully');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">User not found</h3>
        <p className="text-gray-500">Please log in again.</p>
      </div>
    );
  }

  const pieData = dosenStats?.classPerformance.map((item, index) => ({
    name: item.class,
    value: Math.round(item.focus),
    color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][index % 5]
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-xl p-6 text-white"
      >
        <h1 className="text-2xl font-bold">Profile & Statistics</h1>
        <p className="mt-2 opacity-90">
          {user.role === 'admin' 
            ? "Manage your account and view system statistics"
            : "Manage your account and view your teaching performance"
          }
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <div className="text-center">
            <div className="h-24 w-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="h-12 w-12 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{user.nama_lengkap}</h3>
            <p className="text-sm text-gray-500">@{user.username}</p>
            <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full mt-2 ${
              user.role === 'admin' 
                ? 'bg-purple-100 text-purple-800' 
                : 'bg-blue-100 text-blue-800'
            }`}>
              {user.role}
            </span>
          </div>
          
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="space-y-3">
              <div className="flex items-center text-sm text-gray-600">
                <Mail className="h-4 w-4 mr-3" />
                <span>{user.email}</span>
              </div>
              {user.departemen && (
                <div className="flex items-center text-sm text-gray-600">
                  <Building className="h-4 w-4 mr-3" />
                  <span>{user.departemen}</span>
                </div>
              )}
              {user.nip && (
                <div className="flex items-center text-sm text-gray-600">
                  <Hash className="h-4 w-4 mr-3" />
                  <span>NIP: {user.nip}</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Edit Form */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2"
        >
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Edit Profile</h3>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    {...register('nama_lengkap', { required: 'Full name is required' })}
                    type="text"
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                  {errors.nama_lengkap && (
                    <p className="mt-1 text-sm text-red-600">{errors.nama_lengkap.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    {...register('email', { 
                      required: 'Email is required',
                      pattern: {
                        value: /^\S+@\S+$/i,
                        message: 'Invalid email address'
                      }
                    })}
                    type="email"
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department
                  </label>
                  <input
                    {...register('departemen')}
                    type="text"
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    NIP
                  </label>
                  <input
                    {...register('nip')}
                    type="text"
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Account Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Actions</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Account Information</h4>
                  <p className="text-sm text-gray-500">Username: {user.username}</p>
                  <p className="text-sm text-gray-500">Role: {user.role}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-red-900">Sign Out</h4>
                  <p className="text-sm text-red-700">Sign out from your account</p>
                </div>
                <button
                  onClick={logout}
                  className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 border border-red-300 rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Statistics Section */}
      {user.role === 'dosen' && dosenStats && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BookOpen className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Subjects</p>
                  <p className="text-2xl font-bold text-gray-900">{dosenStats.totalSubjects}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Calendar className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Classes</p>
                  <p className="text-2xl font-bold text-gray-900">{dosenStats.totalClasses}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Calendar className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Meetings</p>
                  <p className="text-2xl font-bold text-gray-900">{dosenStats.totalMeetings}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Avg Focus</p>
                  <p className="text-2xl font-bold text-gray-900">{Math.round(dosenStats.averageFocus)}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Focus Trends */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Focus Trends</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dosenStats.focusTrends}>
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
            </div>

            {/* Class Performance */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Class Performance</h3>
              {pieData.length > 0 ? (
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
              ) : (
                <div className="flex items-center justify-center h-[300px] text-gray-500">
                  <p>No class data available</p>
                </div>
              )}
              
              {pieData.length > 0 && (
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
              )}
            </div>
          </div>

          {/* Subjects List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Your Subjects</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dosenStats.subjects.map((subject) => (
                  <div key={subject._id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-900">{subject.nama}</h4>
                      <span className="text-sm text-gray-500">{subject.kode}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">Classes: {subject.kelas.join(', ')}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">{subject.totalMeetings} meetings</span>
                      <span className={`text-sm font-medium ${
                        subject.averageFocus >= 80 ? 'text-green-600' :
                        subject.averageFocus >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {Math.round(subject.averageFocus)}% avg focus
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Admin Statistics */}
      {user.role === 'admin' && adminStats && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* User Statistics */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <User className="h-5 w-5 mr-2" />
                User Statistics
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Dosen</span>
                  <span className="text-2xl font-bold text-blue-600">{adminStats.totalDosen}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Admin</span>
                  <span className="text-2xl font-bold text-purple-600">{adminStats.totalAdmin}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Users</span>
                  <span className="text-2xl font-bold text-green-600">{adminStats.totalUsers}</span>
                </div>
              </div>
            </div>

            {/* System Statistics */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                System Statistics
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Subjects</span>
                  <span className="text-2xl font-bold text-blue-600">{adminStats.systemStats.totalSubjects}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Classes</span>
                  <span className="text-2xl font-bold text-green-600">{adminStats.systemStats.totalClasses}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Meetings</span>
                  <span className="text-2xl font-bold text-purple-600">{adminStats.systemStats.totalMeetings}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">System Avg Focus</span>
                  <span className="text-2xl font-bold text-orange-600">{Math.round(adminStats.systemStats.averageFocus)}%</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}