import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, UserCircle, GraduationCap, LogOut, Settings, User, ChevronDown, Check, FileText, MessageCircle } from 'lucide-react';
import { APP_NAME } from '../constants';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import ChangePasswordModal from './ChangePasswordModal';

const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAllAsRead, markAsRead, removeNotification } = useNotification();

  // State
  const [isOpen, setIsOpen] = useState(false); // User Menu
  const [isNotifOpen, setIsNotifOpen] = useState(false); // Notification Menu
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false); // Change Password Modal

  // Fetch System Logo - MUST be declared before early return
  const [systemLogo, setSystemLogo] = useState('');
  const [certLogo, setCertLogo] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Handle Click Outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch logo from Firestore
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const docRef = doc(db, 'app_settings', 'system_logo');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().imageUrl) {
          setSystemLogo(docSnap.data().imageUrl);
        }

        const certDocRef = doc(db, 'app_settings', 'certification_logo');
        const certDocSnap = await getDoc(certDocRef);
        if (certDocSnap.exists() && certDocSnap.data().imageUrl) {
          setCertLogo(certDocSnap.data().imageUrl);
        }
      } catch (error) {
        console.error('Error fetching logo:', error);
      }
    };
    fetchLogo();
  }, []);

  // Hide header on Login page (early return AFTER all hooks)
  if (location.pathname === '/login') {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getInitials = (name: string) => {
    return name ? name.charAt(0).toUpperCase() : 'U';
  };

  const getAvatarColor = (role?: string) => {
    switch (role) {
      case 'admin': return 'bg-red-500';
      case 'head_teacher': return 'bg-blue-500';
      case 'office_head': return 'bg-cyan-600';
      case 'teacher': return 'bg-emerald-500';
      case 'staff': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getHeaderBgClass = (role?: string) => {
    switch (role) {
      case 'admin': return 'bg-blue-900';
      case 'teacher': return 'bg-orange-500';
      case 'head_teacher': return 'bg-indigo-600';
      case 'office_head': return 'bg-teal-700';
      case 'staff': return 'bg-teal-600';
      default: return 'bg-blue-900';
    }
  };

  return (
    <header className={`sticky top-0 z-50 w-full ${getHeaderBgClass(user?.role)} text-white shadow-lg border-b border-white/10 transition-colors duration-500 animate-in slide-in-from-top-full`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Left Side: Logo & Title */}
          <div onClick={() => navigate('/')} className="flex items-center gap-4 cursor-pointer group">
            <div className="p-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl group-hover:bg-white group-hover:scale-105 transition-all duration-300 shadow-lg overflow-hidden">
              {systemLogo ? (
                <img src={systemLogo} alt="Logo" className="h-8 w-8 object-contain" />
              ) : (
                <GraduationCap className="h-8 w-8 text-yellow-300 group-hover:text-yellow-600 transition-colors" />
              )}
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg md:text-xl font-bold text-white tracking-tight drop-shadow-sm">
                {APP_NAME}
              </h1>
              <span className="text-xs text-white/80 font-medium uppercase tracking-wider opacity-90">Hệ thống quản lý tập trung</span>
            </div>

            {/* Certification Logo (Header) */}
            {certLogo && (
              <div className="hidden lg:block ml-4 pl-4 border-l border-white/20">
                <img
                  src={certLogo}
                  alt="Chứng nhận"
                  className="h-10 w-auto object-contain drop-shadow-md hover:scale-110 transition-transform duration-300"
                  title="Trường đạt chuẩn Quốc gia"
                />
              </div>
            )}
          </div>

          {/* Right Side: Actions */}
          <div className="flex items-center gap-2 md:gap-6">
            {/* Search Bar */}
            <div className="hidden md:flex items-center bg-black/20 border border-white/10 rounded-full px-4 py-2 focus-within:ring-2 focus-within:ring-white/30 focus-within:bg-black/30 transition-all duration-300 w-64 backdrop-blur-sm">
              <Search className="h-5 w-5 text-white/70" />
              <input
                type="text"
                placeholder="Tìm kiếm văn bản..."
                className="ml-2 bg-transparent border-none outline-none text-sm text-white placeholder-white/60 w-full"
              />
            </div>

            {/* Notification Center */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className={`relative p-2 text-white/80 hover:bg-white/10 hover:text-white rounded-full transition-all duration-200 group ${unreadCount > 0 ? 'animate-wiggle' : ''}`}
              >
                <Bell className={`h-6 w-6 ${isNotifOpen ? 'text-white' : ''} group-hover:scale-110 transition-transform`} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-2 h-4 w-4 bg-red-500 rounded-full ring-2 ring-white/20 shadow-lg shadow-red-500/50 flex items-center justify-center text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {isNotifOpen && (
                <div className="absolute right-0 top-full mt-4 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 ring-1 ring-black/5 overflow-hidden z-50 origin-top-right animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-bold text-gray-800 text-sm">Thông báo mới</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <Check className="h-3 w-3" /> Đánh dấu đã đọc
                      </button>
                    )}
                  </div>

                  <div className="max-h-[400px] overflow-y-auto">
                    {notifications.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          markAsRead(item.id);
                          removeNotification(item.id); // Remove from list after viewing
                          if (item.targetPath) {
                            // Add highlight parameter for visual effect on target
                            const separator = item.targetPath.includes('?') ? '&' : '?';
                            navigate(`${item.targetPath}${separator}highlight=true`);
                            setIsNotifOpen(false);
                          }
                        }}
                        className={`p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer flex gap-3 ${!item.isRead ? 'bg-blue-50/40' : 'bg-white'}`}
                      >
                        <div className="flex-shrink-0 pt-1">
                          {item.avatar ? (
                            <img src={item.avatar} alt={item.user} className="h-10 w-10 rounded-full object-cover border border-gray-200" />
                          ) : (
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold border border-gray-200 ${item.type === 'system' ? 'bg-gray-800 text-white' : 'bg-blue-100 text-blue-700'}`}>
                              {getInitials(item.user)}
                            </div>
                          )}

                          {/* Icon overlay based on type */}
                          <div className="absolute -mt-3 -ml-1 h-5 w-5 rounded-full border-2 border-white flex items-center justify-center bg-white shadow-sm">
                            {item.type === 'upload' && <FileText className="h-3 w-3 text-emerald-500" />}
                            {item.type === 'comment' && <MessageCircle className="h-3 w-3 text-blue-500" />}
                          </div>
                        </div>

                        <div className="flex-1">
                          <p className="text-sm text-gray-800 leading-snug">
                            <span className="font-bold">{item.user}</span> {item.content}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-400 font-medium">{item.time}</span>
                            {item.fileType && (
                              <span className="text-[10px] uppercase font-bold text-gray-500 bg-gray-100 px-1.5 rounded border border-gray-200">
                                {item.fileType}
                              </span>
                            )}
                            {!item.isRead && (
                              <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {notifications.length === 0 && (
                      <div className="p-8 text-center text-gray-400">
                        <Bell className="h-10 w-10 mx-auto mb-2 opacity-20" />
                        <p className="text-sm">Không có thông báo mới</p>
                      </div>
                    )}
                  </div>

                  <div className="p-3 border-t border-gray-100 bg-gray-50 text-center">
                    <button className="text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors">
                      Xem tất cả thông báo
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Dropdown */}
            <div className="relative pl-4 border-l border-white/20" ref={dropdownRef}>
              <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-3 p-1.5 rounded-full md:rounded-xl transition-all duration-200 ${isOpen ? 'bg-white/10 ring-1 ring-white/20' : 'hover:bg-white/5'}`}
              >
                {/* Avatar */}
                <div className="relative">
                  {user?.avatar ? (
                    <img src={user.avatar} alt={user.fullName} className="h-9 w-9 rounded-full object-cover border-2 border-white/20 shadow-sm" />
                  ) : (
                    <div className={`h-9 w-9 rounded-full ${getAvatarColor(user?.role)} text-white flex items-center justify-center text-sm font-bold border-2 border-white/20 shadow-sm`}>
                      {user ? getInitials(user.fullName) : <UserCircle className="h-6 w-6" />}
                    </div>
                  )}
                  <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 rounded-full border-2 border-white/20"></div>
                </div>

                {/* Text Info (Desktop) */}
                {user ? (
                  <div className="hidden md:flex flex-col items-start text-left mr-1">
                    <span className="text-sm font-bold text-white leading-none mb-1">{user.fullName}</span>
                    <span className="text-[10px] text-white font-medium bg-black/20 px-1.5 py-0.5 rounded border border-white/10">
                      {user.roleLabel}
                    </span>
                  </div>
                ) : (
                  <div className="hidden md:flex flex-col items-start text-left mr-1">
                    <span className="text-sm font-bold text-white">Khách</span>
                  </div>
                )}

                {/* Chevron */}
                <ChevronDown className={`hidden md:block h-4 w-4 text-white/70 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-xl shadow-2xl border border-gray-100 ring-1 ring-black/5 overflow-hidden z-50 origin-top-right animate-in fade-in zoom-in-95 duration-200">
                  {/* Header Section inside Dropdown (Mobile Friendly) */}
                  <div className="px-4 py-4 border-b border-gray-100 bg-gray-50 md:hidden">
                    <p className="text-sm font-bold text-gray-900">{user?.fullName || 'Khách'}</p>
                    <p className="text-xs text-gray-500">{user?.roleLabel}</p>
                  </div>

                  <div className="p-1.5">
                    <button
                      onClick={() => setIsOpen(false)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors"
                    >
                      <div className="p-1.5 bg-blue-100 text-blue-600 rounded-md">
                        <User className="h-4 w-4" />
                      </div>
                      Thông tin tài khoản
                    </button>

                    <button
                      onClick={() => {
                        setIsOpen(false);
                        setIsChangePasswordOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors"
                    >
                      <div className="p-1.5 bg-gray-100 text-gray-600 rounded-md">
                        <Settings className="h-4 w-4" />
                      </div>
                      Đổi mật khẩu
                    </button>
                  </div>

                  <div className="h-px bg-gray-100 my-0.5 mx-2"></div>

                  <div className="p-1.5">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors"
                    >
                      <div className="p-1.5 bg-red-100 text-red-500 rounded-md">
                        <LogOut className="h-4 w-4" />
                      </div>
                      Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </header>
  );
};

export default Header;