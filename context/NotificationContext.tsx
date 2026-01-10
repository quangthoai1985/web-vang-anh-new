import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Check, X, Bell, FileText, MessageCircle, AlertCircle } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { Notification } from '../types';

// --- Types ---
export interface ToastData {
  id: string;
  message: string;
  subMessage?: string;
  type: 'success' | 'error' | 'info';
}

// Map Firestore Notification to UI Item
export interface NotificationItem {
  id: string;
  type: 'upload' | 'comment' | 'system';
  user: string;
  avatar?: string;
  content: string;
  time: string;
  isRead: boolean;
  fileType?: 'word' | 'pdf' | 'excel';
  targetPath: string; // Added for navigation
}

interface NotificationContextType {
  addToast: (message: string, subMessage?: string, type?: 'success' | 'error') => void;
  notifications: NotificationItem[];
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  unreadCount: number;
}

// --- Context ---
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// --- Toast Component ---
const ToastContainer: React.FC<{ toasts: ToastData[], removeToast: (id: string) => void }> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto w-80 bg-white rounded-xl shadow-2xl border-l-4 border-green-500 overflow-hidden animate-in slide-in-from-right duration-300 relative"
        >
          <div className="p-4 flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-gray-900">{toast.message}</h4>
              {toast.subMessage && (
                <p className="text-xs text-gray-500 mt-1">{toast.subMessage}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* Progress Bar */}
          <div className="h-1 w-full bg-gray-100">
            <div className="h-full bg-green-500 animate-[width_3s_linear_forwards] w-full origin-left" />
          </div>

          <style>{`
            @keyframes width {
              from { width: 100%; }
              to { width: 0%; }
            }
          `}</style>
        </div>
      ))}
    </div>
  );
};

// --- Helper to format time ---
const formatTimeAgo = (isoString: string) => {
  const date = new Date(isoString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Vừa xong';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
  return `${Math.floor(diffInSeconds / 86400)} ngày trước`;
};

// --- Provider ---
export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Auto trigger welcome toast
  useEffect(() => {
    const timer = setTimeout(() => {
      addToast("Chào mừng quay trở lại!", "Hệ thống đã sẵn sàng làm việc.", "success");
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // --- Real-time Notifications from Firestore ---
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('receivers', 'array-contains', user.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: NotificationItem[] = snapshot.docs.map(doc => {
        const data = doc.data() as Notification;
        return {
          id: doc.id,
          type: data.type,
          user: data.senderName,
          avatar: data.senderAvatar,
          content: data.message.replace(data.senderName, '').trim(), // Remove sender name if repeated in message
          time: formatTimeAgo(data.createdAt),
          isRead: data.isRead, // Note: This is global read status. 
          // Ideally, we should track read status per user (e.g., readBy: [uid1, uid2]).
          // But for now, let's assume 'isRead' in the document means "processed".
          // WAIT: The requirement says "receivers: Array". 
          // If one user reads it, should it be read for everyone? 
          // Usually no. But given the simple structure requested:
          // "isRead: false" in the document.
          // If I change it to true, it changes for everyone.
          // BETTER APPROACH for this specific request:
          // The user asked for "isRead: false" in the document structure.
          // This implies a single status. 
          // However, for multi-receiver, we usually need a sub-collection or map.
          // Let's stick to the requested structure but maybe interpret 'isRead' as "Has been clicked by SOMEONE" 
          // OR, since the prompt is simple, maybe we just update it.
          // Let's IMPROVE it slightly: check if `readBy` array exists, if not fallback to `isRead`.
          // But to strictly follow "YÊU CẦU 1", I will use `isRead`. 
          // LIMITATION: If Admin 1 reads it, Admin 2 sees it as read. This might be acceptable for a shared inbox model.
          fileType: data.metadata?.fileType as any,
          targetPath: data.targetPath
        };
      });
      setNotifications(items);
    });

    return () => unsubscribe();
  }, [user]);

  const addToast = (message: string, subMessage: string = '', type: 'success' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, subMessage, type }]);

    // Auto remove after 3s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const markAsRead = async (id: string) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));

    try {
      const notifRef = doc(db, 'notifications', id);
      await updateDoc(notifRef, { isRead: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));

    // Batch update? Firestore doesn't support batch update by query directly on client easily without loop.
    // We'll just loop through unread ones.
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
    unreadIds.forEach(async (id) => {
      try {
        await updateDoc(doc(db, 'notifications', id), { isRead: true });
      } catch (e) {
        console.error(e);
      }
    });
  };

  // Remove notification from local list (disappear after click)
  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <NotificationContext.Provider value={{
      addToast,
      notifications,
      markAsRead,
      markAllAsRead,
      removeNotification,
      unreadCount
    }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};