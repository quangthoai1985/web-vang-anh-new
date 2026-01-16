import React, { useState, useRef, useEffect } from 'react';
import useMobile from '../hooks/useMobile';
import { useNavigate } from 'react-router-dom';
import {
   ChevronRight,
   Utensils,
   ShieldCheck,
   PieChart,
   Upload,
   Search,
   FileText,
   FileSpreadsheet,
   File as FileIcon,
   Calendar,
   MessageCircle,
   MoreHorizontal,
   X,
   Download,
   Trash2,
   Send,
   Lock,
   CloudUpload,
   CheckCircle,
   AlertCircle,
   ZoomIn,
   ZoomOut,
   RotateCcw,
   Maximize2
} from 'lucide-react';
import { OfficeDocument, Comment } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { createNotification } from '../utils/notificationUtils';
import { db, storage } from '../firebase';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, updateDoc, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getPreviewUrl } from '../utils/fileUtils';

// --- Helper Components ---

const FileTypeIcon = ({ type }: { type: string }) => {
   const baseClasses = "h-12 w-12 mb-4 transition-transform group-hover:scale-110 duration-300";
   switch (type) {
      case 'excel':
         return <FileSpreadsheet className={`${baseClasses} text-green-600`} />;
      case 'pdf':
         return <FileIcon className={`${baseClasses} text-red-500`} />;
      case 'word':
         return <FileText className={`${baseClasses} text-blue-600`} />;
      default:
         return <FileText className={`${baseClasses} text-gray-400`} />;
   }
};

