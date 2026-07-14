import React, { createContext, useContext, useState } from 'react';

interface Notification {
  message: string;
  type: 'success' | 'error' | 'info';
}

interface NotificationContextType {
  notification: Notification | null;
  showNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notification, setNotification] = useState<Notification | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    // Auto close
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const clearNotification = () => {
    setNotification(null);
  };

  return (
    <NotificationContext.Provider value={{ notification, showNotification, clearNotification }}>
      {children}
      {notification && (
        <div className={`fixed bottom-5 right-5 z-50 p-4 rounded-lg shadow-2xl border text-xs font-semibold tracking-wide transition-all select-none ${
          notification.type === 'success' 
            ? 'bg-emerald-900/90 border-emerald-800 text-emerald-250' 
            : notification.type === 'error'
            ? 'bg-red-950/90 border-red-900 text-red-200'
            : 'bg-indigo-950/90 border-indigo-900 text-indigo-200'
        }`}>
          {notification.message.toUpperCase()}
        </div>
      )}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
export default NotificationContext;
