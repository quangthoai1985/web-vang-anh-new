import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  User,
  Lock,
  ArrowRight,
  GraduationCap,
  Phone
} from 'lucide-react';
import { APP_NAME } from '../constants';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Fetch background URL from Firestore
  useEffect(() => {
    const fetchBackground = async () => {
      try {
        const docRef = doc(db, 'app_settings', 'login_background');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().imageUrl) {
          setBackgroundUrl(docSnap.data().imageUrl);
        }
      } catch (error) {
        console.error('Error fetching background:', error);
        // Keep default background on error
      }
    };
    fetchBackground();
  }, []);

  // Fetch System Logo & Certification Logo
  const [systemLogo, setSystemLogo] = useState('');
  const [certLogo, setCertLogo] = useState('');

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

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [backgroundUrl, setBackgroundUrl] = useState('/login-background.jpg');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const success = await login(formData.username, formData.password);
    setIsLoading(false);

    if (!success) {
      setError('Tên đăng nhập hoặc mật khẩu không đúng.');
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-end pr-8 sm:pr-16 lg:pr-24 font-sans overflow-hidden">
      {/* Full Screen Background */}
      <div className="absolute inset-0 z-0">
        <img
          src={backgroundUrl}
          alt="Trường Mẫu Giáo Vàng Anh"
          className="w-full h-full object-cover"
        />

      </div>

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-md mx-4 sm:mx-0">
        {/* Login Card - Transparent White */}
        <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl p-8 sm:p-10 animate-in fade-in zoom-in-95 duration-500">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex p-4 bg-blue-900/10 rounded-full mb-4">
              {systemLogo ? (
                <img src={systemLogo} alt="Logo" className="h-12 w-12 object-contain" />
              ) : (
                <GraduationCap className="h-12 w-12 text-blue-900" />
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-2">
              {APP_NAME}
            </h1>
            <div className="h-1 w-20 bg-amber-400 rounded-full mx-auto mb-4"></div>
            <h2 className="text-xl font-bold text-gray-900">Đăng nhập</h2>
            <p className="mt-2 text-sm text-gray-600">
              Chào mừng các Cô quay trở lại làm việc! 👋
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2">
              <div className="h-2 w-2 bg-red-500 rounded-full"></div>
              {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Username Input */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Tên đăng nhập
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent sm:text-sm transition-all"
                  placeholder="VD: admin, totruong, gv_la1..."
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Mật khẩu
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent sm:text-sm transition-all"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Options */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                  Ghi nhớ đăng nhập
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-blue-600 hover:text-blue-500 hover:underline">
                  Quên mật khẩu?
                </a>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-blue-900 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-900 disabled:opacity-70 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Đang xử lý...
                </>
              ) : (
                <>
                  Đăng nhập
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Support Info */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <Phone className="h-3 w-3" />
              <span>Hỗ trợ kỹ thuật: <span className="font-semibold text-gray-700">0984.651.653 (Thầy Thoại)</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer with Copyright */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/30 to-transparent backdrop-blur-sm py-4">
        <div className="text-center">
          <p className="text-xs sm:text-sm text-white drop-shadow-lg">
            © {new Date().getFullYear()} Trường Mẫu Giáo Vàng Anh. All rights reserved.
          </p>
        </div>
      </div>

      {/* Certification Logo (Fixed Top Left) */}
      {certLogo && (
        <div className="fixed top-6 left-6 z-20 animate-in fade-in slide-in-from-top-8 duration-700 delay-300">
          <img
            src={certLogo}
            alt="Chứng nhận đạt chuẩn"
            className="h-32 w-auto drop-shadow-2xl hover:scale-105 transition-transform duration-300 cursor-pointer"
            title="Trường Mầm non đạt chuẩn Quốc gia"
          />
        </div>
      )}
    </div>
  );
};

export default Login;