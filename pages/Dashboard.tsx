import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DASHBOARD_CARDS } from '../constants';
import { MOCK_CLASSES } from '../data/mockData';
import DashboardCard from '../components/DashboardCard';
import {
  LayoutGrid,
  FolderOpen,
  Landmark,
  School,
  ArrowRight,
  Briefcase,
  FileText,
  Utensils,
  Lock,
  ChevronRight,
  GraduationCap,
  BookOpen
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';



import { collection, query, onSnapshot, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { seedDatabase } from '../utils/seedData';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [classes, setClasses] = React.useState<any[]>([]);

  // Fetch Classes from Firestore
  useEffect(() => {
    const q = query(collection(db, 'classes'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const classData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // Fetch ALL teachers/head_teachers once
      const teachersQuery = query(
        collection(db, 'users'),
        where('role', 'in', ['teacher', 'head_teacher'])
      );
      const teachersSnapshot = await getDocs(teachersQuery);
      const allTeachers = teachersSnapshot.docs.map(doc => doc.data());

      // Helper function for case-insensitive comparison
      const normalizeStr = (str: string) => str.toLowerCase().trim().replace(/\s+/g, ' ');

      // Match teachers to each class
      const classesWithTeachers = classData.map((cls: any) => {
        const foundTeachers = new Set<string>();

        const normalizedClassId = normalizeStr(cls.id);
        const normalizedClassName = normalizeStr(cls.name);

        allTeachers.forEach(teacher => {
          if (!teacher.accessScope) return;

          const normalizedScope = normalizeStr(teacher.accessScope);

          // Match by ID or Name (case-insensitive)
          if (normalizedScope === normalizedClassId ||
            normalizedScope === normalizedClassName ||
            normalizedClassName.includes(normalizedScope) ||
            normalizedScope.includes(normalizedClassName)) {
            foundTeachers.add(teacher.fullName);
          }
        });

        const teacherNames = Array.from(foundTeachers);

        return {
          ...cls,
          teachers: teacherNames.length > 0 ? teacherNames : ['Chưa phân công'],
          teacher: teacherNames.length > 0 ? teacherNames.join(', ') : 'Chưa phân công'
        };
      });

      // Sort by name
      classesWithTeachers.sort((a: any, b: any) => a.name.localeCompare(b.name));
      setClasses(classesWithTeachers);
    });

    return () => unsubscribe();
  }, []);

  // Protect Dashboard
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  if (!user) return null;

  const handleCardClick = (id: string) => {
    if (id === 'van-ban-chi-dao') {
      navigate('/van-ban-chi-dao');
    } else if (id === 'van-ban-truong') {
      navigate('/van-ban-truong');
    } else if (id === 'quan-tri-he-thong') {
      navigate('/quan-tri-he-thong');
    } else if (id === 'to-van-phong-ke-hoach') {
      navigate('/to-van-phong-ke-hoach');
    } else if (id === 'to-van-phong-thuc-don') {
      // Permission Check: Block "Tổ Chuyên Môn" but allow Admin/Staff
      if (user.group === 'Tổ Chuyên Môn' && user.role !== 'admin') {
        alert("Bạn không có quyền truy cập phân hệ này. Khu vực dành riêng cho Ban Giám Hiệu và Tổ Văn Phòng.");
        return;
      }
      navigate('/to-van-phong-thuc-don');
    } else if (id === 'to-chuyen-mon-ke-hoach') {
      navigate('/to-chuyen-mon-ke-hoach');
    } else if (id.startsWith('class-')) {
      // Handle specific class navigation
      const classId = id.replace('class-', '');

      // RBAC: Teachers can only access their own class or Admin/Head can access all
      if (user.role === 'teacher') {
        // Use the fetched classes state if available, otherwise fallback (or wait)
        // Since this is an event handler, classes should be populated.
        const targetClass = classes.find(c => c.id === classId);
        const scope = user.accessScope?.toLowerCase().trim();

        // If classes haven't loaded yet, we might want to allow or block. 
        // Assuming fast load, but let's be safe. If not found, maybe it's invalid ID.
        if (targetClass && (scope !== classId.toLowerCase() && scope !== targetClass.name.toLowerCase())) {
          alert("Bạn chỉ có quyền truy cập vào lớp của mình.");
          return;
        }
      }

      navigate(`/class/${classId}`);
    } else {
      console.log(`Navigating to category: ${id}`);
      alert(`Đang truy cập vào phân hệ: ${id} (Đang phát triển)`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Welcome Section */}
      <div className="bg-white border-b border-gray-200 pt-8 pb-8 mb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-2">
            <LayoutGrid className="h-5 w-5 text-yellow-500" />
            <span className="text-sm font-semibold text-yellow-600 uppercase tracking-wider">Bảng điều khiển quản trị</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
            Xin chào cô: {user.fullName}
          </h2>
          <p className="text-gray-500 mt-1">
            Vai trò: <span className="font-medium text-gray-800">{user.roleLabel}</span> - <span className="font-medium text-gray-800">{user.group}</span>
          </p>
        </div>
      </div>

      {/* Card Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 xl:gap-8">

          {/* --- 1. QUẢN LÝ VĂN BẢN CHUNG (Everyone sees this) --- */}
          <div className="group relative overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-lg transition-all duration-500 ease-out hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-200 hover:border-blue-300 flex flex-col">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 blur-3xl opacity-50"></div>

            <div className="p-8 pb-4 relative z-10">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 shadow-sm group-hover:scale-110 transition-transform duration-500">
                <FolderOpen className="h-7 w-7" />
              </div>
              <h3 className="mb-2 text-2xl font-bold text-gray-800 tracking-tight group-hover:text-blue-700 transition-colors">
                QUẢN LÝ VĂN BẢN CHUNG
              </h3>
              <p className="text-gray-500 leading-relaxed text-sm">
                Lưu trữ và quản lý tập trung các văn bản hành chính đi và đến.
              </p>
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-100 border-t border-gray-100 mt-2">
              <div
                onClick={() => navigate('/van-ban-chi-dao')}
                className="bg-white p-6 cursor-pointer hover:bg-blue-50/50 transition-colors group/item relative"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                    <Landmark className="h-6 w-6" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-blue-400 opacity-0 -translate-x-2 group-hover/item:opacity-100 group-hover/item:translate-x-0 transition-all" />
                </div>
                <h4 className="font-bold text-gray-800 mb-1 group-hover/item:text-blue-700">Văn bản Cấp trên</h4>
                <div className="flex flex-wrap gap-1">
                  <span className="text-[10px] font-medium px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded border border-gray-200">Sở/Bộ GD</span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded border border-gray-200">UBND</span>
                </div>
              </div>

              <div
                onClick={() => navigate('/van-ban-truong')}
                className="bg-white p-6 cursor-pointer hover:bg-emerald-50/50 transition-colors group/item relative"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                    <School className="h-6 w-6" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-emerald-400 opacity-0 -translate-x-2 group-hover/item:opacity-100 group-hover/item:translate-x-0 transition-all" />
                </div>
                <h4 className="font-bold text-gray-800 mb-1 group-hover/item:text-emerald-700">Văn bản Nội bộ</h4>
                <div className="flex flex-wrap gap-1">
                  <span className="text-[10px] font-medium px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded border border-gray-200">Kế hoạch</span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded border border-gray-200">Quyết định</span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded border border-gray-200">Báo cáo</span>
                </div>
              </div>
            </div>
          </div>

          {/* --- 2. TỔ VĂN PHÒNG (Visible to Admin, Vice Principal & Office Staff) --- */}
          {(user.role === 'admin' || user.role === 'vice_principal' || user.role === 'staff' || user.group === 'Tổ Văn Phòng') && (
            <div className="group relative overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-lg transition-all duration-500 ease-out hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-200 hover:border-indigo-300 flex flex-col">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-indigo-50 to-purple-100 blur-3xl opacity-50 group-hover:opacity-80 transition-opacity"></div>

              <div className="p-8 pb-4 relative z-10">
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-600 shadow-sm group-hover:scale-110 transition-transform duration-500">
                  <Briefcase className="h-7 w-7" />
                </div>
                <h3 className="mb-2 text-2xl font-bold text-gray-800 tracking-tight group-hover:text-indigo-700 transition-colors">
                  TỔ VĂN PHÒNG
                </h3>
                <p className="text-gray-500 leading-relaxed text-sm">
                  Quản lý hành chính, nhân sự, tài sản, y tế, thực đơn và các công tác hỗ trợ khác.
                </p>
              </div>

              <div className="flex-1 flex flex-col sm:flex-row border-t border-indigo-50 mt-4">
                {/* Block A */}
                <div
                  onClick={() => handleCardClick('to-van-phong-ke-hoach')}
                  className="flex-1 p-6 cursor-pointer hover:bg-indigo-50/60 transition-colors border-b sm:border-b-0 sm:border-r border-indigo-50 group/item"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg shadow-sm">
                      <FileText className="h-5 w-5" />
                    </div>
                  </div>
                  <h4 className="text-sm font-bold text-gray-800 mb-1 group-hover/item:text-indigo-700">KẾ HOẠCH & BÁO CÁO</h4>
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">Kế hoạch tài chính, Y tế, Hoạt động chung</p>
                </div>

                {/* Block B */}
                <div
                  onClick={() => handleCardClick('to-van-phong-thuc-don')}
                  className="flex-1 p-6 cursor-pointer hover:bg-purple-50/60 transition-colors group/item"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 bg-purple-100 text-purple-600 rounded-lg shadow-sm">
                      <Utensils className="h-5 w-5" />
                    </div>
                  </div>
                  <h4 className="text-sm font-bold text-gray-800 mb-1 group-hover/item:text-purple-700">THỰC ĐƠN & BÁN TRÚ</h4>
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">Quản lý thực đơn tuần và Vệ sinh ATTP</p>
                </div>
              </div>
            </div>
          )}

          {/* --- 3. TỔ CHUYÊN MÔN (Visible to Admin, Vice Principal, HeadTeacher, Teacher) --- */}
          {(user.role === 'admin' || user.role === 'vice_principal' || user.role === 'head_teacher' || user.role === 'vice_head_teacher' || user.role === 'teacher') && (
            <div className="group relative overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-lg transition-all duration-500 ease-out hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-200 hover:border-amber-300 flex flex-col">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-amber-50 to-orange-100 blur-3xl opacity-50 group-hover:opacity-80 transition-opacity"></div>

              <div className="p-8 pb-2 relative z-10">
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 shadow-sm group-hover:scale-110 transition-transform duration-500">
                  <GraduationCap className="h-8 w-8" />
                </div>
                <h3 className="mb-2 text-2xl font-bold text-gray-800 tracking-tight group-hover:text-amber-700 transition-colors">
                  TỔ CHUYÊN MÔN
                </h3>
                <p className="text-gray-500 leading-relaxed text-sm mb-4">
                  Kế hoạch giảng dạy, bài soạn, chuyên đề, dữ liệu các lớp và tài liệu tham khảo.
                </p>
              </div>

              {/* Section 1: Organization Plans */}
              <div className="px-6 pb-4 relative z-10">
                <div
                  onClick={() => handleCardClick('to-chuyen-mon-ke-hoach')}
                  className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-100 cursor-pointer hover:bg-amber-100 transition-colors group/plan"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg text-amber-600 shadow-sm">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-800 group-hover/plan:text-amber-700">Kế hoạch Tổ & Biên bản</h4>
                    </div>
                  </div>
                  <div className="text-xs font-bold text-amber-600 underline opacity-0 group-hover/plan:opacity-100 transition-opacity">
                    Xem chi tiết
                  </div>
                </div>
              </div>

              <div className="flex-1 bg-gray-50/50 border-t border-amber-100 p-6 pt-4">
                <div className="mb-4">
                  <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-l-4 border-amber-400 pl-3">
                    LỚP HỌC CỦA TÔI
                  </h4>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {classes.map((cls) => {
                    // Filter classes for Teacher role
                    if (user.role === 'teacher') {
                      // Allow access if scope matches ID OR Name (case-insensitive for robustness)
                      const scope = user.accessScope?.toLowerCase().trim();
                      const classId = cls.id.toLowerCase();
                      const className = cls.name.toLowerCase();

                      if (scope !== classId && scope !== className) return null;
                    }

                    return (
                      <button
                        key={cls.id}
                        onClick={() => handleCardClick(`class-${cls.id}`)}
                        className="relative group/btn flex flex-col items-center justify-center py-2 px-1 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-amber-300 hover:shadow-md hover:bg-amber-50 transition-all"
                      >
                        <span className="text-xs font-bold text-gray-700 group-hover/btn:text-amber-800">{cls.name}</span>
                        {cls.newFiles > 0 && (
                          <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full border-2 border-white shadow-sm animate-pulse"></span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* --- Remaining Standard Cards (Admin & Authorized Vice Principal) --- */}
          {(user.role === 'admin' || (user.role === 'vice_principal' && user.permissions?.includes('access_system_admin'))) && DASHBOARD_CARDS.map((card) => (
            <DashboardCard
              key={card.id}
              data={card}
              onClick={handleCardClick}
            />
          ))}
        </div>

        {/* Quick Stats / Footer Area (Just visuals) */}

      </div>
    </div>
  );
};

export default Dashboard;