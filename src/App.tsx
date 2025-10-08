import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';
import Classes from './pages/Classes';
import Subjects from './pages/Subjects';
import Meetings from './pages/Meetings';
import Users from './pages/Users';
import Profile from './pages/Profile';
import ClassDetail from './pages/ClassDetail';
import SubjectDetail from './pages/SubjectDetail';
import MeetingDetail from './pages/MeetingDetail';
import CreateMeeting from './pages/CreateMeeting';
import LiveMonitoring from './pages/LiveMonitoring';
import Settings from './pages/Settings';
import Jadwal from './pages/Jadwal';
import AnimatedBackground from './components/AnimatedBackground';

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/dashboard" />;
  }
  
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <AnimatedBackground />
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  return user ? <Navigate to="/dashboard" /> : <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                style: {
                  background: '#10B981',
                },
              },
              error: {
                style: {
                  background: '#EF4444',
                },
              },
            }}
          />
          
          <Routes>
            <Route path="/login" element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } />
            <Route path="/register" element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            } />
            <Route path="/forgot-password" element={
              <PublicRoute>
                <ForgotPassword />
              </PublicRoute>
            } />
            
            <Route path="/" element={<Navigate to="/dashboard" />} />
            
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/live-monitoring" element={
              <ProtectedRoute>
                <Layout>
                  <LiveMonitoring />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/jadwal" element={
              <ProtectedRoute>
                <Layout>
                  <Jadwal />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/classes" element={
              <ProtectedRoute>
                <Layout>
                  <Classes />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/classes/:id" element={
              <ProtectedRoute>
                <Layout>
                  <ClassDetail />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/mata-kuliah" element={
              <ProtectedRoute>
                <Layout>
                  <Subjects />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/mata-kuliah/:id" element={
              <ProtectedRoute>
                <Layout>
                  <SubjectDetail />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/meetings" element={
              <ProtectedRoute>
                <Layout>
                  <Meetings />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/meetings/create" element={
              <ProtectedRoute>
                <Layout>
                  <CreateMeeting />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/meetings/:id" element={
              <ProtectedRoute>
                <Layout>
                  <MeetingDetail />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/users" element={
              <ProtectedRoute adminOnly>
                <Layout>
                  <Users />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/settings" element={
              <ProtectedRoute adminOnly>
                <Layout>
                  <Settings />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/profile" element={
              <ProtectedRoute>
                <Layout>
                  <Profile />
                </Layout>
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;