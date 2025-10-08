import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  Calendar, 
  GraduationCap,
  User,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  Settings,
  Video,
  Zap,
  CalendarDays
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const adminNavigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, color: 'text-blue-600' },
    { name: 'Live Monitoring', href: '/live-monitoring', icon: Video, color: 'text-red-600' },
    { name: 'Schedule', href: '/jadwal', icon: CalendarDays, color: 'text-indigo-600' },
    { name: 'Classes', href: '/classes', icon: GraduationCap, color: 'text-green-600' },
    { name: 'Mata Kuliah', href: '/mata-kuliah', icon: BookOpen, color: 'text-purple-600' },
    { name: 'Meetings', href: '/meetings', icon: Calendar, color: 'text-orange-600' },
    { name: 'Users', href: '/users', icon: Users, color: 'text-teal-600' },
    { name: 'Settings', href: '/settings', icon: Settings, color: 'text-gray-600' }
  ];

  const dosenNavigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, color: 'text-blue-600' },
    { name: 'Live Monitoring', href: '/live-monitoring', icon: Video, color: 'text-red-600' },
    { name: 'Schedule', href: '/jadwal', icon: CalendarDays, color: 'text-indigo-600' },
    { name: 'Classes', href: '/classes', icon: GraduationCap, color: 'text-green-600' },
    { name: 'Mata Kuliah', href: '/mata-kuliah', icon: BookOpen, color: 'text-purple-600' },
    { name: 'Meetings', href: '/meetings', icon: Calendar, color: 'text-orange-600' }
  ];

  const navigation = user?.role === 'admin' ? adminNavigation : dosenNavigation;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Mobile sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex z-40 md:hidden"
          >
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gray-600 bg-opacity-75" 
              onClick={() => setSidebarOpen(false)} 
            />
            
            <motion.div 
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative flex-1 flex flex-col max-w-xs w-full bg-white shadow-xl"
            >
              <div className="absolute top-0 right-0 -mr-12 pt-2">
                <button
                  className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X className="h-6 w-6 text-white" />
                </button>
              </div>
              
              <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
                <div className="flex-shrink-0 flex items-center px-4">
                  <div className="flex items-center">
                    <div className="h-8 w-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                      <LayoutDashboard className="h-5 w-5 text-white" />
                    </div>
                    <span className="ml-2 text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      FocusMonitor
                    </span>
                  </div>
                </div>
                <nav className="mt-5 px-2 space-y-1">
                  {navigation.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`group flex items-center px-2 py-2 text-base font-medium rounded-md transition-all duration-200 ${
                          isActive
                            ? 'bg-gradient-to-r from-blue-50 to-purple-50 text-blue-900 border-r-2 border-blue-500'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <item.icon className={`mr-4 h-6 w-6 ${isActive ? item.color : 'text-gray-400'}`} />
                        {item.name}
                      </Link>
                    );
                  })}
                </nav>
              </div>
              
              <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
                <div className="flex items-center">
                  <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-3">
                    <p className="text-base font-medium text-gray-700">{user?.nama_lengkap}</p>
                    <p className="text-sm font-medium text-gray-500 capitalize">{user?.role}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex-1 flex flex-col min-h-0 border-r border-gray-200 bg-white shadow-lg">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4">
              <div className="flex items-center">
                <motion.div 
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                  className="h-8 w-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center"
                >
                  <LayoutDashboard className="h-5 w-5 text-white" />
                </motion.div>
                <span className="ml-2 text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  FocusMonitor
                </span>
              </div>
            </div>
            <nav className="mt-5 flex-1 px-2 space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <motion.div
                    key={item.name}
                    whileHover={{ x: 4 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  >
                    <Link
                      to={item.href}
                      className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-50 to-purple-50 text-blue-900 border-r-2 border-blue-500'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <item.icon className={`mr-3 h-6 w-6 ${isActive ? item.color : 'text-gray-400'}`} />
                      {item.name}
                      {item.name === 'Live Monitoring' && (
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="ml-auto w-2 h-2 bg-red-500 rounded-full"
                        />
                      )}
                    </Link>
                  </motion.div>
                );
              })}
            </nav>
          </div>
          
          <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
            <Link to="/profile" className="flex-shrink-0 w-full group block">
              <div className="flex items-center">
                <div className="h-9 w-9 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    {user?.nama_lengkap}
                  </p>
                  <p className="text-xs font-medium text-gray-500 group-hover:text-gray-700 capitalize">
                    {user?.role}
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="md:pl-64 flex flex-col flex-1">
        <div className="sticky top-0 z-10 md:hidden pl-1 pt-1 sm:pl-3 sm:pt-3 bg-white shadow-sm">
          <button
            className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
        
        <main className="flex-1">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {/* Top bar */}
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-between items-center mb-6"
              >
                <div className="flex-1 max-w-lg">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm transition-all duration-200"
                      placeholder="Search..."
                      type="search"
                    />
                  </div>
                </div>
                
                <div className="ml-4 flex items-center md:ml-6 space-x-3">
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-white p-2 rounded-lg text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm border border-gray-200"
                  >
                    <Bell className="h-5 w-5" />
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleLogout}
                    className="bg-white p-2 rounded-lg text-gray-400 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 shadow-sm border border-gray-200"
                  >
                    <LogOut className="h-5 w-5" />
                  </motion.button>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                {children}
              </motion.div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}