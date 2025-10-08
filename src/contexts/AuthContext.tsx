import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  nama_lengkap: string;
  departemen?: string;
  nip?: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Configure axios defaults
axios.defaults.baseURL = 'http://localhost:5000/api';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Set up axios interceptor for auth token
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    // Add response interceptor to handle token expiration
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          logout();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        if (decoded.exp * 1000 > Date.now()) {
          getCurrentUser();
        } else {
          logout();
        }
      } catch (error) {
        logout();
      }
    } else {
      setLoading(false);
    }
  }, []);

  const getCurrentUser = async () => {
    try {
      const response = await axios.get('/auth/me');
      setUser(response.data.user);
    } catch (error) {
      console.error('Error getting current user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const response = await axios.post('/auth/login', { username, password });
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  };

  const register = async (userData: any) => {
    try {
      const response = await axios.post('/auth/register', userData);
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Registration failed');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const value = {
    user,
    login,
    register,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}