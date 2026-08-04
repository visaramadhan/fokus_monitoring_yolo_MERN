import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

function reportDebugEvent(payload: Record<string, unknown>) {
  // #region debug-point A:frontend-report
  fetch('http://127.0.0.1:7777/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'data-fetch-failed',
      runId: 'pre-fix',
      ts: Date.now(),
      ...payload,
    }),
  }).catch(() => {});
  // #endregion
}

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
        // #region debug-point A:axios-response-error
        reportDebugEvent({
          hypothesisId: 'A',
          location: 'src/contexts/AuthContext.tsx:axios-interceptor',
          msg: '[DEBUG] axios response error',
          data: {
            url: error.config?.url || null,
            method: error.config?.method || null,
            status: error.response?.status || null,
            responseMessage: error.response?.data?.message || null,
            hasToken: Boolean(localStorage.getItem('token')),
          },
        });
        // #endregion
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
      const response = await axios.get('/api/auth/me');
      setUser(response.data.user);
    } catch (error) {
      // #region debug-point B:get-current-user-failure
      reportDebugEvent({
        hypothesisId: 'B',
        location: 'src/contexts/AuthContext.tsx:getCurrentUser',
        msg: '[DEBUG] getCurrentUser failed',
        data: {
          hasToken: Boolean(localStorage.getItem('token')),
          errorName: error instanceof Error ? error.name : typeof error,
        },
      });
      // #endregion
      console.error('Error getting current user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const response = await axios.post('/api/auth/login', { username, password });
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
      const response = await axios.post('/api/auth/register', userData);
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
