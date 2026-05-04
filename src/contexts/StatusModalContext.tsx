import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';

type StatusType = 'success' | 'error';

type StatusModalState = {
  open: boolean;
  type: StatusType;
  title: string;
  message: string;
};

type StatusModalContextType = {
  showSuccess: (title: string, message: string) => void;
  showError: (title: string, message: string) => void;
  close: () => void;
};

const StatusModalContext = createContext<StatusModalContextType | undefined>(undefined);

export function StatusModalProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StatusModalState>({
    open: false,
    type: 'success',
    title: '',
    message: ''
  });

  const close = () => setState((s) => ({ ...s, open: false }));

  const showSuccess = (title: string, message: string) =>
    setState({ open: true, type: 'success', title, message });

  const showError = (title: string, message: string) =>
    setState({ open: true, type: 'error', title, message });

  const value = useMemo(() => ({ showSuccess, showError, close }), []);

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error?.response?.status;
        const shouldShow =
          !error?.response ||
          status === 401 ||
          status === 503;

        if (!shouldShow) {
          return Promise.reject(error);
        }

        const message =
          error?.response?.data?.message ||
          error?.message ||
          'Terjadi kesalahan. Silakan coba lagi.';
        const title =
          status === 503
            ? 'Database Belum Siap'
            : status === 401
              ? 'Sesi Berakhir'
              : 'Terjadi Kesalahan';

        showError(title, message);
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const border = state.type === 'success' ? 'border-green-200' : 'border-red-200';
  const iconBg = state.type === 'success' ? 'bg-green-50' : 'bg-red-50';
  const titleColor = state.type === 'success' ? 'text-green-700' : 'text-red-700';
  const buttonBg = state.type === 'success' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700';

  return (
    <StatusModalContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {state.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className={`w-full max-w-md rounded-xl border ${border} bg-white shadow-lg`}
              role="dialog"
              aria-modal="true"
            >
              <div className="p-5">
                <div className={`rounded-lg ${iconBg} p-3`}>
                  <div className={`text-sm font-semibold ${titleColor}`}>{state.title}</div>
                  <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{state.message}</div>
                </div>
                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={close}
                    className={`px-4 py-2 rounded-lg text-white text-sm font-medium ${buttonBg}`}
                  >
                    OK
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </StatusModalContext.Provider>
  );
}

export function useStatusModal() {
  const ctx = useContext(StatusModalContext);
  if (!ctx) throw new Error('useStatusModal must be used within a StatusModalProvider');
  return ctx;
}
