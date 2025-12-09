
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  ShieldCheck,
  ArrowLeft,
  User,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Lock,
  Save,
  X,
  Mail,
  Users,
  Briefcase,
  CheckSquare,
  AlertCircle,
  School,
  Loader2
} from 'lucide-react';
import { UserAccount, UserRole } from '../types';
import { db, firebaseConfig } from '../firebase';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, updateDoc, setDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import AppSettingsTab from '../components/AppSettingsTab';

const SystemAdmin: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { addToast } = useNotification();

  // Tab State
  const [activeTab, setActiveTab] = useState<'users' | 'settings'>('users');

  // Fetch classes from Firestore for accurate mapping
  const [classes, setClasses] = React.useState<any[]>([]);
  const [classNameToId, setClassNameToId] = React.useState<Record<string, string>>({});
  const [classIdToName, setClassIdToName] = React.useState<Record<string, string>>({});

  // Protect Page Access
  React.useEffect(() => {
    if (currentUser) {
      const hasSystemAdminAccess = currentUser.role === 'admin' || currentUser.permissions?.includes('access_system_admin');
      if (!hasSystemAdminAccess) {
        addToast("Bạn không có quyền truy cập khu vực này.", "error");
        navigate('/');
      }
    }
  }, [currentUser, navigate, addToast]);

  // State
  // State
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('Tất cả');

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isResetPasswordMode, setIsResetPasswordMode] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<UserAccount>>({});
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Classes for mapping
  React.useEffect(() => {
    const q = query(collection(db, 'classes'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const classesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      classesData.sort((a: any, b: any) => a.name.localeCompare(b.name));
      setClasses(classesData);

      // Create mappings
      const nameToId: Record<string, string> = {};
      const idToName: Record<string, string> = {};
      classesData.forEach((cls: any) => {
        nameToId[cls.name] = cls.id;
        idToName[cls.id] = cls.name;
      });
      setClassNameToId(nameToId);
      setClassIdToName(idToName);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Users
  React.useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData: UserAccount[] = [];
      snapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() } as UserAccount);
      });
      setUsers(usersData);
    });
    return () => unsubscribe();
  }, []);

  // Filter Logic
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch =
        user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesGroup = filterGroup === 'Tất cả' || user.group === filterGroup;

      return matchesSearch && matchesGroup;
    });
  }, [users, searchTerm, filterGroup]);

  // Handlers
  const handleDelete = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa người dùng này không? Hành động này không thể hoàn tác.')) {
      try {
        await deleteDoc(doc(db, 'users', id));
      } catch (error) {
        console.error("Error deleting user:", error);
        addToast('Không thể xóa người dùng. Vui lòng thử lại.', 'error');
      }
    }
  };

  const handleOpenAdd = () => {
    setFormData({
      status: 'active',
      role: 'teacher',
      roleLabel: 'Giáo viên',
      group: 'Tổ Chuyên Môn',
      accessScope: classes.length > 0 ? classes[0].id : 'choi', // Default to first class ID
      permissions: []
    });
    setNewPassword('');
    setIsEditMode(false);
    setIsResetPasswordMode(false);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (user: UserAccount) => {
    setFormData({ ...user });
    setIsEditMode(true);
    setIsResetPasswordMode(false);
    setNewPassword('');
    setIsFormModalOpen(true);
  };

  // Handle Role Change with Business Logic
  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRoleLabel = e.target.value;
    let newScope = '';
    let newGroup = formData.group;
    let newRole: UserRole = 'teacher';

    // Logic Mapping
    if (newRoleLabel === 'Hiệu Trưởng') {
      newScope = 'Toàn hệ thống';
      newGroup = 'Ban Giám Hiệu';
      newRole = 'admin';
    } else if (newRoleLabel === 'Phó Hiệu Trưởng') {
      newScope = 'Toàn trường';
      newGroup = 'Ban Giám Hiệu';
      newRole = 'vice_principal';
    } else if (newRoleLabel === 'Tổ trưởng chuyên môn') {
      newScope = 'Toàn bộ Tổ chuyên môn'; // Default, but editable
      newGroup = 'Tổ Chuyên Môn';
      newRole = 'head_teacher';
    } else if (newRoleLabel === 'Tổ phó chuyên môn') {
      newScope = 'Toàn bộ Tổ chuyên môn'; // Default, but editable
      newGroup = 'Tổ Chuyên Môn';
      newRole = 'vice_head_teacher';
    } else if (newRoleLabel === 'Giáo viên') {
      newScope = classes.length > 0 ? classes[0].id : 'choi'; // Default to first class ID
      newGroup = 'Tổ Chuyên Môn';
      newRole = 'teacher';
    } else if (newRoleLabel === 'Tổ trưởng tổ văn phòng') {
      newScope = 'Toàn bộ Tổ Văn phòng';
      newGroup = 'Tổ Văn Phòng';
      newRole = 'office_head';
    } else if (['Kế toán', 'Văn thư', 'Y tế', 'Nhân viên'].includes(newRoleLabel)) {
      newScope = 'Không gian Tổ Văn phòng';
      newGroup = 'Tổ Văn Phòng';
      newRole = 'staff';
    }

    setFormData({
      ...formData,
      role: newRole,
      roleLabel: newRoleLabel,
      accessScope: newScope,
      group: newGroup,
      permissions: formData.permissions || [] // Preserve existing permissions
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic Validation
    if (!formData.username || !formData.fullName || !formData.email) return;

    setIsSubmitting(true);

    try {
      if (isEditMode && formData.id) {
        // Update existing
        // Sanitize formData to remove undefined values
        const updateData = Object.fromEntries(
          Object.entries(formData).filter(([_, v]) => v !== undefined)
        );

        await updateDoc(doc(db, 'users', formData.id), updateData);

        // Handle password reset
        if (isResetPasswordMode && newPassword) {
          if (currentUser && formData.id === currentUser.id) {
            // Case 1: Changing OWN password -> Supported via Client SDK
            const { updatePassword } = await import('firebase/auth');
            const auth = getAuth();
            if (auth.currentUser) {
              await updatePassword(auth.currentUser, newPassword);
              addToast('Đã cập nhật mật khẩu của bạn thành công!', 'success');
            }
          } else {
            // Case 2: Changing OTHER's password -> Use Cloud Function
            try {
              const { httpsCallable } = await import('firebase/functions');
              const { functions } = await import('../firebase');
              const adminResetPassword = httpsCallable(functions, 'adminResetPassword');

              addToast('Đang gửi yêu cầu đổi mật khẩu...', 'info');

              await adminResetPassword({
                targetUserId: formData.id,
                newPassword: newPassword
              });

              addToast(`Đã đổi mật khẩu cho user ${formData.username} thành công!`, 'success');
            } catch (error: any) {
              console.error("Error calling adminResetPassword:", error);
              addToast(`Lỗi đổi mật khẩu: ${error.message}`, 'error');
            }
          }
        } else {
          addToast('Cập nhật thông tin hồ sơ thành công!', 'success');
        }

      } else {
        // Create new

        // 1. Create in Firebase Auth (using secondary app to avoid logout)
        let authUid = '';
        try {
          const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
          const secondaryAuth = getAuth(secondaryApp);
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, newPassword);
          authUid = userCredential.user.uid;
          await deleteApp(secondaryApp); // Cleanup
        } catch (authError: any) {
          console.error("Auth creation error:", authError);
          if (authError.code === 'auth/email-already-in-use') {
            addToast("Email này đã được sử dụng bởi tài khoản khác.", 'error');
          } else {
            addToast(`Lỗi tạo tài khoản Auth: ${authError.message}`, 'error');
          }
          setIsSubmitting(false);
          return;
        }

        // 2. Create in Firestore using the SAME UID from Auth
        // Note: We use setDoc with specific ID instead of addDoc (auto ID) to link them easily
        // But our system currently uses 'u...' IDs in seed data. 
        // To keep it consistent with Auth, we should use authUid as the document ID.
        // IMPORTANT: The AuthContext fallback logic we just added handles the mismatch, 
        // but best practice is to use authUid.

        await setDoc(doc(db, 'users', authUid), {
          ...formData,
          id: authUid, // Store ID inside doc too
          createdAt: new Date().toISOString()
        });

        addToast(`Đã tạo tài khoản thành công! Người dùng có thể đăng nhập ngay.`, 'success');
      }
      setIsFormModalOpen(false);
    } catch (error) {
      console.error("Error saving user:", error);
      addToast("Lỗi khi lưu dữ liệu.", 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (id: string) => {
    const user = users.find(u => u.id === id);
    if (user) {
      try {
        const newStatus = user.status === 'active' ? 'inactive' : 'active';
        await updateDoc(doc(db, 'users', id), {
          status: newStatus
        });
        addToast(`Đã ${newStatus === 'active' ? 'mở khóa' : 'khóa'} tài khoản thành công.`, 'success');
      } catch (error) {
        console.error("Error updating status:", error);
        addToast("Không thể cập nhật trạng thái.", 'error');
      }
    }
  };

  // Styling helpers
  const getRoleBadgeColor = (roleLabel: string) => {
    if (roleLabel.includes('Hiệu Trưởng') || roleLabel.includes('Admin')) return 'bg-red-100 text-red-700 border-red-200';
    if (roleLabel.includes('Phó Hiệu')) return 'bg-orange-100 text-orange-700 border-orange-200';
    if (roleLabel.includes('Tổ trưởng') || roleLabel.includes('Tổ phó') || roleLabel.includes('Kế toán')) return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  };

  // Render Dynamic Access Scope Section
  const renderAccessScopeSection = () => {
    const role = formData.role || '';

    // --- Case 1: Admin / School Board ---
    if (role === 'admin') {
      return (
        <div className="bg-red-50 p-4 rounded-lg border border-red-100 transition-all duration-300">
          <h4 className="text-sm font-bold text-red-800 mb-2 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Phạm vi truy cập & Quyền hạn
          </h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-red-700 uppercase mb-1">Phạm vi dữ liệu</label>
              <input
                type="text"
                disabled
                className="w-full border border-red-200 rounded px-3 py-1.5 text-sm bg-red-100/50 text-red-900 font-medium cursor-not-allowed"
                value="Toàn hệ thống"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-red-600 bg-white/50 p-2 rounded border border-red-100">
              <AlertCircle className="h-4 w-4" />
              Có quyền truy cập và quản lý tất cả các tổ/lớp.
            </div>
          </div>
        </div>
      );
    }

    // --- Case 1.5: Vice Principal ---
    if (role === 'vice_principal') {
      return (
        <div className="bg-teal-50 p-4 rounded-lg border border-teal-100 transition-all duration-300">
          <h4 className="text-sm font-bold text-teal-800 mb-2 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Phạm vi truy cập & Quyền hạn
          </h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-teal-700 uppercase mb-1">Phạm vi dữ liệu</label>
              <input
                type="text"
                disabled
                className="w-full border border-teal-200 rounded px-3 py-1.5 text-sm bg-teal-100/50 text-teal-900 font-medium cursor-not-allowed"
                value="Toàn trường (Theo phân quyền)"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-teal-600 bg-white/50 p-2 rounded border border-teal-100">
              <AlertCircle className="h-4 w-4" />
              Truy cập dữ liệu toàn trường. Các quyền quản trị hệ thống chịu ảnh hưởng bởi cài đặt "Quyền hạn bổ sung" từ Admin.
            </div>
          </div>
        </div>
      );
    }

    // --- Case 2: Professional Head ---
    if (role === 'head_teacher') {
      return (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 transition-all duration-300">
          <h4 className="text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
            <Users className="h-4 w-4" /> Phạm vi truy cập & Quyền hạn
          </h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-blue-700 uppercase mb-1">Phạm vi dữ liệu (Lớp phụ trách)</label>
              <select
                className="w-full border border-blue-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                value={formData.accessScope || ''}
                onChange={e => setFormData({ ...formData, accessScope: e.target.value })}
              >
                <option value="Toàn bộ Tổ chuyên môn">Toàn bộ Tổ chuyên môn (Không dạy lớp)</option>
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <CheckCircle className="h-3 w-3" />
              Quản lý chung Tổ chuyên môn VÀ quản lý lớp được chọn.
            </div>
          </div>
        </div>
      );
    }

    // --- Case 2.5: Vice Professional Head ---
    if (role === 'vice_head_teacher') {
      return (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 transition-all duration-300">
          <h4 className="text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
            <Users className="h-4 w-4" /> Phạm vi truy cập & Quyền hạn
          </h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-blue-700 uppercase mb-1">Phạm vi dữ liệu (Lớp phụ trách)</label>
              <select
                className="w-full border border-blue-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                value={formData.accessScope || ''}
                onChange={e => setFormData({ ...formData, accessScope: e.target.value })}
              >
                <option value="Toàn bộ Tổ chuyên môn">Toàn bộ Tổ chuyên môn (Không dạy lớp)</option>
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <CheckCircle className="h-3 w-3" />
              Quyền hạn tương đương Tổ trưởng: Quản lý chung Tổ chuyên môn VÀ quản lý lớp được chọn.
            </div>
          </div>
        </div>
      );
    }

    // --- Case 3: Teacher ---
    if (role === 'teacher') {
      return (
        <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 transition-all duration-300">
          <h4 className="text-sm font-bold text-emerald-800 mb-2 flex items-center gap-2">
            <School className="h-4 w-4" /> Phạm vi truy cập & Quyền hạn
          </h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-emerald-700 uppercase mb-1">Phạm vi dữ liệu (Chọn lớp)</label>
              <select
                className="w-full border border-emerald-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                value={formData.accessScope || ''}
                onChange={e => setFormData({ ...formData, accessScope: e.target.value })}
              >
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </div>
            <div className="mt-2">
              <p className="text-xs font-semibold text-emerald-700 mb-1">Quyền hạn:</p>
              <div className="flex gap-2">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[10px] font-medium">Upload file</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[10px] font-medium">Chỉnh sửa kế hoạch lớp</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // --- Case 3.5: Office Head ---
    if (role === 'office_head') {
      return (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 transition-all duration-300">
          <h4 className="text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
            <Users className="h-4 w-4" /> Phạm vi truy cập & Quyền hạn
          </h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-blue-700 uppercase mb-1">Phạm vi dữ liệu</label>
              <input
                type="text"
                disabled
                className="w-full border border-blue-200 rounded px-3 py-1.5 text-sm bg-blue-100/50 text-blue-900 font-medium cursor-not-allowed"
                value="Toàn bộ Tổ Văn phòng"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <CheckCircle className="h-3 w-3" />
              Quản lý chung Tổ Văn phòng (Bao gồm Y tế, Kế toán, Văn thư...).
            </div>
          </div>
        </div>
      );
    }

    // --- Case 4: Office Staff (Default fallback for others) ---
    return (
      <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 transition-all duration-300">
        <h4 className="text-sm font-bold text-purple-800 mb-2 flex items-center gap-2">
          <Briefcase className="h-4 w-4" /> Phạm vi truy cập & Quyền hạn
        </h4>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-purple-700 uppercase mb-1">Phạm vi dữ liệu</label>
            <input
              type="text"
              readOnly
              className="w-full border border-purple-200 rounded px-3 py-1.5 text-sm bg-purple-100/50 text-purple-900 font-medium focus:outline-none"
              value="Không gian Tổ Văn phòng"
            />
          </div>

          <div className="space-y-2 mt-2 bg-white/60 p-3 rounded border border-purple-100">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-purple-600" />
              <span className="text-xs text-gray-600">Văn bản chung (Bộ/Sở)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-purple-600" />
              <span className="text-xs text-gray-600">Kế hoạch & Thực đơn (Nội bộ VP)</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <button
                onClick={() => navigate('/')}
                className="flex items-center text-sm text-gray-500 hover:text-slate-600 transition-colors mb-2"
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Quay lại Dashboard
              </button>
              <div
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate('/')}
              >
                <div className="p-2 bg-slate-100 rounded-lg">
                  <ShieldCheck className="h-6 w-6 text-slate-700" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 uppercase">QUẢN TRỊ HỆ THỐNG</h1>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 border-b border-gray-200">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('users')}
                className={`px-6 py-3 text-sm font-semibold transition-all border-b-2 ${activeTab === 'users'
                  ? 'border-slate-700 text-slate-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <Users className="inline h-4 w-4 mr-2" />
                Quản lý Người dùng
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-6 py-3 text-sm font-semibold transition-all border-b-2 ${activeTab === 'settings'
                  ? 'border-slate-700 text-slate-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <ShieldCheck className="inline h-4 w-4 mr-2" />
                Cài đặt Ứng dụng
              </button>
            </div>
          </div>

          {/* Tools - Only show for users tab */}
          {activeTab === 'users' && (
            <div className="mt-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="flex overflow-x-auto pb-1 lg:pb-0 gap-2 w-full lg:w-auto no-scrollbar">
                {['Tất cả', 'Ban Giám Hiệu', 'Tổ Chuyên Môn', 'Tổ Văn Phòng'].map(group => (
                  <button
                    key={group}
                    onClick={() => setFilterGroup(group)}
                    className={`
                    whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all
                    ${filterGroup === group
                        ? 'bg-slate-700 text-white shadow-md shadow-slate-300'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}
                  `}
                  >
                    {group}
                  </button>
                ))}
              </div>

              <div className="flex w-full lg:w-auto gap-3">
                <div className="relative flex-grow lg:w-72 group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400 group-focus-within:text-slate-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 sm:text-sm transition-shadow"
                    placeholder="Tìm tên, email hoặc tài khoản..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <button
                  onClick={handleOpenAdd}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                >
                  <Plus className="h-5 w-5" />
                  <span className="hidden sm:inline">Tạo tài khoản</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'users' ? (
          // User Management Tab
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Người dùng
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Vai trò & Nhóm
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Phạm vi truy cập
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Trạng thái
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10">
                                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200">
                                  <User className="h-6 w-6" />
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{user.fullName}</div>
                                <div className="text-xs text-gray-500 flex flex-col sm:flex-row sm:gap-3">
                                  <span className="flex items-center gap-1"><User className="h-3 w-3" /> {user.username}</span>
                                  <span className="hidden sm:inline text-gray-300">|</span>
                                  <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {user.email}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col items-start gap-1.5">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeColor(user.roleLabel)}`}>
                                {user.roleLabel}
                              </span>
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Users className="h-3 w-3" /> {user.group}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-700 flex items-center gap-2">
                              <Briefcase className="h-4 w-4 text-gray-400" />
                              {classIdToName[user.accessScope] || user.accessScope}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <button
                              onClick={() => toggleStatus(user.id)}
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${user.status === 'active'
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                                }`}
                            >
                              {user.status === 'active' ? (
                                <><CheckCircle className="w-3 h-3 mr-1" /> Đang hoạt động</>
                              ) : (
                                <><XCircle className="w-3 h-3 mr-1" /> Đã khóa</>
                              )}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                            <div className="flex justify-center items-center gap-2">
                              <button
                                onClick={() => handleOpenEdit(user)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Chỉnh sửa"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(user.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Xóa tài khoản"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                          <div className="flex flex-col items-center">
                            <User className="h-12 w-12 text-gray-300 mb-3" />
                            <p className="text-base font-medium">Không tìm thấy người dùng nào</p>
                            <p className="text-sm mt-1">Thử thay đổi bộ lọc hoặc tạo mới</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
                <span>Tổng số {filteredUsers.length} người dùng</span>
              </div>
            </div>
          </>
        ) : (
          // App Settings Tab
          <AppSettingsTab />
        )}
      </div>

      {/* Add/Edit Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-800 px-6 py-4 flex justify-between items-center flex-shrink-0">
              <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                {isEditMode ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                {isEditMode ? 'Cập nhật thông tin' : 'Tạo tài khoản mới'}
              </h3>
              <button onClick={() => setIsFormModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form id="userForm" onSubmit={handleSave} className="space-y-6">

                {/* Section 1: Account Info */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="text-sm font-bold text-gray-700 uppercase mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" /> Thông tin tài khoản
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tên đăng nhập <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        disabled={isEditMode} // Usually username is immutable
                        className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all ${isEditMode ? 'bg-gray-100 text-gray-500' : ''}`}
                        placeholder="VD: nguyenvanan"
                        value={formData.username || ''}
                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                      <input
                        type="email"
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all"
                        placeholder="VD: an@truong.edu.vn"
                        value={formData.email || ''}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Password Logic */}
                  {!isEditMode ? (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu khởi tạo <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <input
                          type="password"
                          required={!isEditMode}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all"
                          placeholder="Nhập mật khẩu..."
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                        />
                        <Lock className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-gray-700">Mật khẩu</label>
                        <button
                          type="button"
                          onClick={() => setIsResetPasswordMode(!isResetPasswordMode)}
                          className="text-xs text-blue-600 hover:underline font-medium"
                        >
                          {isResetPasswordMode ? 'Hủy đổi mật khẩu' : 'Reset mật khẩu'}
                        </button>
                      </div>

                      {isResetPasswordMode && (
                        <div className="mt-2 animate-in fade-in slide-in-from-top-2">
                          <input
                            type="password"
                            className="w-full border border-blue-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-blue-50"
                            placeholder="Nhập mật khẩu mới..."
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                          />
                          <p className="text-xs text-blue-600 mt-1 italic">Nhập mật khẩu mới để thay đổi cho người dùng này.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Section 2: Personal Info */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên hiển thị <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all"
                    placeholder="VD: Nguyễn Văn An"
                    value={formData.fullName || ''}
                    onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </div>

                {/* Section 3: Roles & Permissions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nhóm người dùng <span className="text-red-500">*</span></label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all bg-white"
                      value={formData.group || 'Tổ Chuyên Môn'}
                      onChange={e => setFormData({ ...formData, group: e.target.value })}
                    >
                      <option value="Ban Giám Hiệu">Ban Giám Hiệu</option>
                      <option value="Tổ Chuyên Môn">Tổ Chuyên Môn</option>
                      <option value="Tổ Văn Phòng">Tổ Văn Phòng</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vai trò cụ thể <span className="text-red-500">*</span></label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all bg-white"
                      value={formData.roleLabel || 'Giáo viên'}
                      onChange={handleRoleChange}
                    >
                      <option value="Hiệu Trưởng">Hiệu Trưởng</option>
                      <option value="Phó Hiệu Trưởng">Phó Hiệu Trưởng</option>
                      <option value="Tổ trưởng chuyên môn">Tổ trưởng chuyên môn</option>
                      <option value="Tổ phó chuyên môn">Tổ phó chuyên môn</option>
                      <option value="Giáo viên">Giáo viên</option>
                      <option value="Tổ trưởng tổ văn phòng">Tổ trưởng tổ văn phòng</option>
                      <option value="Kế toán">Kế toán</option>
                      <option value="Văn thư">Văn thư</option>
                      <option value="Y tế">Y tế</option>
                      <option value="Nhân viên">Nhân viên</option>
                    </select>
                  </div>
                </div>

                {/* Dynamic Access Scope Section */}
                {renderAccessScopeSection()}

                {/* Section 4: Extra Permissions */}
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 mt-4">
                  <h4 className="text-sm font-bold text-orange-800 mb-2 flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" /> Quyền hạn bổ sung
                  </h4>
                  <div className="space-y-2">
                    {/* Permission: Manage Documents */}
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          className="peer h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded transition-all cursor-pointer"
                          checked={formData.permissions?.includes('manage_documents') || false}
                          onChange={(e) => {
                            const currentPerms = formData.permissions || [];
                            if (e.target.checked) {
                              setFormData({ ...formData, permissions: [...currentPerms, 'manage_documents'] });
                            } else {
                              setFormData({ ...formData, permissions: currentPerms.filter(p => p !== 'manage_documents') });
                            }
                          }}
                        />
                      </div>
                      <span className="text-sm text-gray-700 group-hover:text-orange-700 transition-colors">
                        Được phép quản lý văn bản (Upload, Chỉnh sửa, Xóa)
                      </span>
                    </label>
                    <p className="text-xs text-orange-600 pl-6 mb-3">
                      * Cho phép người dùng này đăng tải và quản lý các văn bản chung của trường.
                    </p>

                    {/* Permission: Manage Office Docs */}
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          className="peer h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded transition-all cursor-pointer"
                          checked={formData.permissions?.includes('manage_office_docs') || false}
                          onChange={(e) => {
                            const currentPerms = formData.permissions || [];
                            if (e.target.checked) {
                              setFormData({ ...formData, permissions: [...currentPerms, 'manage_office_docs'] });
                            } else {
                              setFormData({ ...formData, permissions: currentPerms.filter(p => p !== 'manage_office_docs') });
                            }
                          }}
                        />
                      </div>
                      <span className="text-sm text-gray-700 group-hover:text-purple-700 transition-colors">
                        Quản lý văn bản Tổ Văn phòng
                      </span>
                    </label>
                    <p className="text-xs text-purple-600 pl-6 mb-3">
                      * Cho phép upload, sửa, xóa văn bản trong khu vực Tổ Văn phòng.
                    </p>

                    {/* Permission: Manage Boarding Docs */}
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          className="peer h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded transition-all cursor-pointer"
                          checked={formData.permissions?.includes('manage_boarding_docs') || false}
                          onChange={(e) => {
                            const currentPerms = formData.permissions || [];
                            if (e.target.checked) {
                              setFormData({ ...formData, permissions: [...currentPerms, 'manage_boarding_docs'] });
                            } else {
                              setFormData({ ...formData, permissions: currentPerms.filter(p => p !== 'manage_boarding_docs') });
                            }
                          }}
                        />
                      </div>
                      <span className="text-sm text-gray-700 group-hover:text-indigo-700 transition-colors">
                        Quản lý tài liệu Bán trú
                      </span>
                    </label>
                    <p className="text-xs text-indigo-600 pl-6 mb-3">
                      * Cho phép upload, sửa, xóa tài liệu bán trú (thực đơn, an toàn thực phẩm).
                    </p>

                    {/* Permission: Manage Plans */}
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          className="peer h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-all cursor-pointer"
                          checked={formData.permissions?.includes('manage_plans') || false}
                          onChange={(e) => {
                            const currentPerms = formData.permissions || [];
                            if (e.target.checked) {
                              setFormData({ ...formData, permissions: [...currentPerms, 'manage_plans'] });
                            } else {
                              setFormData({ ...formData, permissions: currentPerms.filter(p => p !== 'manage_plans') });
                            }
                          }}
                        />
                      </div>
                      <span className="text-sm text-gray-700 group-hover:text-blue-700 transition-colors">
                        Quản lý kế hoạch Tổ Chuyên môn
                      </span>
                    </label>
                    <p className="text-xs text-blue-600 pl-6 mb-3">
                      * Cho phép upload, sửa, xóa kế hoạch dạy học (Chỉ dành cho Admin/Head Teacher).
                    </p>

                    {/* Permission: Access System Admin */}
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          className="peer h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded transition-all cursor-pointer"
                          checked={formData.permissions?.includes('access_system_admin') || false}
                          onChange={(e) => {
                            const currentPerms = formData.permissions || [];
                            if (e.target.checked) {
                              setFormData({ ...formData, permissions: [...currentPerms, 'access_system_admin'] });
                            } else {
                              setFormData({ ...formData, permissions: currentPerms.filter(p => p !== 'access_system_admin') });
                            }
                          }}
                        />
                      </div>
                      <span className="text-sm text-gray-700 group-hover:text-red-700 transition-colors">
                        Được phép truy cập Quản trị hệ thống
                      </span>
                    </label>
                    <p className="text-xs text-red-600 pl-6">
                      * CẤP QUYỀN CAO NHẤT: Cho phép truy cập vào trang quản trị hệ thống (Dành cho Phó Hiệu trưởng hoặc Thư ký).
                    </p>
                  </div>
                </div>

              </form>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white hover:shadow-sm rounded-lg border border-transparent hover:border-gray-300 transition-all"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                form="userForm"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Đang xử lý...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" /> {isEditMode ? 'Lưu thay đổi' : 'Tạo tài khoản'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemAdmin;
