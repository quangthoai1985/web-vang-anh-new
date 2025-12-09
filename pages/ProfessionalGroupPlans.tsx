import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
   ChevronRight,
   Upload,
   Search,
   FileText,
   Clock,
   Users,
   MoreVertical,
   MessageSquare,
   X,
   Send,
   Download,
   Trash2,
   Calendar,
   CheckCircle2,
   AlertCircle,
   File,
   Filter,
   CloudUpload,
   CheckCircle,
   Maximize2
} from 'lucide-react';
import { Comment } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { db } from '../firebase';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, updateDoc, arrayUnion } from 'firebase/firestore';
import { createNotification } from '../utils/notificationUtils';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getPreviewUrl } from '../utils/fileUtils';

// --- Mock Data specific to this page ---
interface GroupPlan {
   id: string;
   title: string;
   uploader: string;
   uploadDate: string;
   viewers: string[]; // Array of avatar/initials
   commentCount: number;
   type: 'plan';
}

interface MeetingMinute {
   id: string;
   date: string; // For timeline
   title: string;
   fileType: 'word' | 'pdf';
   status: 'finalized' | 'draft'; // Đã chốt | Đang thảo luận
   type: 'minute';
   comments: Comment[];
}



const ProfessionalGroupPlans: React.FC = () => {
   const navigate = useNavigate();
   const { user } = useAuth();
   const { addToast } = useNotification();

   // Data State
   const [plans, setPlans] = useState<GroupPlan[]>([]);
   const [minutes, setMinutes] = useState<MeetingMinute[]>([]);

   // Fetch Data from Firestore
   useEffect(() => {
      const q = query(collection(db, 'plans'), orderBy('uploadDate', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
         const plansData: GroupPlan[] = [];
         const minutesData: MeetingMinute[] = [];

         snapshot.forEach((doc) => {
            const data = doc.data() as any;
            const item = { id: doc.id, ...data };

            if (data.type === 'plan') {
               plansData.push(item);
            } else {
               minutesData.push(item);
            }
         });

         setPlans(plansData);
         setMinutes(minutesData);
      });

      return () => unsubscribe();
   }, []);

   // UI State
   const [selectedItem, setSelectedItem] = useState<GroupPlan | MeetingMinute | null>(null);
   const [isDrawerOpen, setIsDrawerOpen] = useState(false);
   const [isFullScreenPreviewOpen, setIsFullScreenPreviewOpen] = useState(false);
   const [newComment, setNewComment] = useState('');
   const commentsEndRef = useRef<HTMLDivElement>(null);

   // Upload Modal State
   const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
   const [uploadFile, setUploadFile] = useState<File | null>(null);
   const [uploadFormData, setUploadFormData] = useState({
      type: 'plan' as 'plan' | 'minute',
      name: '',
      date: '',
      status: 'draft' as 'draft' | 'finalized'
   });

   // Delete Modal State
   const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
   const [itemToDelete, setItemToDelete] = useState<GroupPlan | MeetingMinute | null>(null);

   // Permission Check for Upload Button
   const canUpload = user?.role === 'head_teacher' || user?.role === 'teacher';

   // Scroll to bottom of chat
   useEffect(() => {
      if (isDrawerOpen) {
         commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
   }, [isDrawerOpen, selectedItem]);

   const handleItemClick = (item: GroupPlan | MeetingMinute) => {
      setSelectedItem(item);
      setIsDrawerOpen(true);
   };

   const openDeleteModal = (item: GroupPlan | MeetingMinute, e: React.MouseEvent) => {
      e.stopPropagation();
      setItemToDelete(item);
      setIsDeleteModalOpen(true);
   };

   const confirmDelete = async () => {
      if (itemToDelete) {
         try {
            await deleteDoc(doc(db, 'plans', itemToDelete.id));

            addToast("Đã xóa tài liệu thành công", "Hồ sơ đã được xóa khỏi danh sách.", "success");
            setIsDeleteModalOpen(false);
            setItemToDelete(null);

            // Close drawer if open on deleted item
            if (selectedItem?.id === itemToDelete.id) {
               setIsDrawerOpen(false);
               setSelectedItem(null);
            }
         } catch (error) {
            console.error("Error deleting document: ", error);
            addToast("Lỗi", "Không thể xóa hồ sơ. Vui lòng thử lại.", "error");
         }
      }
   };

   const handlePostComment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newComment.trim() || !selectedItem || !user) return;

      const comment: Comment = {
         id: Date.now().toString(),
         userId: user.id,
         userName: user.fullName,
         userRole: user.role,
         content: newComment,
         timestamp: new Date().toISOString()
      };

      try {
         const docRef = doc(db, 'plans', selectedItem.id);
         await updateDoc(docRef, {
            comments: arrayUnion(comment),
            commentCount: (selectedItem.commentCount || 0) + 1
         });

         // Update local state (optimistic or wait for snapshot)
         // Snapshot will handle it, but we might want to clear input immediately
         setNewComment('');
         addToast("Đã gửi góp ý", "Nội dung của bạn đã được ghi nhận.", "success");

         // Send Notification
         await createNotification('comment', user, {
            type: 'group',
            name: selectedItem.title,
            targetPath: '/professional-group-plans'
         });

      } catch (error) {
         console.error("Error adding comment: ", error);
         addToast("Lỗi", "Không thể gửi góp ý.", "error");
      }
   };

   // --- Upload Handlers ---
   const handleOpenUpload = () => {
      setUploadFormData({
         type: 'plan',
         name: '',
         date: new Date().toISOString().split('T')[0],
         status: 'draft'
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

   const handleUploadSave = async () => {
      if (!uploadFile && !uploadFormData.name) return;

      try {
         let downloadUrl = '#';
         let fileType = 'word';

         // 1. Upload to Firebase Storage if file exists
         if (uploadFile) {
            const storageRef = ref(storage, `plans/${Date.now()}_${uploadFile.name}`);
            await uploadBytes(storageRef, uploadFile);
            downloadUrl = await getDownloadURL(storageRef);
            fileType = uploadFile.name.endsWith('pdf') ? 'pdf' : 'word';
         }

         const newItem = {
            ...uploadFormData,
            title: uploadFormData.name, // Map name to title
            uploader: user?.fullName || 'Ẩn danh',
            uploadDate: new Date().toISOString(),
            viewers: [],
            commentCount: 0,
            comments: [],
            fileType: fileType,
            url: downloadUrl
         };

         await addDoc(collection(db, 'plans'), newItem);

         addToast("Tải lên thành công", `Đã lưu hồ sơ: ${uploadFormData.name} (${uploadFormData.type === 'plan' ? 'Kế hoạch' : 'Biên bản'})`, "success");
         setIsUploadModalOpen(false);

         // Send Notification
         if (user) {
            await createNotification('upload', user, {
               type: 'group',
               name: uploadFormData.name,
               targetPath: '/professional-group-plans'
            });
         }
      } catch (error) {
         console.error("Error adding document: ", error);
         addToast("Lỗi", "Không thể lưu hồ sơ. Vui lòng thử lại.", "error");
      }
   };

   // Render file preview using real file URL
   const renderFilePreview = (isFullScreen: boolean = false) => {
      if (!selectedItem) return null;
      const itemUrl = (selectedItem as any).url;

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
      <div className="min-h-screen bg-gray-50 font-sans">

         {/* --- 1. HEADER KHU VỰC --- */}
         <div className="bg-white border-b border-orange-100 sticky top-0 z-30 shadow-sm">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
               {/* Breadcrumb */}
               <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                  <span className="cursor-pointer hover:text-orange-600" onClick={() => navigate('/')}>Dashboard</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="cursor-pointer hover:text-orange-600">Tổ Chuyên Môn</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="font-semibold text-orange-700">Kế hoạch Tổ</span>
               </div>

               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                     <h1
                        className="text-2xl font-bold text-gray-900 flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => navigate('/')}
                     >
                        <span className="p-2 bg-orange-100 rounded-lg text-orange-600">
                           <FileText className="h-6 w-6" />
                        </span>
                        Hồ sơ Tổ Chuyên Môn
                     </h1>
                     <p className="text-sm text-gray-500 mt-1 ml-12">
                        Quản lý kế hoạch hoạt động và lưu trữ biên bản họp định kỳ.
                     </p>
                  </div>

                  {canUpload && (
                     <button
                        onClick={handleOpenUpload}
                        className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-lg shadow-md transition-all font-medium"
                     >
                        <Upload className="h-4 w-4" />
                        <span>Tải lên Biên bản/Kế hoạch</span>
                     </button>
                  )}
               </div>
            </div>
         </div>

         {/* --- 2. CONTENT AREA (Single Column) --- */}
         <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 pb-20">

            {/* --- KHỐI 1: KẾ HOẠCH HOẠT ĐỘNG --- */}
            <section>
               <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-800 uppercase tracking-tight border-l-4 border-orange-500 pl-3">
                     Kế hoạch Hoạt động
                  </h2>
                  <button className="text-xs font-medium text-gray-500 hover:text-orange-600 flex items-center gap-1">
                     Xem tất cả <ChevronRight className="h-3 w-3" />
                  </button>
               </div>

               <div className="grid gap-4">
                  {plans.map((plan) => (
                     <div
                        key={plan.id}
                        onClick={() => handleItemClick(plan)}
                        className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md hover:border-orange-200 transition-all cursor-pointer group"
                     >
                        <div className="flex items-start justify-between">
                           <div className="flex items-center gap-4">
                              <div className="h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
                                 <FileText className="h-6 w-6" />
                              </div>
                              <div>
                                 <h3 className="text-base font-bold text-gray-900 group-hover:text-orange-700 transition-colors">
                                    {plan.title}
                                 </h3>
                                 <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                    <span className="flex items-center gap-1">
                                       <Users className="h-3 w-3" /> {plan.uploader}
                                    </span>
                                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                    <span className="flex items-center gap-1">
                                       <Clock className="h-3 w-3" /> {new Date(plan.uploadDate).toLocaleDateString('vi-VN')}
                                    </span>
                                 </div>
                              </div>
                           </div>

                           {/* Interaction Column */}
                           <div className="flex items-center gap-4">
                              <div className="flex -space-x-2">
                                 {plan.viewers.map((v, idx) => (
                                    <div key={idx} className="h-8 w-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600">
                                       {v}
                                    </div>
                                 ))}
                                 {plan.viewers.length > 0 && (
                                    <div className="h-8 w-8 rounded-full bg-gray-50 border-2 border-white flex items-center justify-center text-[10px] text-gray-400">
                                       +
                                    </div>
                                 )}
                              </div>
                              <div className="flex items-center gap-2">
                                 <div className="flex items-center gap-1 text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
                                    <MessageSquare className="h-4 w-4" />
                                    <span className="text-xs font-medium">{plan.commentCount}</span>
                                 </div>

                                 <button
                                    onClick={(e) => openDeleteModal(plan, e)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors z-10"
                                 >
                                    <Trash2 className="h-4 w-4" />
                                 </button>
                              </div>
                           </div>
                        </div>
                     </div>
                  ))}
                  {plans.length === 0 && (
                     <div className="text-center py-8 bg-white rounded-xl border border-dashed border-gray-200 text-gray-400">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Chưa có kế hoạch nào.
                     </div>
                  )}
               </div>
            </section>

            {/* --- KHỐI 2: BIÊN BẢN HỌP TỔ (TIMELINE) --- */}
            <section>
               <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-gray-800 uppercase tracking-tight border-l-4 border-orange-500 pl-3">
                     Biên bản Họp Tổ
                  </h2>
                  <div className="flex gap-2">
                     <button className="p-1.5 bg-white border border-gray-200 rounded-md text-gray-500 hover:text-orange-600 shadow-sm">
                        <Filter className="h-4 w-4" />
                     </button>
                  </div>
               </div>

               <div className="relative border-l-2 border-gray-200 ml-3 md:ml-6 space-y-8 pb-4">
                  {minutes.map((minute) => (
                     <div key={minute.id} className="relative pl-8 md:pl-10">
                        {/* Timeline Dot */}
                        <div className="absolute -left-[9px] top-0 h-5 w-5 rounded-full bg-white border-4 border-orange-200"></div>

                        {/* Date Label */}
                        <div className="absolute -left-2 top-7 md:top-1 md:-left-24 w-20 md:text-right">
                           <span className="text-xs font-bold text-gray-500">
                              {new Date(minute.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                           </span>
                        </div>

                        {/* Content Card */}
                        <div
                           onClick={() => handleItemClick(minute)}
                           className="bg-white rounded-lg border border-gray-200 p-4 hover:border-orange-300 hover:shadow-md transition-all cursor-pointer group relative pr-10"
                        >
                           <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                 {minute.status === 'finalized' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 uppercase">
                                       <CheckCircle2 className="h-3 w-3" /> Đã chốt
                                    </span>
                                 ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 uppercase animate-pulse">
                                       <AlertCircle className="h-3 w-3" /> Đang thảo luận
                                    </span>
                                 )}
                              </div>
                           </div>

                           <h3 className="text-sm font-bold text-gray-900 mb-3 group-hover:text-orange-700">
                              {minute.title}
                           </h3>

                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-100 group-hover:bg-orange-50 group-hover:border-orange-100 transition-colors">
                                 {minute.fileType === 'word' ? (
                                    <FileText className="h-4 w-4 text-blue-600" />
                                 ) : (
                                    <File className="h-4 w-4 text-red-500" />
                                 )}
                                 <span className="text-xs text-gray-600 font-medium truncate max-w-[150px]">
                                    Bien_ban_hop_{minute.date}.{minute.fileType === 'word' ? 'docx' : 'pdf'}
                                 </span>
                              </div>

                              {/* View Details Link */}
                              <span className="text-xs font-bold text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                                 Chi tiết <ChevronRight className="h-3 w-3" />
                              </span>
                           </div>

                           {/* Timeline Item Delete Button (Absolute positioned) */}
                           <button
                              onClick={(e) => openDeleteModal(minute, e)}
                              className="absolute top-2 right-2 p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors z-10"
                           >
                              <Trash2 className="h-4 w-4" />
                           </button>
                        </div>
                     </div>
                  ))}
                  {minutes.length === 0 && (
                     <div className="pl-10 text-sm text-gray-400 italic">Chưa có biên bản họp nào.</div>
                  )}
               </div>
            </section>
         </main>

         {/* Delete Confirmation Modal */}
         {isDeleteModalOpen && itemToDelete && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
               <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-6 text-center">
                     <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="h-8 w-8 text-red-600" />
                     </div>
                     <h3 className="text-lg font-bold text-gray-900 mb-2">Xác nhận xóa tài liệu?</h3>
                     <p className="text-sm text-gray-500 mb-6">
                        Bạn có chắc chắn muốn xóa file <span className="font-semibold text-gray-800">"{itemToDelete.title}"</span> không? Hành động này không thể hoàn tác.
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

         {/* --- DRAWER / PANEL (Interaction) --- */}
         {isDrawerOpen && selectedItem && (
            <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
               <div
                  className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
                  onClick={() => setIsDrawerOpen(false)}
               ></div>

               <div className="relative w-full max-w-6xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

                  {/* Drawer Header */}
                  <div className="px-6 py-4 border-b border-orange-100 flex justify-between items-start bg-orange-50/30 flex-shrink-0">
                     <div>
                        <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider mb-1 block">
                           {selectedItem.type === 'plan' ? 'Kế hoạch' : 'Biên bản họp'}
                        </span>
                        <h2 className="text-lg font-bold text-gray-900 leading-tight">{selectedItem.title}</h2>
                     </div>
                     <div className="flex items-center gap-2">
                        <button className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Tải xuống">
                           <Download className="h-5 w-5" />
                        </button>
                        <button onClick={() => setIsDrawerOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
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
                              className="bg-white/80 backdrop-blur p-1.5 rounded-md shadow-sm text-gray-600 hover:text-orange-600 border border-gray-200 hover:scale-110 transition-all"
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
                              <span className="text-xs font-bold text-gray-800">{selectedItem.uploader}</span>
                           </div>
                           <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">Ngày tải lên</span>
                              <span className="text-xs font-bold text-gray-800">{new Date(selectedItem.uploadDate).toLocaleDateString('vi-VN')}</span>
                           </div>
                        </div>

                        {/* Chat Section */}
                        <div className="flex-1 overflow-y-auto p-4 bg-white">
                           <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2 sticky top-0 bg-white pb-2 z-10">
                              <MessageSquare className="h-4 w-4 text-orange-500" /> Ý kiến chỉ đạo & Góp ý
                           </h3>

                           <div className="space-y-4 mb-4">
                              {/* Use mock comments or empty state */}
                              {(selectedItem as any).comments && (selectedItem as any).comments.length > 0 ? (
                                 (selectedItem as any).comments.map((c: Comment) => (
                                    <div key={c.id} className="flex gap-3">
                                       <div className="h-8 w-8 rounded-full bg-red-100 text-red-700 border border-red-200 flex items-center justify-center text-xs font-bold flex-shrink-0">
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
                                 className="w-full pl-4 pr-12 py-3 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent shadow-sm"
                                 placeholder="Nhập nội dung chỉ đạo..."
                                 value={newComment}
                                 onChange={(e) => setNewComment(e.target.value)}
                              />
                              <button
                                 type="submit"
                                 disabled={!newComment.trim()}
                                 className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:bg-gray-300 transition-all"
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

         {/* --- 4. UPLOAD MODAL (PROFESSIONAL GROUP) --- */}
         {isUploadModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
               <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

                  {/* Modal Header */}
                  <div className="px-6 py-4 border-b border-orange-100 flex justify-between items-center bg-white">
                     <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Upload className="h-5 w-5 text-orange-600" />
                        Thêm mới Hồ sơ Chuyên Môn
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

                     {/* 1. File Type Selection (Radio/Pills) */}
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Loại hồ sơ <span className="text-red-500">*</span></label>
                        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                           <button
                              onClick={() => setUploadFormData({ ...uploadFormData, type: 'plan' })}
                              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${uploadFormData.type === 'plan'
                                 ? 'bg-white text-orange-700 shadow-sm'
                                 : 'text-gray-500 hover:text-gray-700'
                                 }`}
                           >
                              Kế hoạch hoạt động
                           </button>
                           <button
                              onClick={() => setUploadFormData({ ...uploadFormData, type: 'minute' })}
                              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${uploadFormData.type === 'minute'
                                 ? 'bg-white text-orange-700 shadow-sm'
                                 : 'text-gray-500 hover:text-gray-700'
                                 }`}
                           >
                              Biên bản họp tổ
                           </button>
                        </div>
                     </div>

                     {/* 2. File Name */}
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tên văn bản <span className="text-red-500">*</span></label>
                        <input
                           autoFocus
                           type="text"
                           className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                           placeholder="VD: Kế hoạch chuyên môn Tháng 11..."
                           value={uploadFormData.name}
                           onChange={(e) => setUploadFormData({ ...uploadFormData, name: e.target.value })}
                        />
                     </div>

                     {/* 3. Date & Status Grid */}
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="block text-sm font-medium text-gray-700 mb-1">
                              {uploadFormData.type === 'minute' ? 'Ngày họp' : 'Thời gian áp dụng'}
                           </label>
                           <input
                              type="date"
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm"
                              value={uploadFormData.date}
                              onChange={(e) => setUploadFormData({ ...uploadFormData, date: e.target.value })}
                           />
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                           <select
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-white text-sm"
                              value={uploadFormData.status}
                              onChange={(e) => setUploadFormData({ ...uploadFormData, status: e.target.value as any })}
                           >
                              <option value="draft">🟡 Đang thảo luận</option>
                              <option value="finalized">🟢 Đã chốt / Ban hành</option>
                           </select>
                        </div>
                     </div>

                     {/* 4. Drag & Drop Zone */}
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tệp đính kèm</label>
                        <div
                           onDrop={handleFileDrop}
                           onDragOver={(e) => e.preventDefault()}
                           className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all group relative ${uploadFile ? 'border-orange-500 bg-orange-50' : 'border-gray-300 hover:bg-gray-50 hover:border-orange-400'}`}
                        >
                           <input
                              type="file"
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              onChange={handleFileInput}
                              accept=".pdf,.doc,.docx"
                           />

                           {uploadFile ? (
                              <div className="flex flex-col items-center text-center animate-in zoom-in duration-300">
                                 <CheckCircle className="h-10 w-10 text-orange-600 mb-2" />
                                 <p className="text-sm font-bold text-orange-800 truncate max-w-[250px]">{uploadFile.name}</p>
                                 <p className="text-xs text-orange-600 mt-1">{(uploadFile.size / 1024).toFixed(0)} KB - Đã sẵn sàng</p>
                              </div>
                           ) : (
                              <div className="flex flex-col items-center text-center">
                                 <div className="p-3 rounded-full mb-3 bg-orange-100 text-orange-600 transition-colors">
                                    <CloudUpload className="h-8 w-8" />
                                 </div>
                                 <p className="text-sm font-medium text-gray-700">
                                    Kéo thả file vào đây hoặc <span className="text-orange-600 underline">Bấm để chọn</span>
                                 </p>
                                 <p className="text-xs text-gray-400 mt-1">Hỗ trợ PDF, Word (Tối đa 10MB)</p>
                              </div>
                           )}
                        </div>
                     </div>

                  </div>

                  {/* 5. Footer */}
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                     <button
                        onClick={() => setIsUploadModalOpen(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white hover:shadow-sm rounded-lg border border-transparent hover:border-gray-300 transition-all"
                     >
                        Hủy bỏ
                     </button>
                     <button
                        onClick={handleUploadSave}
                        className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-md transition-all"
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

export default ProfessionalGroupPlans;