const BoardingMenu: React.FC = () => {
   const navigate = useNavigate();
   const { user } = useAuth();
   const { addToast } = useNotification();
   const isMobile = useMobile();

   // State
   const [documents, setDocuments] = useState<OfficeDocument[]>([]);
   const [activeTab, setActiveTab] = useState<'menu' | 'food_safety' | 'nutrition'>('menu');
   const [searchQuery, setSearchQuery] = useState('');

   // Modal & Interaction State
   const [selectedDoc, setSelectedDoc] = useState<OfficeDocument | null>(null);
   const [isModalOpen, setIsModalOpen] = useState(false);
   const [newComment, setNewComment] = useState('');
   const commentsEndRef = useRef<HTMLDivElement>(null);

   // Upload Modal State
   const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
   const [uploadFile, setUploadFile] = useState<File | null>(null);
   const [uploadFormData, setUploadFormData] = useState({
      type: 'menu', // menu | food_safety | nutrition
      startDate: '',
      endDate: '',
      name: ''
   });

   // Delete Modal State
   const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
   const [docToDelete, setDocToDelete] = useState<OfficeDocument | null>(null);

   // Fullscreen Preview State
   const [isFullScreenPreviewOpen, setIsFullScreenPreviewOpen] = useState(false);

   // Current User
   const currentUser = user;

   // Fetch Data
   useEffect(() => {
      const q = query(collection(db, 'boarding_docs'), orderBy('uploadDate', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
         const docs: OfficeDocument[] = [];
         snapshot.forEach((doc) => {
            docs.push({ id: doc.id, ...doc.data() } as OfficeDocument);
         });
         setDocuments(docs);
      });
      return () => unsubscribe();
   }, []);

   // Filtering Logic
   const filteredDocs = documents.filter(doc => {
      const matchesTab = doc.category === activeTab;
      const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
   });

   // Scroll to bottom of chat
   useEffect(() => {
      if (isModalOpen) {
         commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
   }, [selectedDoc?.comments, isModalOpen]);

   // Auto-generate name based on dates
   useEffect(() => {
      if (uploadFormData.type === 'menu' && uploadFormData.startDate && uploadFormData.endDate) {
         const start = new Date(uploadFormData.startDate);
         const end = new Date(uploadFormData.endDate);
         // Calculate week number (simplified)
         const oneJan = new Date(start.getFullYear(), 0, 1);
         const numberOfDays = Math.floor((start.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
         const weekNum = Math.ceil((start.getDay() + 1 + numberOfDays) / 7);

         setUploadFormData(prev => ({
            ...prev,
            name: `Thực đơn Tuần ${weekNum} - Tháng ${start.getMonth() + 1}`
         }));
      }
   }, [uploadFormData.startDate, uploadFormData.endDate, uploadFormData.type]);

   // Handlers
   const handleCardClick = (doc: OfficeDocument) => {
      setSelectedDoc(doc);
      setIsModalOpen(true);
   };

   const openDeleteModal = (doc: OfficeDocument, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      setDocToDelete(doc);
      setIsDeleteModalOpen(true);
   };

   const confirmDelete = async () => {
      if (docToDelete) {
         try {
            await deleteDoc(doc(db, 'boarding_docs', docToDelete.id));
            addToast("Đã xóa tài liệu thành công", "Hồ sơ đã được xóa khỏi hệ thống.", "success");
            setIsDeleteModalOpen(false);
            setDocToDelete(null);
            // Close detail modal if the deleted doc was open
            if (selectedDoc?.id === docToDelete.id) {
               setIsModalOpen(false);
               setSelectedDoc(null);
            }
         } catch (error) {
            console.error("Error deleting document: ", error);
            addToast("Lỗi", "Không thể xóa hồ sơ.", "error");
         }
      }
   };

   const handlePostComment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newComment.trim() || !selectedDoc || !currentUser) return;

      const comment: Comment = {
         id: Date.now().toString(),
         userId: currentUser.id,
         userName: currentUser.fullName,
         userRole: currentUser.role,
         content: newComment,
         timestamp: new Date().toISOString()
      };

      try {
         const docRef = doc(db, 'boarding_docs', selectedDoc.id);
         await updateDoc(docRef, {
            comments: arrayUnion(comment)
         });

         // Optimistic update for UI responsiveness (optional since onSnapshot will catch it)
         // But keeping it simple and letting onSnapshot handle it is safer.
         // However, we need to update selectedDoc to show the new comment immediately in the modal
         // if we want instant feedback before the snapshot triggers (though snapshot is fast).
         // Let's rely on snapshot but we might need to update selectedDoc if it doesn't auto-update from documents list change.
         // Actually, selectedDoc is a separate state. We should sync it.

         const updatedDoc = {
            ...selectedDoc,
            comments: [...selectedDoc.comments, comment]
         };
         setSelectedDoc(updatedDoc);
         setNewComment('');
         addToast("Đã gửi bình luận", "Ý kiến của bạn đã được ghi nhận.", "success");

         // Send Notification
         await createNotification('comment', currentUser, {
            type: 'boarding',
            name: selectedDoc.name,
            targetPath: '/boarding-menu'
         });

      } catch (error) {
         console.error("Error adding comment: ", error);
         addToast("Lỗi", "Không thể gửi bình luận.", "error");
      }
   };

   const getTabLabel = (tab: string) => {
      switch (tab) {
         case 'menu': return 'Thực đơn Tuần';
         case 'food_safety': return 'Hồ sơ Vệ sinh ATTP';
         case 'nutrition': return 'Báo cáo Dinh dưỡng';
         default: return '';
      }
   };

   // --- Upload Handlers ---
   const handleOpenUpload = () => {
      setUploadFormData({
         type: activeTab === 'menu' ? 'menu' : activeTab === 'food_safety' ? 'food_safety' : 'nutrition',
         startDate: '',
         endDate: '',
         name: ''
      });
      setUploadFile(null);
      setIsUploadModalOpen(true);
   };

   const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
         const file = e.dataTransfer.files[0];
         setUploadFile(file);
         if (!uploadFormData.name && uploadFormData.type !== 'menu') {
            setUploadFormData(prev => ({ ...prev, name: file.name.split('.')[0] }));
         }
      }
   };

   const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
         const file = e.target.files[0];
         setUploadFile(file);
         if (!uploadFormData.name && uploadFormData.type !== 'menu') {
            setUploadFormData(prev => ({ ...prev, name: file.name.split('.')[0] }));
         }
      }
   };

   const handleUploadSave = async () => {
      if (!uploadFile) return;

      try {
         // Upload file to Firebase Storage
         const storageRef = ref(storage, `boarding_docs/${Date.now()}_${uploadFile.name}`);
         const snapshot = await uploadBytes(storageRef, uploadFile);
         const fileUrl = await getDownloadURL(snapshot.ref);

         const newItem = {
            ...uploadFormData,
            uploader: {
               id: currentUser?.id || 'unknown',
               name: currentUser?.fullName || 'Ẩn danh',
               avatar: currentUser?.avatar || ''
            },
            uploadDate: new Date().toISOString(),
            comments: [],
            fileType: uploadFile.name.split('.').pop() || 'file', // Simple extension extraction
            category: activeTab, // Ensure category matches tab
            fileUrl: fileUrl // Add the actual file URL
         };

         await addDoc(collection(db, 'boarding_docs'), newItem);

         addToast("Tải lên thành công!", `Đã lưu hồ sơ: ${uploadFormData.name}`, "success");
         setIsUploadModalOpen(false);

         // Send Notification
         if (currentUser) {
            await createNotification('upload', currentUser, {
               type: 'boarding',
               name: uploadFormData.name,
               targetPath: '/boarding-menu'
            });
         }
      } catch (error) {
         console.error("Error adding document: ", error);
         addToast("Lỗi", "Không thể tải lên hồ sơ.", "error");
      }
   };

   // Render file preview using real file URL
   const renderFilePreview = (isFullScreen: boolean = false) => {
      if (!selectedDoc) return null;

      // Check if file has URL
      if (selectedDoc.fileUrl && selectedDoc.fileUrl !== '#') {
         const previewUrl = getPreviewUrl(selectedDoc.fileUrl);

         // Special handling for Excel files
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
                     href={selectedDoc.fileUrl}
                     download
                     className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-md transition-all font-bold"
                  >
                     <Download className="h-5 w-5" />
                     Tải xuống file
                  </a>
               </div>
            );
         }

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
      <div className="flex flex-col h-screen bg-gray-50 overflow-hidden font-sans">

         {/* --- Header --- */}
         <div className={`bg-white border-b border-emerald-100 ${isMobile ? 'px-4 py-3' : 'px-6 py-4'} flex-shrink-0 z-20 shadow-sm`}>
            <div className="max-w-7xl mx-auto w-full">
               {/* Breadcrumb - hide on mobile */}
               {!isMobile && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                     <span className="cursor-pointer hover:text-emerald-600" onClick={() => navigate('/')}>Dashboard</span>
                     <ChevronRight className="h-3 w-3" />
                     <span>Tổ Văn phòng</span>
                     <ChevronRight className="h-3 w-3" />
                     <span className="font-semibold text-emerald-700">Bán trú</span>
                  </div>
               )}

               {/* Main Header Content */}
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                     <h1
                        className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-gray-900 flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity`}
                        onClick={() => navigate('/')}
                     >
                        <span className={`${isMobile ? 'p-1.5' : 'p-2'} bg-emerald-100 rounded-lg text-emerald-700`}>
                           <Utensils className={`${isMobile ? 'h-5 w-5' : 'h-6 w-6'}`} />
                        </span>
                        Quản lý Bán trú & Dinh dưỡng
                     </h1>
                     {!isMobile && (
                        <p className="text-xs text-gray-500 mt-1 ml-12 flex items-center gap-1">
                           <Lock className="h-3 w-3" /> Chỉ dành cho BGH, Y tế & Kế toán
                        </p>
                     )}
                  </div>

                  <button
                     onClick={handleOpenUpload}
                     className={`flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white ${isMobile ? 'px-3 py-2 text-sm' : 'px-5 py-2.5'} rounded-lg shadow-md hover:shadow-lg transition-all font-medium transform hover:-translate-y-0.5`}
                  >
                     <Upload className="h-4 w-4" />
                     <span>{isMobile ? 'Tải lên hồ sơ mới' : 'Tải lên hồ sơ mới'}</span>
                  </button>
               </div>
            </div>
         </div>

         {/* --- Main Layout --- */}
         <div className="flex flex-1 overflow-hidden max-w-7xl mx-auto w-full">

            {/* Sidebar (Filters) - Desktop only */}
            <div className="w-64 bg-white border-r border-gray-200 flex-shrink-0 overflow-y-auto hidden md:block">
               <div className="p-6">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Nghiệp vụ Bán trú</h3>
                  <nav className="space-y-2">
                     <button
                        onClick={() => setActiveTab('menu')}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${activeTab === 'menu' ? 'bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-emerald-100' : 'text-gray-600 hover:bg-gray-50'}`}
                     >
                        <Utensils className="h-4 w-4" />
                        Thực đơn Tuần
                     </button>

                     <button
                        onClick={() => setActiveTab('food_safety')}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${activeTab === 'food_safety' ? 'bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-emerald-100' : 'text-gray-600 hover:bg-gray-50'}`}
                     >
                        <ShieldCheck className="h-4 w-4" />
                        Hồ sơ Vệ sinh ATTP
                     </button>

                     <button
                        onClick={() => setActiveTab('nutrition')}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${activeTab === 'nutrition' ? 'bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-emerald-100' : 'text-gray-600 hover:bg-gray-50'}`}
                     >
                        <PieChart className="h-4 w-4" />
                        Báo cáo Dinh dưỡng
                     </button>
                  </nav>
               </div>
            </div>

            {/* Main Content */}
            <div className={`flex-1 bg-gray-50 overflow-y-auto ${isMobile ? 'p-4' : 'p-6'}`}>

               {/* Mobile Tabs */}
               {isMobile && (
                  <div className="flex gap-2 overflow-x-auto pb-3 mb-4 no-scrollbar">
                     {[
                        { id: 'menu', label: 'Thực đơn Tuần' },
                        { id: 'food_safety', label: 'Vệ sinh ATTP' },
                        { id: 'nutrition', label: 'Dinh dưỡng' }
                     ].map(tab => (
                        <button
                           key={tab.id}
                           onClick={() => setActiveTab(tab.id as any)}
                           className={`flex-shrink-0 px-3 py-1.5 text-xs font-bold rounded-full transition-all ${activeTab === tab.id
                              ? 'bg-emerald-600 text-white shadow-md'
                              : 'bg-white text-gray-600 border border-gray-200'
                              }`}
                        >
                           {tab.label}
                        </button>
                     ))}
                  </div>
               )}

               {/* Toolbar */}
               <div className={`flex items-center justify-between ${isMobile ? 'mb-4' : 'mb-8'}`}>
                  <h2 className={`${isMobile ? 'text-base' : 'text-lg'} font-bold text-gray-800`}>{getTabLabel(activeTab)}</h2>
                  <div className="relative">
                     <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                     <input
                        type="text"
                        placeholder="Tìm kiếm hồ sơ..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`pl-9 pr-4 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isMobile ? 'w-40' : 'w-64'} bg-white shadow-sm`}
                     />
                  </div>
               </div>

               {/* Grid Cards */}
               <div className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'}`}>
                  {filteredDocs.map((docItem) => (
                     <div
                        key={docItem.id}
                        onClick={() => handleCardClick(docItem)}
                        className={`group bg-white rounded-2xl border border-gray-100 ${isMobile ? 'p-4' : 'p-6'} shadow-sm hover:shadow-lg hover:border-emerald-200 cursor-pointer transition-all duration-300 flex flex-col items-center text-center relative overflow-hidden`}
                     >
                        {/* Selection Overlay Effect */}
                        <div className="absolute inset-0 bg-emerald-50 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>

                        {/* File Icon - smaller on mobile */}
                        <div className={`${isMobile ? 'mb-2' : 'mb-4'}`}>
                           {isMobile ? (
                              <div className="h-10 w-10 flex items-center justify-center bg-gray-100 rounded-lg">
                                 {docItem.type === 'excel' && <FileSpreadsheet className="h-5 w-5 text-green-600" />}
                                 {docItem.type === 'pdf' && <FileIcon className="h-5 w-5 text-red-500" />}
                                 {docItem.type === 'word' && <FileText className="h-5 w-5 text-blue-600" />}
                                 {!['excel', 'pdf', 'word'].includes(docItem.type) && <FileText className="h-5 w-5 text-gray-400" />}
                              </div>
                           ) : (
                              <FileTypeIcon type={docItem.type} />
                           )}
                        </div>

                        <h3 className={`${isMobile ? 'text-xs' : 'text-sm'} font-bold text-gray-800 mb-1 line-clamp-2 group-hover:text-emerald-700 transition-colors`}>
                           {docItem.name}
                        </h3>

                        <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-gray-500 ${isMobile ? 'mb-2' : 'mb-4'}`}>
                           Đăng bởi <span className="font-medium text-gray-700">{docItem.uploader.name}</span>
                        </p>

                        {/* Card Footer */}
                        <div className={`w-full ${isMobile ? 'pt-2' : 'pt-4'} border-t border-gray-50 flex items-center justify-between mt-auto relative z-10`}>
                           <span className="text-[10px] text-gray-400 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(docItem.uploadDate).toLocaleDateString('vi-VN')}
                           </span>

                           <div className="flex items-center gap-1">
                              {docItem.comments.length > 0 && (
                                 <div className="flex items-center gap-0.5 text-[10px] font-bold text-red-500 bg-red-50 px-1 py-0.5 rounded-full">
                                    <MessageCircle className="h-2.5 w-2.5" />
                                    {docItem.comments.length}
                                 </div>
                              )}

                              {!isMobile && (
                                 <button
                                    onClick={(e) => openDeleteModal(docItem, e)}
                                    className="text-gray-400 hover:text-red-600 p-1.5 rounded-full hover:bg-red-50 transition-colors"
                                    title="Xóa tài liệu"
                                 >
                                    <Trash2 className="h-4 w-4" />
                                 </button>
                              )}
                           </div>
                        </div>
                     </div>
                  ))}

                  {/* Empty State if no docs */}
                  {filteredDocs.length === 0 && (
                     <div className="col-span-full py-12 flex flex-col items-center text-gray-400">
                        <div className="bg-gray-100 p-4 rounded-full mb-3">
                           <FileText className="h-8 w-8 text-gray-300" />
                        </div>
                        <p>Không tìm thấy hồ sơ nào.</p>
                     </div>
                  )}
               </div>
            </div>
         </div>

         {/* Delete Confirmation Modal */}
         {isDeleteModalOpen && docToDelete && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
               <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-6 text-center">
                     <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="h-8 w-8 text-red-600" />
                     </div>
                     <h3 className="text-lg font-bold text-gray-900 mb-2">Xác nhận xóa tài liệu?</h3>
                     <p className="text-sm text-gray-500 mb-6">
                        Bạn có chắc chắn muốn xóa hồ sơ <span className="font-semibold text-gray-800">"{docToDelete.name}"</span> không? Hành động này không thể hoàn tác.
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

         {/* --- DRAWER (File Details & Preview) --- */}
         {isModalOpen && selectedDoc && (
            isMobile ? (
               /* Mobile: Full Screen Modal */
               <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in fade-in duration-200">
                  {/* Mobile Header */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0 safe-area-inset-top">
                     <button
                        onClick={() => setIsModalOpen(false)}
                        className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full"
                     >
                        <ChevronRight className="h-5 w-5 rotate-180" />
                     </button>
                     <div className="flex-1 min-w-0">
                        <h2 className="text-sm font-bold text-gray-900 truncate">{selectedDoc.name}</h2>
                        <p className="text-[10px] text-gray-500">{getTabLabel(activeTab)} • {new Date(selectedDoc.uploadDate).toLocaleDateString('vi-VN')}</p>
                     </div>
                  </div>

                  {/* Mobile Document Preview - Full height */}
                  <div className="flex-1 bg-gray-100 overflow-hidden">
                     {renderFilePreview(false)}
                  </div>

                  {/* Mobile Bottom Action Bar */}
                  <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-3 safe-area-inset-bottom">
                     <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                           <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-[10px] flex-shrink-0">
                              {selectedDoc.uploader.name.charAt(0)}
                           </div>
                           <span className="text-xs text-gray-600 truncate">{selectedDoc.uploader.name}</span>
                           {selectedDoc.comments.length > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
                                 <MessageCircle className="w-2.5 h-2.5 mr-0.5" />
                                 {selectedDoc.comments.length}
                              </span>
                           )}
                        </div>
                        <button
                           onClick={(e) => openDeleteModal(selectedDoc, e)}
                           className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        >
                           <Trash2 className="h-4 w-4" />
                        </button>
                        <a
                           href={selectedDoc.fileUrl}
                           download
                           className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium shadow-md"
                           onClick={(e) => e.stopPropagation()}
                        >
                           <Download className="h-4 w-4" />
                           Tải về
                        </a>
                     </div>
                  </div>
               </div>
            ) : (
               /* Desktop: Slide-in Panel */
               <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
                  <div
                     className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
                     onClick={() => setIsModalOpen(false)}
                  ></div>

                  <div className="relative w-full max-w-6xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                     {/* Header */}
                     <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-emerald-50 flex-shrink-0">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-white rounded-lg border border-emerald-100 shadow-sm">
                              <FileText className="h-5 w-5 text-emerald-600" />
                           </div>
                           <div>
                              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5 block">
                                 Chi tiết hồ sơ
                              </span>
                              <h2 className="text-lg font-bold text-gray-900 leading-tight line-clamp-1">{selectedDoc.name}</h2>
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <button
                              onClick={() => {
                                 if (selectedDoc.fileUrl && selectedDoc.fileUrl !== '#') {
                                    window.open(selectedDoc.fileUrl, '_blank');
                                 } else {
                                    addToast("Không có file", "Tài liệu này không có file đính kèm.", "error");
                                 }
                              }}
                              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Tải xuống"
                           >
                              <Download className="h-5 w-5" />
                           </button>
                           <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors">
                              <X className="h-6 w-6" />
                           </button>
                        </div>
                     </div>

                     {/* Split View Content */}
                     <div className="flex-1 overflow-hidden flex flex-row">

                        {/* Left: Preview Area (Scrollable) */}
                        <div className="flex-1 overflow-hidden bg-gray-100 border-r border-gray-200 relative flex flex-col">
                           {/* Floating Action for Preview */}
                           <div className="absolute top-4 right-6 flex gap-2 z-10">
                              <button
                                 onClick={() => setIsFullScreenPreviewOpen(true)}
                                 className="bg-white/80 backdrop-blur p-1.5 rounded-md shadow-sm text-gray-600 hover:text-emerald-600 border border-gray-200 hover:scale-110 transition-all"
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
                        <div className="w-72 lg:w-80 bg-white flex flex-col h-full flex-shrink-0">

                           {/* Meta Info */}
                           <div className="p-4 border-b border-gray-100 bg-white">
                              <div className="flex items-center justify-between mb-2">
                                 <span className="text-xs text-gray-500">Người đăng</span>
                                 <span className="text-xs font-bold text-gray-800">{selectedDoc.uploader.name}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                 <span className="text-xs text-gray-500">Ngày tải lên</span>
                                 <span className="text-xs font-bold text-gray-800">{new Date(selectedDoc.uploadDate).toLocaleDateString('vi-VN')}</span>
                              </div>
                              {selectedDoc.category === 'menu' && (selectedDoc as any).startDate && (selectedDoc as any).endDate && (
                                 <div className="mt-2 pt-2 border-t border-gray-100">
                                    <span className="text-xs text-gray-500 block mb-1">Thời gian áp dụng</span>
                                    <div className="flex items-center gap-1 text-xs text-gray-700">
                                       <Calendar className="h-3 w-3" />
                                       <span>{new Date((selectedDoc as any).startDate).toLocaleDateString('vi-VN')}</span>
                                       <span>→</span>
                                       <span>{new Date((selectedDoc as any).endDate).toLocaleDateString('vi-VN')}</span>
                                    </div>
                                 </div>
                              )}
                           </div>

                           {/* Comments Area (Scrollable) */}
                           <div className="flex-1 overflow-y-auto p-4 bg-white">
                              <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2 sticky top-0 bg-white pb-2 z-10">
                                 <MessageCircle className="h-4 w-4 text-emerald-500" />
                                 Góp ý chuyên môn
                              </h3>

                              <div className="space-y-4">
                                 {selectedDoc.comments && selectedDoc.comments.length > 0 ? (
                                    selectedDoc.comments.map((comment) => (
                                       <div key={comment.id} className="flex gap-3">
                                          <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                             {comment.userName.charAt(0)}
                                          </div>
                                          <div className="bg-gray-50 rounded-xl rounded-tl-none p-3 flex-1 border border-gray-100">
                                             <div className="flex items-baseline gap-2 mb-1">
                                                <span className="text-xs font-bold text-gray-900">{comment.userName}</span>
                                                <span className="text-[10px] text-gray-500">{comment.userRole}</span>
                                             </div>
                                             <p className="text-sm text-gray-800 leading-relaxed">{comment.content}</p>
                                             <p className="text-[10px] text-gray-400 mt-1">
                                                {new Date(comment.timestamp).toLocaleString('vi-VN')}
                                             </p>
                                          </div>
                                       </div>
                                    ))
                                 ) : (
                                    <div className="text-center py-12 flex flex-col items-center text-gray-300">
                                       <MessageCircle className="h-10 w-10 mb-2 opacity-50" />
                                       <span className="text-xs italic">Chưa có góp ý nào.</span>
                                    </div>
                                 )}
                                 <div ref={commentsEndRef} />
                              </div>
                           </div>

                           {/* Footer Input */}
                           <div className="p-4 border-t border-gray-200 bg-gray-50">
                              <form onSubmit={handlePostComment} className="relative">
                                 <input
                                    type="text"
                                    className="w-full pl-4 pr-12 py-3 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                                    placeholder="Nhập ý kiến chỉ đạo..."
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                 />
                                 <button
                                    type="submit"
                                    disabled={!newComment.trim()}
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all"
                                 >
                                    <Send className="h-4 w-4" />
                                 </button>
                              </form>
                              <p className="text-[10px] text-gray-400 mt-2 text-center flex items-center justify-center gap-1">
                                 <Lock className="h-2.5 w-2.5" /> Chỉ nội bộ BGH xem được.
                              </p>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            )
         )}

         {/* --- FULL SCREEN PREVIEW MODAL --- */}
         {isFullScreenPreviewOpen && selectedDoc && (
            <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
               {/* Top Bar */}
               <div className="flex items-center justify-between px-6 py-4 bg-black/50 text-white backdrop-blur-md z-10">
                  <div className="flex items-center gap-4">
                     <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                        <FileText className="h-6 w-6 text-white" />
                     </div>
                     <div>
                        <h2 className="text-lg font-bold text-white leading-none">{selectedDoc.name}</h2>
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

         {/* --- Upload Modal (Green Variant) --- */}
         {isUploadModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
               <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

                  {/* Modal Header */}
                  <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white">
                     <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Upload className="h-5 w-5 text-emerald-600" />
                        Tải lên Bán trú
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

                     {/* Data Type Selection */}
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Loại dữ liệu</label>
                        <div className="flex flex-wrap gap-2">
                           {[
                              { id: 'menu', label: 'Thực đơn Tuần' },
                              { id: 'food_safety', label: 'Hồ sơ Vệ sinh ATTP' },
                              { id: 'nutrition', label: 'Báo cáo Dinh dưỡng' }
                           ].map(type => (
                              <button
                                 key={type.id}
                                 onClick={() => setUploadFormData(prev => ({ ...prev, type: type.id }))}
                                 className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-all ${uploadFormData.type === type.id
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-100'
                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                    }`}
                              >
                                 {type.label}
                              </button>
                           ))}
                        </div>
                     </div>

                     {/* Date Range (Conditional) */}
                     {uploadFormData.type === 'menu' && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                           <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Từ ngày</label>
                              <input
                                 type="date"
                                 className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm"
                                 value={uploadFormData.startDate}
                                 onChange={(e) => setUploadFormData({ ...uploadFormData, startDate: e.target.value })}
                              />
                           </div>
                           <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Đến ngày</label>
                              <input
                                 type="date"
                                 className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm"
                                 value={uploadFormData.endDate}
                                 onChange={(e) => setUploadFormData({ ...uploadFormData, endDate: e.target.value })}
                              />
                           </div>
                        </div>
                     )}

                     {/* File Name */}
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tên hiển thị <span className="text-red-500">*</span></label>
                        <input
                           type="text"
                           className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                           placeholder={uploadFormData.type === 'menu' ? "Tự động điền khi chọn ngày..." : "Nhập tên hồ sơ..."}
                           value={uploadFormData.name}
                           onChange={(e) => setUploadFormData({ ...uploadFormData, name: e.target.value })}
                        />
                     </div>

                     {/* Drag & Drop Zone */}
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tệp đính kèm</label>
                        <div
                           onDrop={handleFileDrop}
                           onDragOver={(e) => e.preventDefault()}
                           className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all group relative ${uploadFile ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 hover:bg-gray-50 hover:border-emerald-400'}`}
                        >
                           <input
                              type="file"
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              onChange={handleFileInput}
                           />

                           {uploadFile ? (
                              <div className="flex flex-col items-center text-center animate-in zoom-in duration-300">
                                 <CheckCircle className="h-10 w-10 text-emerald-600 mb-2" />
                                 <p className="text-sm font-bold text-emerald-800 truncate max-w-[250px]">{uploadFile.name}</p>
                                 <p className="text-xs text-emerald-600 mt-1">{(uploadFile.size / 1024).toFixed(0)} KB - Đã sẵn sàng</p>
                              </div>
                           ) : (
                              <div className="flex flex-col items-center text-center">
                                 <div className="p-3 rounded-full mb-3 bg-emerald-100 text-emerald-600 transition-colors">
                                    <CloudUpload className="h-8 w-8" />
                                 </div>
                                 <p className="text-sm font-medium text-gray-700">
                                    Kéo thả file vào đây hoặc <span className="text-emerald-600 underline">Bấm để chọn</span>
                                 </p>
                                 <p className="text-xs text-gray-400 mt-1">Hỗ trợ PDF, Excel, Word (Tối đa 10MB)</p>
                              </div>
                           )}
                        </div>
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
                        onClick={handleUploadSave}
                        disabled={!uploadFile}
                        className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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

export default BoardingMenu;