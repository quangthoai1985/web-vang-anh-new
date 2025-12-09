import React, { useState, useEffect } from 'react';
import { MOCK_CLASSES } from '../data/mockData';
import { useParams, useNavigate } from 'react-router-dom';
import {
   ChevronRight,
   Upload,
   Folder,
   FileText,
   MessageCircle,
   MoreVertical,
   Filter,
   Search,
   ArrowLeft,
   Calendar,
   Download,
   Trash2,
   X,
   Send,
   Lock,
   Star,
   LayoutGrid,
   List,
   Baby,
   FlaskConical,
   Maximize2,
   Eye,
   ZoomIn,
   ZoomOut,
   CloudUpload,
   CheckCircle,
   AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { createNotification } from '../utils/notificationUtils';

import { ClassFile, MonthFolder } from '../types';
import { MOCK_FOLDERS } from '../data/mockData';

// Helper function to get current school year
const getCurrentSchoolYear = () => {
   const now = new Date();
   const currentMonth = now.getMonth() + 1; // 1-12
   const currentYear = now.getFullYear();

   // School year starts in September
   // If current month is Aug (8) or earlier, we're in the previous school year
   // If current month is Sep (9) or later, we're in the current school year
   return currentMonth >= 9 ? currentYear : currentYear - 1;
};

// Generate dynamic month folders for current school year
const generateSchoolYearFolders = () => {
   const schoolYear = getCurrentSchoolYear();
   const nextYear = schoolYear + 1;

   return [
      { id: 'm9', name: `Tháng 09/${schoolYear}`, fileCount: 0, files: [] },
      { id: 'm10', name: `Tháng 10/${schoolYear}`, fileCount: 0, files: [] },
      { id: 'm11', name: `Tháng 11/${schoolYear}`, fileCount: 0, files: [] },
      { id: 'm12', name: `Tháng 12/${schoolYear}`, fileCount: 0, files: [] },
      { id: 'm01', name: `Tháng 01/${nextYear}`, fileCount: 0, files: [] },
      { id: 'm02', name: `Tháng 02/${nextYear}`, fileCount: 0, files: [] },
      { id: 'm03', name: `Tháng 03/${nextYear}`, fileCount: 0, files: [] },
      { id: 'm04', name: `Tháng 04/${nextYear}`, fileCount: 0, files: [] },
      { id: 'm05', name: `Tháng 05/${nextYear}`, fileCount: 0, files: [] },
   ];
};

const MONTH_OPTIONS = [
   { value: '09', label: 'Tháng 9' },
   { value: '10', label: 'Tháng 10' },
   { value: '11', label: 'Tháng 11' },
   { value: '12', label: 'Tháng 12' },
   { value: '01', label: 'Tháng 1' },
   { value: '02', label: 'Tháng 2' },
   { value: '03', label: 'Tháng 3' },
   { value: '04', label: 'Tháng 4' },
   { value: '05', label: 'Tháng 5' },
];

const WEEK_OPTIONS = [
   { value: '1', label: 'Tuần 1' },
   { value: '2', label: 'Tuần 2' },
   { value: '3', label: 'Tuần 3' },
   { value: '4', label: 'Tuần 4' },
];

import { collection, query, where, onSnapshot, doc, getDoc, getDocs, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getPreviewUrl } from '../utils/fileUtils';

const ClassRecords: React.FC = () => {
   const { classId } = useParams<{ classId: string }>();
   const navigate = useNavigate();
   const { user } = useAuth();
   const { addToast } = useNotification();

   // Helper function để so sánh accessScope linh hoạt
   const matchesClassScope = (scope: string | undefined, classId: string, className: string | undefined): boolean => {
      if (!scope) return false;

      // Normalize for comparison (lowercase, trim, remove extra spaces)
      const normalizeStr = (str: string) => str.toLowerCase().trim().replace(/\s+/g, ' ');

      const normalizedScope = normalizeStr(scope);
      const normalizedId = normalizeStr(classId);
      const normalizedName = className ? normalizeStr(className) : '';

      // Multiple matching strategies:
      // 1. Exact ID match (e.g., "la2" === "la2")
      if (normalizedScope === normalizedId) return true;

      // 2. Exact name match (e.g., "lớp lá 2" === "lớp lá 2")
      if (normalizedScope === normalizedName) return true;

      // 3. Scope contains class name (e.g., "Lớp Lá 2" contains within scope)
      if (normalizedName && normalizedScope.includes(normalizedName)) return true;

      // 4. Class name contains scope (e.g., scope "lá 2" is in "lớp lá 2")
      if (normalizedName && normalizedName.includes(normalizedScope)) return true;

      console.log('[matchesClassScope] No match:', { scope, classId, className, normalizedScope, normalizedName });
      return false;
   };

   // State
   const [currentClass, setCurrentClass] = useState<any | null>(null);
   const [folders, setFolders] = useState<MonthFolder[]>(generateSchoolYearFolders()); // Dynamic folders
   const [allFiles, setAllFiles] = useState<any[]>([]); // Store all files for filtering
   const [loading, setLoading] = useState(true);

   // State
   const [activeTab, setActiveTab] = useState<'plan' | 'assessment' | 'students' | 'steam'>('students');
   const [planSubTab, setPlanSubTab] = useState<'year' | 'month' | 'week'>('week'); // Default to week (most common)
   const [expandedFolderId, setExpandedFolderId] = useState<string | null>('m11'); // Default open latest month
   const [filter, setFilter] = useState<'all' | 'new' | 'unread'>('all');

   // Drawer Interaction
   const [selectedFile, setSelectedFile] = useState<ClassFile | null>(null);
   const [isDrawerOpen, setIsDrawerOpen] = useState(false);
   const [isFullScreenPreviewOpen, setIsFullScreenPreviewOpen] = useState(false);
   const [newComment, setNewComment] = useState('');

   // Upload Modal State
   const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
   const [uploadFile, setUploadFile] = useState<File | null>(null);
   const [uploadFormData, setUploadFormData] = useState({
      area: 'plan' as 'plan' | 'assessment' | 'students' | 'steam',
      planType: 'week' as 'year' | 'month' | 'week', // Default
      month: '11', // Default current month
      week: '1',
      name: '',
      note: ''
   });

   // Delete Modal State
   const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
   const [fileToDelete, setFileToDelete] = useState<{ file: ClassFile, folderId: string } | null>(null);

   // Fetch Class Details
   useEffect(() => {
      if (!classId) return;

      const fetchClass = async () => {
         try {
            const docRef = doc(db, 'classes', classId);
            const docSnap = await getDoc(docRef);

            let finalClassData: any = null;
            let teacherNames: string[] = [];

            if (docSnap.exists()) {
               finalClassData = docSnap.data();
            } else {
               console.warn("Class not found in Firestore, checking Mock...");
               const mockClass = MOCK_CLASSES.find(c => c.id === classId);
               if (mockClass) {
                  finalClassData = mockClass;
               }
            }

            if (finalClassData) {
               console.log('[ClassRecords] Class data loaded:', { classId, className: finalClassData.name, currentUser: user?.fullName, userScope: user?.accessScope, userRole: user?.role });

               // Helper function for case-insensitive comparison
               const normalizeStr = (str: string) => str.toLowerCase().trim().replace(/\s+/g, ' ');

               // Query for ALL teachers/head_teachers
               try {
                  const teachersQuery = query(
                     collection(db, 'users'),
                     where('role', 'in', ['teacher', 'head_teacher', 'vice_head_teacher'])
                  );
                  const teachersSnapshot = await getDocs(teachersQuery);
                  const allTeachers = teachersSnapshot.docs.map(doc => doc.data());

                  const foundTeachers = new Set<string>();
                  const normalizedClassId = normalizeStr(classId);
                  const normalizedClassName = normalizeStr(finalClassData.name);

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

                  teacherNames = Array.from(foundTeachers);
                  console.log('[ClassRecords] Found teachers from DB:', teacherNames);

                  if (teacherNames.length === 0) {
                     console.warn('[ClassRecords] No teacher found for class:', classId);
                     teacherNames = ['Chưa phân công'];
                  }
               } catch (err) {
                  console.error("Error fetching teacher details:", err);
                  teacherNames = ['Chưa phân công'];
               }

               // Store teachers as array for display
               setCurrentClass({
                  id: classId,
                  ...finalClassData,
                  teachers: teacherNames,
                  // Keep single teacher for backward compatibility
                  teacher: teacherNames.join(', ')
               });
            }
         } catch (error) {
            console.error("Error fetching class:", error);
         } finally {
            setLoading(false);
         }
      };

      fetchClass();
   }, [classId]);

   // Fetch Class Files
   useEffect(() => {
      if (!classId) return;

      const q = query(collection(db, 'class_files'), where('classId', '==', classId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
         const files = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
         setAllFiles(files); // Update allFiles state

         console.log('[ClassRecords] Fetched files from Firestore:', files.length);
         files.forEach(f => console.log(`  - ${f.name} | month: "${f.month}" | type: ${f.planType}`));

         // Group files by month
         // Support both formats: month='11' and month='m11'
         const dynamicFolders = generateSchoolYearFolders();
         const newFolders = dynamicFolders.map(folder => {
            const matchingFiles = files.filter(f => {
               // 0. Filter by Category (Default to 'plan' if missing, for backward compatibility)
               // BUT: We only want to show 'plan' files in the folders.
               // If we have other categories, we should filter them out here if we are only using 'folders' for the Plan tab.
               // However, the 'folders' state is currently used ONLY for the Plan tab (Month/Week views).
               // So we should strictly filter for plan-related files here.
               const fileCategory = f.category || 'plan'; // Default to plan
               if (fileCategory !== 'plan') return false;

               // 1. Filter by Month
               // Normalize month values to handle all format variations (09, 9, m09, m9)
               let isMonthMatch = false;

               // Extract numeric month from folder ID (remove 'm' prefix if present)
               const folderMonth = folder.id.replace('m', '');

               // Extract numeric month from file (remove 'm' prefix if present)
               const fileMonth = String(f.month || '').replace('m', '');

               // Compare numeric values (this handles 09 vs 9)
               if (parseInt(folderMonth, 10) === parseInt(fileMonth, 10)) {
                  isMonthMatch = true;
               }

               if (!isMonthMatch) return false;

               // 2. Filter by Plan Type (for the 'folders' state, we might want to keep all and filter in render, 
               // OR filter here. Let's keep all here and filter in render to avoid re-computing folders too often if we switch sub-tabs)
               // Actually, it's better to just store all files in the folders and filter at render time 
               // to allow smooth switching without re-fetching/re-calculating too much.
               return true;
            });

            return {
               ...folder,
               files: matchingFiles,
               fileCount: matchingFiles.length
            };
         });

         console.log('[ClassRecords] Grouped files into folders:', newFolders.map(f => `${f.name}: ${f.fileCount} files`));
         setFolders(newFolders);
      });

      return () => unsubscribe();
   }, [classId]);

   // Permission Check
   useEffect(() => {
      if (!user || loading) return;

      // If teacher, must match accessScope (ID or Name)
      if (user.role === 'teacher') {
         // Only check if we have a valid class to check against
         if (currentClass && !matchesClassScope(user.accessScope, classId!, currentClass.name)) {
            console.warn('[ClassRecords] Permission denied:', { userScope: user.accessScope, classId, className: currentClass.name });
            alert("Bạn không có quyền truy cập vào lớp này.");
            navigate('/');
         }
      }
   }, [user, classId, navigate, currentClass, loading]);

   if (loading) {
      return (
         <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
         </div>
      );
   }

   if (!currentClass) {
      return (
         <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
               <h2 className="text-2xl font-bold text-gray-800">Không tìm thấy lớp học</h2>
               <button onClick={() => navigate('/')} className="mt-4 text-blue-600 hover:underline">
                  Quay lại Dashboard
               </button>
            </div>
         </div>
      );
   }


   // Permission Check for Upload Button
   // Rule: Admin -> Hide. HeadTeacher -> Hide (at Class level). Teacher -> Show (if own class).
   // UPDATE: HeadTeacher can also upload if they are assigned to this class.
   const canUpload = (user?.role === 'teacher' || user?.role === 'head_teacher' || user?.role === 'vice_head_teacher') && matchesClassScope(user.accessScope, classId!, currentClass?.name);

   console.log('[ClassRecords] Upload permission:', {
      canUpload,
      userRole: user?.role,
      userScope: user?.accessScope,
      classId,
      className: currentClass?.name
   });

   // Handlers
   const handleFileClick = (file: ClassFile, e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedFile(file);
      setIsDrawerOpen(true);
   };

   const openDeleteModal = (file: ClassFile, folderId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setFileToDelete({ file, folderId });
      setIsDeleteModalOpen(true);
   };

   const confirmDelete = async () => {
      if (fileToDelete) {
         try {
            console.log('[DELETE] Attempting to delete file:', {
               fileId: fileToDelete.file.id,
               fileName: fileToDelete.file.name,
               classId
            });

            await deleteDoc(doc(db, 'class_files', fileToDelete.file.id));

            console.log('[DELETE] Successfully deleted file from Firestore');
            addToast("Đã xóa tài liệu thành công", "Hồ sơ đã được xóa khỏi thư mục lớp.", "success");
         } catch (error: any) {
            console.error("[DELETE] Error deleting file:", error);
            console.error("[DELETE] Error code:", error.code);
            console.error("[DELETE] Error message:", error.message);

            let errorMessage = "Vui lòng thử lại sau.";
            if (error.code === 'permission-denied') {
               errorMessage = "Bạn không có quyền xóa tài liệu này. Vui lòng liên hệ Ban Giám Hiệu.";
            }

            addToast("Lỗi khi xóa tài liệu", errorMessage, "error");
         } finally {
            setIsDeleteModalOpen(false);
            setFileToDelete(null);
         }
      }
   };

   const toggleFolder = (folderId: string) => {
      if (expandedFolderId === folderId) {
         setExpandedFolderId(null);
      } else {
         setExpandedFolderId(folderId);
      }
   };

   const getFileIcon = (type: string) => {
      switch (type) {
         case 'word': return <FileText className="h-5 w-5 text-blue-600" />;
         case 'excel': return <FileText className="h-5 w-5 text-green-600" />;
         case 'pdf': return <FileText className="h-5 w-5 text-red-600" />;
         default: return <FileText className="h-5 w-5 text-gray-400" />;
      }
   };

   // --- Upload Modal Handlers ---
   const handleOpenUpload = () => {
      setUploadFormData({
         area: activeTab, // Smart default based on current tab
         planType: planSubTab, // Default to current sub-tab
         month: new Date().getMonth() + 1 > 8 || new Date().getMonth() + 1 < 6 ? (new Date().getMonth() + 1).toString().padStart(2, '0') : '09',
         week: '1',
         name: '',
         note: ''
      });
      setUploadFile(null);
      setIsUploadModalOpen(true);
   };

   const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
         const file = e.dataTransfer.files[0];
         setUploadFile(file);
         if (!uploadFormData.name) {
            setUploadFormData(prev => ({ ...prev, name: file.name.split('.')[0] }));
         }
      }
   };

   const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
         const file = e.target.files[0];
         setUploadFile(file);
         if (!uploadFormData.name) {
            setUploadFormData(prev => ({ ...prev, name: file.name.split('.')[0] }));
         }
      }
   };

   const handleSaveUpload = async () => {
      if (!uploadFile || !uploadFormData.name || !user) return;

      try {
         // 1. Upload to Firebase Storage
         const storageRef = ref(storage, `class-files/${classId}/${Date.now()}_${uploadFile.name}`);
         await uploadBytes(storageRef, uploadFile);
         const downloadUrl = await getDownloadURL(storageRef);

         // 2. Add to Firestore
         const newFile = {
            name: uploadFormData.name,
            type: uploadFile.name.split('.').pop()?.toLowerCase() || 'other',
            url: downloadUrl,
            uploader: user.fullName,
            date: new Date().toISOString(),
            classId: classId,
            month: uploadFormData.month,
            monthName: MONTH_OPTIONS.find(m => m.value === uploadFormData.month)?.label || 'Tháng khác',
            hasNewComments: false,
            commentCount: 0,
            createdAt: serverTimestamp(),
            planType: uploadFormData.planType,
            week: uploadFormData.week,
            category: uploadFormData.area // Save the area as category
         };

         await addDoc(collection(db, 'class_files'), newFile);

         // Trigger the Toast Notification
         addToast("Tải lên thành công!", "Dữ liệu đã được cập nhật vào hệ thống.", "success");

         // Send Notification
         createNotification('upload', user, {
            type: 'class',
            name: uploadFormData.name,
            targetPath: `/class/${classId}`,
            extraInfo: { classId }
         });

         setIsUploadModalOpen(false);
      } catch (error) {
         console.error("Error uploading file:", error);
         addToast("Lỗi khi tải lên", "Vui lòng thử lại sau.", "error");
      }
   };


   // Render file preview using real file URL
   const renderFilePreview = (isFullScreen: boolean = false) => {
      if (!selectedFile) return null;

      // Check if file has URL
      if (selectedFile.url && selectedFile.url !== '#') {
         const previewUrl = getPreviewUrl(selectedFile.url);

         // Special handling for Excel files (cannot be previewed reliably)
         if (previewUrl === 'EXCEL_NO_PREVIEW') {
            return (
               <div className="flex flex-col items-center justify-center h-full text-gray-600 bg-gray-50 rounded-lg p-8">
                  <div className="p-4 bg-green-100 rounded-full mb-4">
                     <FileText className="h-16 w-16 text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">File Excel</h3>
                  <p className="text-sm text-gray-500 mb-6 text-center max-w-md">
                     File Excel không thể xem trước trực tiếp. Vui lòng tải xuống để xem nội dung.
                  </p>
                  <a
                     href={selectedFile.url}
                     download={selectedFile.name}
                     className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-md transition-all font-bold"
                  >
                     <Download className="h-5 w-5" />
                     Tải xuống file
                  </a>
               </div>
            );
         }

         // Normal preview for other file types
         return (
            <div className={`${isFullScreen ? 'w-full h-full' : 'w-full h-full'}`}>
               <iframe
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title="Document Preview"
               />
            </div>
         );
      } else {
         // No file URL available
         return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 bg-gray-50 rounded-lg">
               <FileText className="h-16 w-16 mb-4 text-gray-400" />
               <p className="text-lg font-medium">Không có bản xem trước</p>
               <p className="text-sm">Tài liệu này chưa có file đính kèm hoặc file không hỗ trợ xem trước.</p>
            </div>
         );
      }
   };

   return (
      <div className="min-h-screen bg-amber-50/30 font-sans pb-20">

         {/* --- 1. HEADER KHU VỰC --- */}
         <div className="bg-white border-b border-amber-200 sticky top-0 z-30 shadow-sm">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
               {/* Breadcrumb */}
               <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                  <span className="cursor-pointer hover:text-amber-600" onClick={() => navigate('/')}>Dashboard</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="cursor-pointer hover:text-amber-600">Tổ Chuyên Môn</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="font-semibold text-amber-700">Hồ sơ lớp học</span>
               </div>

               <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div
                     className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity"
                     onClick={() => navigate('/')}
                  >
                     <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center border border-amber-200 shadow-sm">
                        <span className="text-2xl font-bold text-amber-600">{currentClass?.name?.split(' ').pop() || '?'}</span>
                     </div>
                     <div>
                        <h1 className="text-2xl font-bold text-gray-900">{currentClass?.name || 'Lớp học'}</h1>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                           <span className="flex items-center gap-1">
                              <LayoutGrid className="h-4 w-4" /> GVCN:
                           </span>
                           {currentClass?.teachers && currentClass.teachers.length > 1 ? (
                              <div className="flex flex-wrap gap-1.5">
                                 {currentClass.teachers.map((teacher: string, index: number) => (
                                    <span
                                       key={index}
                                       className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md font-semibold text-xs border border-amber-200">
                                       {teacher}
                                    </span>
                                 ))}
                              </div>
                           ) : (
                              <span className="font-semibold text-gray-700">
                                 {currentClass?.teacher || 'Chưa cập nhật'}
                              </span>
                           )}
                        </div>
                     </div>
                  </div>

                  {canUpload && (
                     <button
                        onClick={handleOpenUpload}
                        className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl shadow-md shadow-amber-200 transition-all font-bold transform hover:-translate-y-0.5"
                     >
                        <Upload className="h-5 w-5" />
                        <span>Tải lên hồ sơ lớp</span>
                     </button>
                  )}
               </div>
            </div>

            {/* --- 2. NAVIGATION TABS --- */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
               <div className="flex gap-1 overflow-x-auto no-scrollbar pb-0.5">
                  <button
                     onClick={() => setActiveTab('students')}
                     className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-bold text-sm transition-all relative ${activeTab === 'students'
                        ? 'bg-white text-amber-600 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] border-t border-x border-amber-100 z-10'
                        : 'bg-transparent text-gray-500 hover:bg-amber-50 hover:text-amber-700'
                        }`}
                  >
                     <List className="h-4 w-4" />
                     DANH SÁCH LỚP
                     {activeTab === 'students' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-white"></div>}
                  </button>

                  <button
                     onClick={() => setActiveTab('plan')}
                     className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-bold text-sm transition-all relative ${activeTab === 'plan'
                        ? 'bg-white text-amber-600 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] border-t border-x border-amber-100 z-10'
                        : 'bg-transparent text-gray-500 hover:bg-amber-50 hover:text-amber-700'
                        }`}
                  >
                     <FileText className="h-4 w-4" />
                     KẾ HOẠCH GIÁO DỤC
                     {activeTab === 'plan' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-white"></div>}
                  </button>

                  <button
                     onClick={() => setActiveTab('assessment')}
                     className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-bold text-sm transition-all relative ${activeTab === 'assessment'
                        ? 'bg-white text-amber-600 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] border-t border-x border-amber-100 z-10'
                        : 'bg-transparent text-gray-500 hover:bg-amber-50 hover:text-amber-700'
                        }`}
                  >
                     <Baby className="h-4 w-4" />
                     ĐÁNH GIÁ TRẺ
                     {activeTab === 'assessment' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-white"></div>}
                  </button>

                  <button
                     onClick={() => setActiveTab('steam')}
                     className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-bold text-sm transition-all relative ${activeTab === 'steam'
                        ? 'bg-white text-amber-600 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] border-t border-x border-amber-100 z-10'
                        : 'bg-transparent text-gray-500 hover:bg-amber-50 hover:text-amber-700'
                        }`}
                  >
                     <FlaskConical className="h-4 w-4" />
                     DỰ ÁN STEAM
                     {activeTab === 'steam' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-white"></div>}
                  </button>
               </div>
            </div>
         </div>

         {/* --- 3. CONTENT AREA --- */}
         <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

            {/* Interaction Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
               <div className="flex gap-2">
                  <button
                     onClick={() => setFilter('all')}
                     className={`px-3 py-1.5 text-xs font-bold rounded-full border transition-all ${filter === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-amber-300'}`}
                  >
                     Tất cả
                  </button>
                  <button
                     onClick={() => setFilter('new')}
                     className={`px-3 py-1.5 text-xs font-bold rounded-full border transition-all ${filter === 'new' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-500 border-gray-200 hover:border-amber-300'}`}
                  >
                     Mới nhất
                  </button>
                  <button
                     onClick={() => setFilter('unread')}
                     className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-full border transition-all ${filter === 'unread' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-500 border-gray-200 hover:border-amber-300'}`}
                  >
                     <MessageCircle className="h-3 w-3" /> Có góp ý
                  </button>
               </div>

               <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                     type="text"
                     placeholder="Tìm nhanh kế hoạch..."
                     className="pl-9 pr-4 py-2 w-full sm:w-64 bg-white border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
               </div>
            </div>

            {/* Sub-tabs for Education Plan */}
            {activeTab === 'plan' && (
               <div className="flex items-center gap-2 mb-6 bg-white p-1 rounded-lg border border-amber-100 w-fit">
                  <button
                     onClick={() => setPlanSubTab('year')}
                     className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${planSubTab === 'year' ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-500 hover:bg-amber-50'}`}
                  >
                     Kế hoạch Năm
                  </button>
                  <button
                     onClick={() => setPlanSubTab('month')}
                     className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${planSubTab === 'month' ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-500 hover:bg-amber-50'}`}
                  >
                     Kế hoạch Tháng
                  </button>
                  <button
                     onClick={() => setPlanSubTab('week')}
                     className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${planSubTab === 'week' ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-500 hover:bg-amber-50'}`}
                  >
                     Kế hoạch Tuần
                  </button>
               </div>
            )}

            {/* Content Based on Tab */}
            <div className="space-y-4">
               {activeTab === 'plan' && (
                  <>
                     {/* Year Plan View */}
                     {planSubTab === 'year' && (
                        <div className="bg-white rounded-xl border border-amber-100 p-6">
                           <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                              <Folder className="h-5 w-5 text-amber-500" />
                              Kế hoạch Năm học {getCurrentSchoolYear()} - {getCurrentSchoolYear() + 1}
                           </h3>

                           {/* Filter all files that are planType='year' */}
                           {(() => {
                              // Aggregate all files from all folders that match planType='year'
                              // Note: Our folders structure groups by month, but 'year' plans might technically have a month or not.
                              // If we want to show ALL year plans regardless of month, we should look at the raw files or iterate all folders.
                              // Since 'folders' state contains all files grouped by month, we can iterate.
                              const yearFiles = folders.flatMap(f => f.files).filter(f => f.planType === 'year');

                              if (yearFiles.length === 0) {
                                 return <p className="text-gray-400 italic">Chưa có kế hoạch năm nào được tải lên.</p>;
                              }

                              return (
                                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {yearFiles.map(file => (
                                       <div
                                          key={file.id}
                                          onClick={(e) => handleFileClick(file, e)}
                                          className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-amber-300 hover:shadow-md cursor-pointer transition-all"
                                       >
                                          {getFileIcon(file.type)}
                                          <div className="flex-1 min-w-0">
                                             <h4 className="font-bold text-gray-800 truncate">{file.name}</h4>
                                             <p className="text-xs text-gray-500">{new Date(file.date).toLocaleDateString('vi-VN')}</p>
                                          </div>
                                          <button
                                             onClick={(e) => openDeleteModal(file, 'year', e)}
                                             className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50"
                                          >
                                             <Trash2 className="h-4 w-4" />
                                          </button>
                                       </div>
                                    ))}
                                 </div>
                              );
                           })()}
                        </div>
                     )}

                     {/* Month & Week Plan View (Folder Structure) */}
                     {(planSubTab === 'month' || planSubTab === 'week') && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                           {folders.map((folder) => {
                              // Filter files based on current sub-tab
                              const visibleFiles = folder.files.filter(f => {
                                 if (planSubTab === 'month') return f.planType === 'month';
                                 if (planSubTab === 'week') return f.planType === 'week' || !f.planType; // Backward compatibility
                                 return false;
                              });

                              // Only show count for relevant files
                              const visibleCount = visibleFiles.length;

                              const isExpanded = expandedFolderId === folder.id;
                              return (
                                 <div key={folder.id} className="col-span-1 sm:col-span-2 lg:col-span-3">
                                    {/* Folder Header / Toggle */}
                                    <div
                                       onClick={() => toggleFolder(folder.id)}
                                       className={`
                                          relative flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all border
                                          ${isExpanded ? 'bg-amber-100 border-amber-300 shadow-sm' : 'bg-white border-amber-100 hover:bg-amber-50'}
                                       `}
                                    >
                                       <div className="flex items-center gap-4">
                                          <div className={`p-3 rounded-lg ${isExpanded ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-600'}`}>
                                             <Folder className="h-6 w-6" />
                                          </div>
                                          <div>
                                             <h3 className={`font-bold ${isExpanded ? 'text-amber-900' : 'text-gray-700'}`}>{folder.name}</h3>
                                             <p className="text-xs text-gray-500">
                                                {visibleCount} {planSubTab === 'month' ? 'Kế hoạch tháng' : 'Kế hoạch tuần'}
                                             </p>
                                          </div>
                                       </div>
                                       <div className={`p-1.5 rounded-full transition-transform duration-300 ${isExpanded ? 'rotate-90 bg-amber-200 text-amber-800' : 'text-gray-400'}`}>
                                          <ChevronRight className="h-5 w-5" />
                                       </div>
                                    </div>

                                    {/* Expanded File List */}
                                    {isExpanded && (
                                       <div className="mt-2 ml-4 pl-4 border-l-2 border-amber-200 space-y-2 animate-in slide-in-from-top-2 duration-300">
                                          {visibleFiles.map((file) => (
                                             <div
                                                key={file.id}
                                                onClick={(e) => handleFileClick(file, e)}
                                                className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100 shadow-sm hover:border-amber-300 hover:shadow-md cursor-pointer group transition-all"
                                             >
                                                <div className="flex items-center gap-3">
                                                   {getFileIcon(file.type)}
                                                   <div>
                                                      <h4 className="text-sm font-medium text-gray-800 group-hover:text-amber-700">
                                                         {file.name}
                                                      </h4>
                                                      <div className="flex items-center gap-2 text-xs text-gray-500">
                                                         <Calendar className="h-3 w-3" /> {new Date(file.date).toLocaleDateString('vi-VN')}
                                                         {/* Show Week badge if in Week view */}
                                                         {planSubTab === 'week' && file.week && (
                                                            <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-medium">
                                                               Tuần {file.week}
                                                            </span>
                                                         )}
                                                      </div>
                                                   </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                   {file.hasNewComments && (
                                                      <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-600 text-[10px] font-bold animate-pulse">
                                                         <MessageCircle className="h-3 w-3" />
                                                         Góp ý mới
                                                      </span>
                                                   )}
                                                   <button
                                                      onClick={(e) => openDeleteModal(file, folder.id, e)}
                                                      className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50"
                                                   >
                                                      <Trash2 className="h-4 w-4" />
                                                   </button>
                                                </div>
                                             </div>
                                          ))}
                                          {visibleFiles.length === 0 && (
                                             <p className="text-sm text-gray-400 italic p-2">Chưa có kế hoạch nào được tải lên.</p>
                                          )}
                                       </div>
                                    )}
                                 </div>
                              );
                           })}
                        </div>
                     )}
                  </>
               )}

               {/* Student List Tab */}
               {activeTab === 'students' && (
                  <div className="bg-white rounded-xl border border-amber-100 p-6">
                     <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <List className="h-5 w-5 text-amber-500" />
                        Danh sách Lớp
                     </h3>

                     {(() => {
                        // Filter files with category 'students'
                        const studentFiles = allFiles.filter(f => f.category === 'students');

                        console.log('[Student List Tab] Total files:', allFiles.length, 'Student files:', studentFiles.length);
                        console.log('[Student List Tab] All file categories:', allFiles.map(f => ({ name: f.name, category: f.category })));

                        if (studentFiles.length === 0) {
                           return <p className="text-gray-400 italic">Chưa có danh sách nào được tải lên.</p>;
                        }

                        return (
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {studentFiles.map(file => (
                                 <div
                                    key={file.id}
                                    onClick={(e) => handleFileClick(file, e)}
                                    className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-amber-300 hover:shadow-md cursor-pointer transition-all"
                                 >
                                    {getFileIcon(file.type)}
                                    <div className="flex-1 min-w-0">
                                       <h4 className="font-bold text-gray-800 truncate">{file.name}</h4>
                                       <p className="text-xs text-gray-500">{new Date(file.date).toLocaleDateString('vi-VN')}</p>
                                    </div>
                                    <button
                                       onClick={(e) => openDeleteModal(file, 'students', e)}
                                       className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50"
                                    >
                                       <Trash2 className="h-4 w-4" />
                                    </button>
                                 </div>
                              ))}
                           </div>
                        );
                     })()}
                  </div>
               )}

               {/* Placeholders for other tabs */}
               {activeTab === 'assessment' && (
                  <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                     <Baby className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                     <h3 className="text-gray-500 font-medium">Khu vực Đánh giá trẻ</h3>
                     <p className="text-gray-400 text-sm">Dữ liệu sẽ được cập nhật trong học kỳ tới.</p>
                  </div>
               )}

               {activeTab === 'steam' && (
                  <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                     <FlaskConical className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                     <h3 className="text-gray-500 font-medium">Dự án STEAM</h3>
                     <p className="text-gray-400 text-sm">Các dự án học tập đang được xây dựng.</p>
                  </div>
               )}
            </div>
         </main>

         {/* --- DRAWER (File Details & Preview) --- */}
         {isDrawerOpen && selectedFile && (
            <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
               <div
                  className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
                  onClick={() => setIsDrawerOpen(false)}
               ></div>

               <div className="relative w-full max-w-6xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-amber-50 flex-shrink-0">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg border border-amber-100 shadow-sm">
                           {getFileIcon(selectedFile.type)}
                        </div>
                        <div>
                           <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-0.5 block">
                              Chi tiết hồ sơ
                           </span>
                           <h2 className="text-lg font-bold text-gray-900 leading-tight line-clamp-1">{selectedFile.name}</h2>
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                        <a
                           href={selectedFile.url}
                           target="_blank"
                           rel="noopener noreferrer"
                           download={selectedFile.name}
                           className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                           title="Tải xuống"
                        >
                           <Download className="h-5 w-5" />
                        </a>
                        <button onClick={() => setIsDrawerOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors">
                           <X className="h-6 w-6" />
                        </button>
                     </div>
                  </div>

                  {/* Split View Content */}
                  <div className="flex-1 overflow-hidden flex flex-col md:flex-row">

                     {/* Left: Preview Area (Scrollable) */}
                     <div className="flex-1 overflow-hidden bg-gray-100 border-b md:border-b-0 md:border-r border-gray-200 relative flex flex-col">
                        {/* Floating Action for Preview */}
                        <div className="absolute top-4 right-6 flex gap-2 z-10">
                           <button
                              onClick={() => setIsFullScreenPreviewOpen(true)}
                              className="bg-white/80 backdrop-blur p-1.5 rounded-md shadow-sm text-gray-600 hover:text-amber-600 border border-gray-200 hover:scale-110 transition-all"
                              title="Phóng to toàn màn hình"
                           >
                              <Maximize2 className="h-4 w-4" />
                           </button>
                        </div>

                        {/* Render Dynamic Preview - Full Height */}
                        <div className="flex-1 w-full h-full">
                           {renderFilePreview(false)}
                        </div>
                     </div>

                     {/* Right: Discussion / Meta (Fixed Width) */}
                     <div className="w-full md:w-72 lg:w-80 bg-white flex flex-col h-1/2 md:h-full flex-shrink-0">

                        {/* Meta Info */}
                        <div className="p-4 border-b border-gray-100 bg-white">
                           <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-gray-500">Người đăng</span>
                              <span className="text-xs font-bold text-gray-800">{selectedFile.uploader}</span>
                           </div>
                           <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">Ngày tải lên</span>
                              <span className="text-xs font-bold text-gray-800">{new Date(selectedFile.date).toLocaleDateString('vi-VN')}</span>
                           </div>
                        </div>

                        {/* Comments Area (Scrollable) */}
                        <div className="flex-1 overflow-y-auto p-4 bg-white">
                           <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2 sticky top-0 bg-white pb-2 z-10">
                              <MessageCircle className="h-4 w-4 text-amber-500" />
                              Góp ý chuyên môn
                           </h3>

                           <div className="space-y-4">
                              {selectedFile.hasNewComments ? (
                                 <div className="flex gap-3">
                                    <div className="h-8 w-8 rounded-full bg-red-100 text-red-700 border border-red-200 flex items-center justify-center text-xs font-bold flex-shrink-0">H</div>
                                    <div className="bg-gray-50 rounded-xl rounded-tl-none p-3 flex-1 border border-gray-100">
                                       <div className="flex items-baseline gap-2 mb-1">
                                          <span className="text-xs font-bold text-gray-900">Hiệu Trưởng</span>
                                          <span className="text-[10px] text-gray-500">Ban Giám Hiệu</span>
                                       </div>
                                       <p className="text-sm text-gray-800 leading-relaxed">
                                          Cô Lan lưu ý bổ sung thêm hoạt động ngoài trời cho chủ đề này nhé. Phần mục tiêu cần rõ ràng hơn theo chuẩn độ tuổi.
                                       </p>
                                       <p className="text-[10px] text-gray-400 mt-1">Vừa xong</p>
                                    </div>
                                 </div>
                              ) : (
                                 <div className="text-center py-12 flex flex-col items-center text-gray-300">
                                    <MessageCircle className="h-10 w-10 mb-2 opacity-50" />
                                    <span className="text-xs italic">Chưa có góp ý nào.</span>
                                 </div>
                              )}
                           </div>
                        </div>

                        {/* Footer Input */}
                        <div className="p-4 border-t border-gray-200 bg-gray-50">
                           <div className="relative">
                              <input
                                 type="text"
                                 className="w-full pl-4 pr-12 py-3 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-sm"
                                 placeholder="Nhập ý kiến chỉ đạo..."
                                 value={newComment}
                                 onChange={(e) => setNewComment(e.target.value)}
                              />
                              <button
                                 onClick={() => {
                                    if (!newComment.trim() || !user || !selectedFile) return;
                                    addToast("Đã gửi góp ý", "Nội dung của bạn đã được ghi nhận.", "success");
                                    createNotification('comment', user, {
                                       type: 'class',
                                       name: selectedFile.name,
                                       targetPath: `/class/${classId}`,
                                       extraInfo: { classId }
                                    });
                                    setNewComment('');
                                 }}
                                 className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-all"
                              >
                                 <Send className="h-4 w-4" />
                              </button>
                           </div>
                           <p className="text-[10px] text-gray-400 mt-2 text-center flex items-center justify-center gap-1">
                              <Lock className="h-2.5 w-2.5" /> Chỉ nội bộ BGH và GVCN xem được.
                           </p>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         )}

         {/* --- FULL SCREEN PREVIEW MODAL --- */}
         {isFullScreenPreviewOpen && selectedFile && (
            <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
               {/* Top Bar */}
               <div className="flex items-center justify-between px-6 py-4 bg-black/50 text-white backdrop-blur-md z-10">
                  <div className="flex items-center gap-4">
                     <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                        <FileText className="h-6 w-6 text-white" />
                     </div>
                     <div>
                        <h2 className="text-lg font-bold text-white leading-none">{selectedFile.name}</h2>
                        <p className="text-xs text-white/60 mt-1">Chế độ xem toàn màn hình</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-3">
                     <button className="p-2 hover:bg-white/20 rounded-full transition-colors" title="Thu nhỏ">
                        <ZoomOut className="h-5 w-5" />
                     </button>
                     <button className="p-2 hover:bg-white/20 rounded-full transition-colors" title="Phóng to">
                        <ZoomIn className="h-5 w-5" />
                     </button>
                     <div className="w-px h-6 bg-white/20 mx-1"></div>
                     <button
                        onClick={() => setIsFullScreenPreviewOpen(false)}
                        className="p-2 hover:bg-red-500/80 hover:text-white bg-white/10 rounded-full transition-colors"
                     >
                        <X className="h-6 w-6" />
                     </button>
                  </div>
               </div>

               {/* Content Area */}
               <div className="flex-1 overflow-auto p-8 flex justify-center custom-scrollbar bg-neutral-900/50">
                  {renderFilePreview(true)}
               </div>
            </div>
         )}

         {/* Delete Confirmation Modal */}
         {isDeleteModalOpen && fileToDelete && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
               <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-6 text-center">
                     <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="h-8 w-8 text-red-600" />
                     </div>
                     <h3 className="text-lg font-bold text-gray-900 mb-2">Xác nhận xóa tài liệu?</h3>
                     <p className="text-sm text-gray-500 mb-6">
                        Bạn có chắc chắn muốn xóa file <span className="font-semibold text-gray-800">"{fileToDelete.file.name}"</span> không? Hành động này không thể hoàn tác.
                     </p>
                     <div className="flex gap-3 justify-center">
                        <button
                           onClick={() => setIsDeleteModalOpen(false)}
                           className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                           Hủy bỏ
                        </button>
                        <button
                           onClick={confirmDelete}
                           className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 shadow-md transition-colors"
                        >
                           Xóa vĩnh viễn
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         )}

         {/* --- UPLOAD MODAL (NEW) --- */}
         {isUploadModalOpen && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
               <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

                  {/* Modal Header */}
                  <div className="px-6 py-4 border-b border-amber-100 flex justify-between items-center bg-white">
                     <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Upload className="h-5 w-5 text-amber-600" />
                        Thêm mới Tài liệu Lớp học
                     </h3>
                     <button
                        onClick={() => setIsUploadModalOpen(false)}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                     >
                        <X className="h-6 w-6" />
                     </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 space-y-5">

                     {/* 1. Select Storage Area (Tab) */}
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Khu vực lưu trữ</label>
                        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                           {[
                              { id: 'students', label: 'Danh sách Lớp' },
                              { id: 'plan', label: 'Kế hoạch' },
                              { id: 'assessment', label: 'Đánh giá Trẻ' },
                              { id: 'steam', label: 'Dự án STEAM' }
                           ].map(area => (
                              <button
                                 key={area.id}
                                 onClick={() => setUploadFormData({ ...uploadFormData, area: area.id as any })}
                                 className={`flex-1 py-2 px-2 text-sm font-medium rounded-md transition-all ${uploadFormData.area === area.id
                                    ? 'bg-white text-amber-700 shadow-sm ring-1 ring-gray-200'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                              >
                                 {area.label}
                              </button>
                           ))}
                        </div>
                     </div>

                     {/* 1.5. Plan Type Selection (Only for 'plan' area) */}
                     {uploadFormData.area === 'plan' && (
                        <div>
                           <label className="block text-sm font-medium text-gray-700 mb-2">Loại kế hoạch</label>
                           <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                              {[
                                 { id: 'year', label: 'Kế hoạch Năm' },
                                 { id: 'month', label: 'Kế hoạch Tháng' },
                                 { id: 'week', label: 'Kế hoạch Tuần' }
                              ].map(type => (
                                 <button
                                    key={type.id}
                                    onClick={() => setUploadFormData({ ...uploadFormData, planType: type.id as any })}
                                    className={`flex-1 py-2 px-2 text-sm font-medium rounded-md transition-all ${uploadFormData.planType === type.id
                                       ? 'bg-white text-amber-700 shadow-sm ring-1 ring-gray-200'
                                       : 'text-gray-500 hover:text-gray-700'
                                       }`}
                                 >
                                    {type.label}
                                 </button>
                              ))}
                           </div>
                        </div>
                     )}

                     {/* 2. Time Selection (Month & Week) */}
                     {/* Logic: 
                         - Year Plan: Hide Month & Week
                         - Student List: Hide Month & Week
                         - Month Plan: Show Month, Hide Week
                         - Week Plan: Show Month & Week
                         - Other Areas: Show Month & Week (default)
                     */}
                     {uploadFormData.area !== 'students' && (uploadFormData.area !== 'plan' || uploadFormData.planType !== 'year') && (
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Chọn Tháng</label>
                              <select
                                 className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all bg-white text-sm"
                                 value={uploadFormData.month}
                                 onChange={(e) => setUploadFormData({ ...uploadFormData, month: e.target.value })}
                              >
                                 {MONTH_OPTIONS.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                 ))}
                              </select>
                           </div>

                           {(uploadFormData.area !== 'plan' || uploadFormData.planType === 'week') && (
                              <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-1">Chọn Tuần</label>
                                 <select
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all bg-white text-sm"
                                    value={uploadFormData.week}
                                    onChange={(e) => setUploadFormData({ ...uploadFormData, week: e.target.value })}
                                 >
                                    {WEEK_OPTIONS.map(w => (
                                       <option key={w.value} value={w.value}>{w.label}</option>
                                    ))}
                                 </select>
                              </div>
                           )}
                        </div>
                     )}

                     {/* 3. File Name */}
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                           {uploadFormData.area === 'assessment' ? 'Tên phiếu đánh giá' : 'Tên tài liệu'} <span className="text-red-500">*</span>
                        </label>
                        <input
                           autoFocus
                           type="text"
                           className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                           placeholder="VD: Kế hoạch chủ đề Gia đình..."
                           value={uploadFormData.name}
                           onChange={(e) => setUploadFormData({ ...uploadFormData, name: e.target.value })}
                        />
                     </div>

                     {/* 4. Drag & Drop Zone */}
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tệp đính kèm</label>
                        <div
                           onDrop={handleFileDrop}
                           onDragOver={(e) => e.preventDefault()}
                           className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all group relative ${uploadFile ? 'border-amber-500 bg-amber-50' : 'border-gray-300 hover:bg-gray-50 hover:border-amber-400'}`}
                        >
                           <input
                              type="file"
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              onChange={handleFileInput}
                           />

                           {uploadFile ? (
                              <div className="flex flex-col items-center text-center animate-in zoom-in duration-300">
                                 <CheckCircle className="h-10 w-10 text-amber-600 mb-2" />
                                 <p className="text-sm font-bold text-amber-800 truncate max-w-[250px]">{uploadFile.name}</p>
                                 <p className="text-xs text-amber-600 mt-1">{(uploadFile.size / 1024).toFixed(0)} KB - Đã sẵn sàng</p>
                              </div>
                           ) : (
                              <div className="flex flex-col items-center text-center">
                                 <div className="p-3 rounded-full mb-3 bg-amber-100 text-amber-600 transition-colors">
                                    <CloudUpload className="h-8 w-8" />
                                 </div>
                                 <p className="text-sm font-medium text-gray-700">
                                    Kéo thả file vào đây hoặc <span className="text-amber-600 underline">Bấm để chọn</span>
                                 </p>
                                 <p className="text-xs text-gray-400 mt-1">Hỗ trợ PDF, Excel, Word, Ảnh (Tối đa 10MB)</p>
                              </div>
                           )}
                        </div>
                     </div>

                     {/* 5. Note */}
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú (Tùy chọn)</label>
                        <textarea
                           rows={2}
                           className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all text-sm"
                           placeholder="Ghi chú cho Tổ trưởng/BGH (nếu có)..."
                           value={uploadFormData.note}
                           onChange={(e) => setUploadFormData({ ...uploadFormData, note: e.target.value })}
                        />
                     </div>

                  </div>

                  {/* Footer */}
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                     <button
                        onClick={() => setIsUploadModalOpen(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white hover:shadow-sm rounded-lg border border-transparent hover:border-gray-300 transition-all"
                     >
                        Hủy bỏ
                     </button>
                     <button
                        onClick={handleSaveUpload}
                        disabled={!uploadFile || !uploadFormData.name}
                        className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                        <Upload className="h-4 w-4" /> Lưu hồ sơ
                     </button>
                  </div>

               </div>
            </div>
         )}

      </div>
   );
};

export default ClassRecords;