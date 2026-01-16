import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
   ArrowLeft,
   Search,
   Upload,
   Banknote,
   Stethoscope,
   FileText,
   MoreVertical,
   Download,
   Trash2,
   MessageSquare,
   X,
   Send,
   FileSpreadsheet,
   File as FileIcon,
   ChevronRight,
   CloudUpload,
   CheckCircle,
   AlertCircle,
   Maximize2
} from 'lucide-react';
import { OfficeDocument, Comment } from '../types';
import { useSchoolYear } from '../context/SchoolYearContext';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { createNotification } from '../utils/notificationUtils';
import { db, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, updateDoc, arrayUnion } from 'firebase/firestore';
import { getPreviewUrl } from '../utils/fileUtils';

// --- Icons Mapping ---
const getFileIcon = (type: string) => {
   switch (type) {
      case 'excel': return <FileSpreadsheet className="h-6 w-6 text-green-600" />;
      case 'word': return <FileText className="h-6 w-6 text-blue-600" />;
      case 'pdf': return <FileIcon className="h-6 w-6 text-red-600" />;
      default: return <FileText className="h-6 w-6 text-gray-500" />;
   }
};

const OfficeDocuments: React.FC = () => {
   const navigate = useNavigate();
   const { user } = useAuth();
   const { currentSchoolYear } = useSchoolYear();
   const { addToast } = useNotification();
   const [documents, setDocuments] = useState<OfficeDocument[]>([]);
   const [activeCategory, setActiveCategory] = useState<'all' | 'finance' | 'medical' | 'general'>('all');
   const [searchQuery, setSearchQuery] = useState('');

   // Panel & Comment State
   const [selectedDoc, setSelectedDoc] = useState<OfficeDocument | null>(null);
   const [isPanelOpen, setIsPanelOpen] = useState(false);
   const [newComment, setNewComment] = useState('');
   const [isFullScreenPreviewOpen, setIsFullScreenPreviewOpen] = useState(false);
   const commentsEndRef = useRef<HTMLDivElement>(null);

   // Upload Modal State
   const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
   const [uploadFile, setUploadFile] = useState<File | null>(null);
   const [uploadFormData, setUploadFormData] = useState({
      name: '',
      category: 'general',
      note: ''
   });

   // Delete Modal State
   const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
   const [docToDelete, setDocToDelete] = useState<OfficeDocument | null>(null);

   const currentUser = user;

   // Derived state to ensure we always have the latest version of the document
   const currentDoc = useMemo(() => {
      if (!selectedDoc) return null;
      return documents.find(d => d.id === selectedDoc.id) || selectedDoc;
   }, [documents, selectedDoc]);

   // Fetch Data
   useEffect(() => {
      const q = query(collection(db, 'office_docs'), orderBy('uploadDate', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
         const docs: OfficeDocument[] = [];
         snapshot.forEach((doc) => {
            const data = doc.data();
            // School Year Check
            const itemYear = data.schoolYear || '2025-2026';
            if (itemYear !== currentSchoolYear) return;

            docs.push({
               id: doc.id,
               ...data,
               comments: data.comments || [] // Ensure comments is always an array
            } as OfficeDocument);
         });
         setDocuments(docs);
      });
      return () => unsubscribe();
   }, [currentSchoolYear]);

   // Filter Logic
   const filteredDocs = documents.filter(doc => {
      const matchesCategory = activeCategory === 'all' || doc.category === activeCategory;
      const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
         doc.uploader.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
   });

   // Scroll to bottom of chat when comments change
   useEffect(() => {
      if (isPanelOpen) {
         commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
   }, [currentDoc?.comments, isPanelOpen]);

   const handleRowClick = (doc: OfficeDocument) => {
      setSelectedDoc(doc);
      setIsPanelOpen(true);
   };

   const openDeleteModal = (doc: OfficeDocument, e: React.MouseEvent) => {
      e.stopPropagation();
      setDocToDelete(doc);
      setIsDeleteModalOpen(true);
   };

   const confirmDelete = async () => {
      if (docToDelete) {
         try {
            await deleteDoc(doc(db, 'office_docs', docToDelete.id));
            addToast("Đã xóa tài liệu thành công", "Hồ sơ đã được loại bỏ khỏi danh sách.", "success");
            setIsDeleteModalOpen(false);
            setDocToDelete(null);
            // Close panel if deleted doc was selected
            if (selectedDoc?.id === docToDelete.id) {
               setIsPanelOpen(false);
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
      if (!newComment.trim() || !currentDoc || !currentUser) return;

      const comment: Comment = {
         id: Date.now().toString(),
         userId: currentUser.id,
         userName: currentUser.fullName,
         userRole: currentUser.role,
         content: newComment,
         timestamp: new Date().toISOString()
      };

      try {
         const docRef = doc(db, 'office_docs', currentDoc.id);
         await updateDoc(docRef, {
            comments: arrayUnion(comment)
         });

         // Removed manual state updates to rely on onSnapshot
         setNewComment('');
         addToast("Đã gửi góp ý", "Nội dung của bạn đã được ghi nhận.", "success");

         // Send Notification
         if (currentUser) {
            await createNotification('comment', currentUser, {
               type: 'office',
               name: currentDoc.name,
               targetPath: '/office-documents',
               extraInfo: { uploaderId: currentDoc.uploader.id }
            });
         }
      } catch (error) {
         console.error("Error adding comment: ", error);
         addToast("Lỗi", "Không thể gửi bình luận.", "error");
      }
   };

   const getCategoryLabel = (cat: string) => {
      switch (cat) {
         case 'finance': return 'Tài chính & Kế toán';
         case 'medical': return 'Y tế & Bán trú';
         case 'general': return 'Hành chính chung';
         default: return 'Tất cả hồ sơ';
      }
   };

   // --- Upload Handlers ---
   const handleOpenUpload = () => {
      setUploadFormData({ name: '', category: activeCategory === 'all' ? 'general' : activeCategory, note: '' });
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

   const handleUploadSave = async () => {
      if (!uploadFile) return;

      try {
         let downloadUrl = '#';

         // Upload to Firebase Storage
         const storageRef = ref(storage, `office_docs/${Date.now()}_${uploadFile.name}`);
         await uploadBytes(storageRef, uploadFile);
         downloadUrl = await getDownloadURL(storageRef);

         const newItem = {
            ...uploadFormData,
            uploader: {
               id: currentUser?.id || 'unknown',
               name: currentUser?.fullName || 'Ẩn danh',
               avatar: currentUser?.avatar || '',
               role: currentUser?.roleLabel || 'Nhân viên'
            },
            uploadDate: new Date().toISOString(),
            schoolYear: currentSchoolYear,
            comments: [],
            type: uploadFile.name.split('.').pop() || 'file',
            fileType: uploadFile.name.split('.').pop() || 'file',
            fileUrl: downloadUrl
         };

         await addDoc(collection(db, 'office_docs'), newItem);

         addToast("Tải lên thành công!", `Đã lưu hồ sơ: ${uploadFormData.name}`, "success");
         setIsUploadModalOpen(false);
      } catch (error) {
         console.error("Error adding document: ", error);
         addToast("Lỗi", "Không thể tải lên hồ sơ.", "error");
      }
   };

   // Render file preview using real file URL
   const renderFilePreview = (isFullScreen: boolean = false) => {
      if (!currentDoc) return null;
      // Use fileUrl from the document
      const itemUrl = currentDoc.fileUrl;

      // Check if file has URL
      if (itemUrl && itemUrl !== '#') {
         const previewUrl = getPreviewUrl(itemUrl);

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
                     href={itemUrl}
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
            <div className="flex flex-col items-center justify-center h-full text-gray-500 bg-gray-50">
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
         <div className="bg-white border-b border-teal-100 px-6 py-4 flex-shrink-0 z-20 shadow-sm">
            <div className="max-w-7xl mx-auto w-full">
               <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                  <span className="cursor-pointer hover:text-teal-600" onClick={() => navigate('/')}>Dashboard</span>
                  <ChevronRight className="h-3 w-3" />
                  <span>Tổ Văn phòng</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="font-semibold text-teal-700">Kế hoạch & Báo cáo</span>
               </div>
               <div className="flex justify-between items-center">
                  <h1
                     className="text-2xl font-bold text-gray-900 flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                     onClick={() => navigate('/')}
                  >
                     <span className="p-2 bg-teal-100 rounded-lg text-teal-700">
                        <FileText className="h-6 w-6" />
                     </span>
                     Kho Kế hoạch & Báo cáo
                  </h1>
                  {(user?.permissions?.includes('manage_documents') || user?.permissions?.includes('manage_office_docs')) && (
                     <button
                        onClick={handleOpenUpload}
                        className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg shadow-md transition-colors font-medium"
                     >
                        <Upload className="h-4 w-4" />
                        <span>Tải lên kế hoạch mới</span>
                     </button>
                  )}
               </div>
            </div>
         </div>

         {/* --- Main Layout --- */}
         <div className="flex flex-1 overflow-hidden max-w-7xl mx-auto w-full">

            {/* Sidebar - Filters */}
            <div className="w-64 bg-white border-r border-gray-200 flex-shrink-0 overflow-y-auto hidden md:block">
               <div className="p-6">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Danh mục hồ sơ</h3>
                  <nav className="space-y-1">
                     <button
                        onClick={() => setActiveCategory('all')}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${activeCategory === 'all' ? 'bg-teal-50 text-teal-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                     >
                        <div className={`w-2 h-2 rounded-full ${activeCategory === 'all' ? 'bg-teal-500' : 'bg-gray-300'}`}></div>
                        Tất cả hồ sơ
                     </button>

                     <button
                        onClick={() => setActiveCategory('finance')}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${activeCategory === 'finance' ? 'bg-teal-50 text-teal-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                     >
                        <Banknote className="h-4 w-4" />
                        Tài chính & Kế toán
                     </button>

                     <button
                        onClick={() => setActiveCategory('medical')}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${activeCategory === 'medical' ? 'bg-teal-50 text-teal-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                     >
                        <Stethoscope className="h-4 w-4" />
                        Y tế & Bán trú
                     </button>

                     <button
                        onClick={() => setActiveCategory('general')}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${activeCategory === 'general' ? 'bg-teal-50 text-teal-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                     >
                        <FileText className="h-4 w-4" />
                        Hành chính chung
                     </button>
                  </nav>
               </div>
            </div>

            {/* Main Content - Table */}
            <div className="flex-1 bg-gray-50 overflow-y-auto p-6">
               {/* Search Bar */}
               <div className="mb-6 flex items-center bg-white border border-gray-200 rounded-lg px-3 py-2 max-w-md shadow-sm focus-within:ring-2 focus-within:ring-teal-500 transition-all">
                  <Search className="h-5 w-5 text-gray-400" />
                  <input
                     type="text"
                     placeholder="Tìm kiếm tài liệu..."
                     className="ml-2 bg-transparent border-none outline-none text-sm w-full text-gray-700"
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                  />
               </div>

               {/* Data Table */}
               <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                     <thead className="bg-gray-50">
                        <tr>
                           <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên tài liệu</th>
                           <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Người đăng</th>
                           <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ngày đăng</th>
                           <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Góp ý</th>
                           <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Thao tác</th>
                        </tr>
                     </thead>
                     <tbody className="bg-white divide-y divide-gray-200">
                        {filteredDocs.map((doc) => (
                           <tr
                              key={doc.id}
                              onClick={() => handleRowClick(doc)}
                              className="hover:bg-teal-50/40 cursor-pointer transition-colors group"
                           >
                              <td className="px-6 py-4 whitespace-nowrap">
                                 <div className="flex items-center">
                                    <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-gray-100 rounded-lg">
                                       {getFileIcon(doc.type)}
                                    </div>
                                    <div className="ml-4">
                                       <div className="text-sm font-medium text-gray-900 group-hover:text-teal-700 transition-colors">{doc.name}</div>
                                       <div className="text-xs text-gray-500">{getCategoryLabel(doc.category)}</div>
                                    </div>
                                 </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                 <div className="flex items-center">
                                    <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-xs">
                                       {doc.uploader.name.charAt(0)}
                                    </div>
                                    <div className="ml-3">
                                       <div className="text-sm font-medium text-gray-900">{doc.uploader.name}</div>
                                       <div className="text-xs text-gray-500">{doc.uploader.role}</div>
                                    </div>
                                 </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                 {new Date(doc.uploadDate).toLocaleDateString('vi-VN')}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                 {(doc.comments || []).length > 0 ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 animate-pulse">
                                       <MessageSquare className="w-3 h-3 mr-1" />
                                       {(doc.comments || []).length} Góp ý mới
                                    </span>
                                 ) : (
                                    <span className="text-xs text-gray-400">Chưa có góp ý</span>
                                 )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                 <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                    <button className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-full transition-all">
                                       <Download className="h-4 w-4" />
                                    </button>
                                    <button
                                       onClick={(e) => openDeleteModal(doc, e)}
                                       className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                                    >
                                       <Trash2 className="h-4 w-4" />
                                    </button>
                                 </div>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
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

         {/* --- Drawer / Panel (Interaction) --- */}
         {isPanelOpen && currentDoc && (
            <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
               <div
                  className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
                  onClick={() => setIsPanelOpen(false)}
               ></div>

               <div className="relative w-full max-w-6xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

                  {/* Drawer Header */}
                  <div className="px-6 py-4 border-b border-teal-100 flex justify-between items-start bg-teal-50/30 flex-shrink-0">
                     <div>
                        <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider mb-1 block">
                           {getCategoryLabel(currentDoc.category)}
                        </span>
                        <h2 className="text-lg font-bold text-gray-900 leading-tight">{currentDoc.name}</h2>
                     </div>
                     <div className="flex items-center gap-2">
                        <button className="p-2 text-gray-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors" title="Tải xuống">
                           <Download className="h-5 w-5" />
                        </button>
                        <button onClick={() => setIsPanelOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                           <X className="h-5 w-5" />
                        </button>
                     </div>
                  </div>

                  {/* Content Body - Split View */}
                  <div className="flex-1 overflow-hidden flex flex-col md:flex-row">

                     {/* Left: Preview Area (Scrollable) */}
                     <div className="flex-1 overflow-hidden bg-gray-100 border-b md:border-b-0 md:border-r border-gray-200 relative flex flex-col">
                        {/* Floating Action for Preview */}
                        <div className="absolute top-4 right-6 flex gap-2 z-10">
                           <button
                              onClick={() => setIsFullScreenPreviewOpen(true)}
                              className="bg-white/80 backdrop-blur p-1.5 rounded-md shadow-sm text-gray-600 hover:text-teal-600 border border-gray-200 hover:scale-110 transition-all"
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
                              <span className="text-xs font-bold text-gray-800">{currentDoc.uploader.name}</span>
                           </div>
                           <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">Ngày tải lên</span>
                              <span className="text-xs font-bold text-gray-800">{new Date(currentDoc.uploadDate).toLocaleDateString('vi-VN')}</span>
                           </div>
                        </div>

                        {/* Chat Section */}
                        <div className="flex-1 overflow-y-auto p-4 bg-white">
                           <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2 sticky top-0 bg-white pb-2 z-10">
                              <MessageSquare className="h-4 w-4 text-teal-500" /> Ý kiến & Góp ý
                           </h3>

                           <div className="space-y-4 mb-4">
                              {(currentDoc.comments || []).length > 0 ? (
                                 (currentDoc.comments || []).map((c: Comment) => (
                                    <div key={c.id} className="flex gap-3">
                                       <div className="h-8 w-8 rounded-full bg-teal-100 text-teal-700 border border-teal-200 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                          {c.userName.charAt(0)}
                                       </div>
                                       <div className="bg-gray-100 rounded-xl rounded-tl-none p-3 flex-1">
                                          <div className="flex items-baseline gap-2 mb-1">
                                             <span className="text-xs font-bold text-gray-900">{c.userName}</span>
                                             <span className="text-[10px] text-gray-500">{c.userRole}</span>
                                          </div>
                                          <p className="text-sm text-gray-800">{c.content}</p>
                                       </div>
                                    </div>
                                 ))
                              ) : (
                                 <div className="text-center py-6 text-gray-400 text-xs italic">
                                    Chưa có góp ý nào.
                                 </div>
                              )}
                              <div ref={commentsEndRef} />
                           </div>
                        </div>

                        {/* Comment Input */}
                        <div className="p-4 border-t border-gray-200 bg-gray-50">
                           <form onSubmit={handlePostComment} className="relative">
                              <input
                                 type="text"
                                 className="w-full pl-4 pr-12 py-3 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent shadow-sm"
                                 placeholder="Nhập nội dung góp ý..."
                                 value={newComment}
                                 onChange={(e) => setNewComment(e.target.value)}
                              />
                              <button
                                 type="submit"
                                 disabled={!newComment.trim()}
                                 className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:bg-gray-300 transition-all"
                              >
                                 <Send className="h-4 w-4" />
                              </button>
                           </form>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         )}

         {/* --- Upload Modal (Teal Variant) --- */}
         {isUploadModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
               <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

                  {/* Modal Header */}
                  <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white">
                     <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Upload className="h-5 w-5 text-teal-600" />
                        Tải lên Tài liệu
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

                     {/* File Name */}
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tên hồ sơ <span className="text-red-500">*</span></label>
                        <input
                           type="text"
                           className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                           placeholder="VD: Kế hoạch thu chi tháng 11..."
                           value={uploadFormData.name}
                           onChange={(e) => setUploadFormData({ ...uploadFormData, name: e.target.value })}
                        />
                     </div>

                     {/* Category Selection */}
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phân loại hồ sơ <span className="text-red-500">*</span></label>
                        <select
                           className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all bg-white"
                           value={uploadFormData.category}
                           onChange={(e) => setUploadFormData({ ...uploadFormData, category: e.target.value })}
                        >
                           <option value="general">Hành chính chung</option>
                           <option value="finance">Tài chính & Kế toán</option>
                           <option value="medical">Y tế & Bán trú</option>
                        </select>
                     </div>

                     {/* Drag & Drop Zone */}
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tệp đính kèm</label>
                        <div
                           onDrop={handleFileDrop}
                           onDragOver={(e) => e.preventDefault()}
                           className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all group relative ${uploadFile ? 'border-teal-500 bg-teal-50' : 'border-gray-300 hover:bg-gray-50 hover:border-teal-400'}`}
                        >
                           <input
                              type="file"
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              onChange={handleFileInput}
                           />

                           {uploadFile ? (
                              <div className="flex flex-col items-center text-center animate-in zoom-in duration-300">
                                 <CheckCircle className="h-10 w-10 text-teal-600 mb-2" />
                                 <p className="text-sm font-bold text-teal-800 truncate max-w-[250px]">{uploadFile.name}</p>
                                 <p className="text-xs text-teal-600 mt-1">{(uploadFile.size / 1024).toFixed(0)} KB - Đã sẵn sàng</p>
                              </div>
                           ) : (
                              <div className="flex flex-col items-center text-center">
                                 <div className={`p-3 rounded-full mb-3 transition-colors ${uploadFormData.category === 'finance' ? 'bg-green-100 text-green-600' :
                                    uploadFormData.category === 'medical' ? 'bg-red-100 text-red-600' :
                                       'bg-blue-100 text-blue-600'
                                    }`}>
                                    <CloudUpload className="h-8 w-8" />
                                 </div>
                                 <p className="text-sm font-medium text-gray-700">
                                    Kéo thả file vào đây hoặc <span className="text-teal-600 underline">Bấm để chọn</span>
                                 </p>
                                 <p className="text-xs text-gray-400 mt-1">Hỗ trợ PDF, Excel, Word (Tối đa 10MB)</p>
                              </div>
                           )}
                        </div>
                     </div>

                     {/* Notes */}
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú thêm</label>
                        <textarea
                           rows={3}
                           className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all text-sm"
                           placeholder="Mô tả ngắn gọn nội dung..."
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
                        onClick={handleUploadSave}
                        disabled={!uploadFile}
                        className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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

export default OfficeDocuments;