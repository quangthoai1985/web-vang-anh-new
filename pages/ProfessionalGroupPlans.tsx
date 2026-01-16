import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
   Maximize2,
   XCircle,
   Edit3,
   Lock
} from 'lucide-react';
import { Comment, ApprovalInfo, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { db } from '../firebase';
import { collection, doc, query, where, orderBy, getDocs, updateDoc, deleteDoc, addDoc, arrayUnion, deleteField, onSnapshot } from 'firebase/firestore';
import { createNotification } from '../utils/notificationUtils';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getPreviewUrl } from '../utils/fileUtils';
import IntegratedFileViewer from '../components/IntegratedFileViewer';

// --- Interfaces for this page ---
interface GroupPlan {
   id: string;
   title: string;
   uploader: string;
   uploaderId?: string; // ID người upload
   uploaderRole: UserRole; // Vai trò người upload để xác định ai được duyệt
   uploadDate: string;
   viewers: string[]; // Array of avatar/initials
   commentCount: number;
   comments?: Comment[]; // List of comments
   type: 'plan';
   approval?: ApprovalInfo; // Thông tin phê duyệt
}

interface MeetingMinute {
   id: string;
   date: string; // For timeline
   title: string;
   uploader: string;
   uploaderId?: string; // ID người upload
   uploaderRole: UserRole;
   fileType: 'word' | 'pdf';
   status: 'finalized' | 'draft'; // Đã chốt | Đang thảo luận
   type: 'minute';
   comments: Comment[];
   approval?: ApprovalInfo; // Thông tin phê duyệt
}



import { useSchoolYear } from '../context/SchoolYearContext';

// ... (existing helper interface definitions)

const ProfessionalGroupPlans: React.FC = () => {
   const navigate = useNavigate();
   const { user } = useAuth();
   const { addToast } = useNotification();
   const [searchParams, setSearchParams] = useSearchParams();
   const { currentSchoolYear } = useSchoolYear();

   // Highlight state for notification navigation
   const [highlightFileId, setHighlightFileId] = useState<string | null>(null);
   const [isDeleteRevisionModalOpen, setIsDeleteRevisionModalOpen] = useState(false);
   const [itemToDeleteRevision, setItemToDeleteRevision] = useState<GroupPlan | MeetingMinute | null>(null);


   // Data State
   const [plans, setPlans] = useState<GroupPlan[]>([]);
   const [minutes, setMinutes] = useState<MeetingMinute[]>([]);

   // Fetch Data from Firestore
   useEffect(() => {
      // Fetch all, then filter by school year client-side to handle legacy data
      const q = query(collection(db, 'plans'), orderBy('uploadDate', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
         const plansData: GroupPlan[] = [];
         const minutesData: MeetingMinute[] = [];

         snapshot.forEach((doc) => {
            const data = doc.data() as any;
            const item = { id: doc.id, ...data };

            // School Year Check
            // Legacy items (undefined schoolYear) default to '2025-2026'
            const itemYear = data.schoolYear || '2025-2026';
            if (itemYear !== currentSchoolYear) return;

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
   }, [currentSchoolYear]);

   // Handle notification navigation - highlight and open drawer
   const processedFileIdRef = useRef<string | null>(null);

   useEffect(() => {
      const fileId = searchParams.get('fileId');
      const highlight = searchParams.get('highlight');

      // Skip if no fileId, no highlight param, or data not loaded yet
      if (!fileId || highlight !== 'true' || (plans.length === 0 && minutes.length === 0)) {
         return;
      }

      // Skip if we've already processed this fileId
      if (processedFileIdRef.current === fileId) {
         return;
      }

      const foundPlan = plans.find(p => p.id === fileId);
      const foundMinute = minutes.find(m => m.id === fileId);
      const foundItem = foundPlan || foundMinute;

      if (foundItem) {
         // Mark as processed immediately to prevent re-processing
         processedFileIdRef.current = fileId;

         // Set highlight first
         setHighlightFileId(fileId);

         // Clear URL params
         setSearchParams({}, { replace: true });

         // Scroll to element
         const element = document.getElementById(`file-${fileId}`);
         if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
         }

         // Open drawer/viewer after a short delay to let highlight be visible
         const openTimer = setTimeout(() => {
            setSelectedItem(foundItem);
            setIsFileViewerOpen(true);
         }, 300);

         // Clear highlight after 5 seconds (extended from 3 for better visibility)
         const clearTimer = setTimeout(() => {
            setHighlightFileId(null);
            processedFileIdRef.current = null; // Reset for potential future navigations
         }, 5000);

         return () => {
            clearTimeout(openTimer);
            clearTimeout(clearTimer);
         };
      }
   }, [searchParams, plans, minutes, setSearchParams]);

   const [selectedItem, setSelectedItem] = useState<GroupPlan | MeetingMinute | null>(null);
   const [isFileViewerOpen, setIsFileViewerOpen] = useState(false);
   const [isDrawerOpen, setIsDrawerOpen] = useState(false); // Kept for legacy, not used
   const [isFullScreenPreviewOpen, setIsFullScreenPreviewOpen] = useState(false); // Kept for legacy, not used
   const [newComment, setNewComment] = useState('');
   const commentsEndRef = useRef<HTMLDivElement>(null);

   // Comment Editing State
   const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
   const [editingContent, setEditingContent] = useState('');

   // Delete Comment Modal State
   const [isDeleteCommentModalOpen, setIsDeleteCommentModalOpen] = useState(false);
   const [commentToDelete, setCommentToDelete] = useState<Comment | null>(null);

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

   // Rejection Modal State
   const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
   const [itemToReject, setItemToReject] = useState<GroupPlan | MeetingMinute | null>(null);
   const [rejectionReason, setRejectionReason] = useState('');

   // Word Editor Modal State
   const [isWordEditorOpen, setIsWordEditorOpen] = useState(false);
   const [editingItem, setEditingItem] = useState<GroupPlan | MeetingMinute | null>(null);

   // Permission Check for Upload Button
   const canUpload = user?.role === 'head_teacher' || user?.role === 'vice_head_teacher' || user?.role === 'teacher';

   // Permission Check for Edit Button - Only author can edit their own files
   const canEdit = (item: GroupPlan | MeetingMinute): boolean => {
      if (!user) return false;
      const itemData = item as any;
      const isOwnerById = itemData.uploaderId && itemData.uploaderId === user.id;
      const isOwnerByName = item.uploader === user.fullName;
      return isOwnerById || isOwnerByName;
   };

   // Permission Check for Comment (Reviewer: Principal/Admin)
   // ONLY when file is NOT approved (pending or needs_revision)
   const canComment = (item: GroupPlan | MeetingMinute): boolean => {
      if (!user) return false;
      // Block if file is already approved
      const approvalStatus = item.approval?.status;
      if (approvalStatus === 'approved') return false;
      // Principal and Admin can comment on everything (Acting as Reviewer)
      return ['principal', 'admin'].includes(user.role);
   };

   // Permission Check for Response (Uploader)
   // Response input is only shown when:
   // 1. File has 'needs_revision' status (reviewer requested changes)
   // 2. User is the file owner
   // 3. File is NOT already approved
   const canRespond = (item: GroupPlan | MeetingMinute): boolean => {
      if (!user) return false;

      // Block if file is already approved
      const approvalStatus = item.approval?.status;
      if (approvalStatus === 'approved') return false;

      // Use canEdit to check ownership as it already handles ID/Name fallback
      const isOwner = canEdit(item);

      // Only allow response if file needs revision (has active revision request)
      const needsRevision = approvalStatus === 'needs_revision';

      return isOwner && needsRevision;
   };

   // Check if user can edit/delete a specific comment (only own comments)
   const canManageComment = (comment: Comment): boolean => {
      if (!user) return false;
      return comment.userId === user.id;
   };


   // Check if file is a Word document (editable)
   const isWordFile = (item: GroupPlan | MeetingMinute): boolean => {
      const itemData = item as any;
      const fileType = itemData.fileType;
      const url = itemData.url || '';
      // Check fileType OR file extension in URL
      const hasWordExtension = url.includes('.docx') || url.includes('.doc');
      const result = fileType === 'word' || fileType === 'docx' || hasWordExtension;

      console.log('[isWordFile] Checking:', {
         fileType,
         url: url.substring(0, 50) + '...',
         hasWordExtension,
         result
      });

      return result;
   };

   // Open Word Editor
   const handleOpenWordEditor = (item: GroupPlan | MeetingMinute, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingItem(item);
      setIsWordEditorOpen(true);
   };

   // Handle File Viewer save success
   const handleFileViewerSaveSuccess = () => {
      addToast("Lưu thành công", "Tài liệu đã được cập nhật.", "success");
   };

   // Kiểm tra quyền duyệt kế hoạch - Chỉ Hiệu trưởng mới được duyệt
   const canApprove = (item: GroupPlan | MeetingMinute): boolean => {
      if (!user) return false;
      // Chỉ Hiệu trưởng (principal) hoặc Admin mới có quyền duyệt
      return ['principal', 'admin'].includes(user.role);
   };

   // Xử lý duyệt kế hoạch
   const handleApprove = async (item: GroupPlan | MeetingMinute) => {
      if (!user) return;

      try {
         const docRef = doc(db, 'plans', item.id);
         await updateDoc(docRef, {
            approval: {
               status: 'approved',
               reviewerId: user.id,
               reviewerName: user.fullName,
               reviewerRole: user.role,
               reviewedAt: new Date().toISOString()
            }
         });

         addToast("Đã duyệt", `Đã duyệt hồ sơ "${item.title}".`, "success");

         // Notify uploader
         await createNotification('system', user, {
            type: 'group',
            name: `Đã duyệt: ${item.title}`,
            targetPath: '/to-chuyen-mon-ke-hoach',
            extraInfo: { uploaderId: (item as any).uploaderId }
         });
      } catch (error) {
         console.error("Error approving plan:", error);
         addToast("Lỗi", "Không thể duyệt hồ sơ. Vui lòng thử lại.", "error");
      }
   };

   // Xử lý chốt biên bản họp (Chỉ dành cho tác giả)
   const handleFinalizeMinute = async (minute: MeetingMinute) => {
      if (!user || minute.uploaderId !== user.id) return;

      if (!window.confirm("Bạn có chắc chắn muốn CHỐT biên bản này? Sau khi chốt sẽ hiển thị trạng thái 'Đã chốt'.")) return;

      try {
         const docRef = doc(db, 'plans', minute.id);
         await updateDoc(docRef, {
            status: 'finalized'
         });

         addToast("Đã chốt biên bản", "Biên bản họp đã được chuyển sang trạng thái Đã chốt.", "success");
      } catch (error) {
         console.error("Error finalizing minute:", error);
         addToast("Lỗi", "Không thể chốt biên bản. Vui lòng thử lại.", "error");
      }
   };

   // Mở modal yêu cầu sửa lại (thay cho rejection)
   const openRejectModal = (item: GroupPlan | MeetingMinute) => {
      setItemToReject(item);
      setRejectionReason('');
      setIsRejectModalOpen(true);
   };

   // Xử lý yêu cầu sửa lại
   const handleRequestRevision = async () => {
      if (!user || !itemToReject) return;

      try {
         const docRef = doc(db, 'plans', itemToReject.id);

         // TYPE CHANGE: 'request' instead of 'comment'
         const revisionRequest: Comment = {
            id: Date.now().toString(),
            userId: user.id,
            userName: user.fullName,
            userRole: user.role,
            content: rejectionReason || 'Yêu cầu chỉnh sửa lại.',
            timestamp: new Date().toISOString(),
            type: 'request' // Distinct type for revision requests
         };

         const newApproval = {
            status: 'needs_revision' as const,
            reviewerId: user.id,
            reviewerName: user.fullName,
            reviewerRole: user.role,
            reviewedAt: new Date().toISOString(),
            rejectionReason: rejectionReason
         };

         await updateDoc(docRef, {
            approval: newApproval,
            comments: arrayUnion(revisionRequest),
            commentCount: (itemToReject.commentCount || 0) + 1
         });

         // Optimistic UI Update: Update selectedItem immediately
         if (selectedItem && selectedItem.id === itemToReject.id) {
            setSelectedItem({
               ...selectedItem,
               approval: newApproval,
               comments: [...(selectedItem.comments || []), revisionRequest],
               commentCount: (selectedItem.commentCount || 0) + 1
            });
         }

         addToast("Đã gửi yêu cầu sửa", `Đã yêu cầu sửa lại hồ sơ "${itemToReject.title}".`, "success");

         // Notify uploader with HIGHLIGHT params
         await createNotification('comment', user, {
            type: 'group',
            name: `Yêu cầu sửa: ${itemToReject.title}`,
            targetPath: `/to-chuyen-mon-ke-hoach?fileId=${itemToReject.id}&highlight=true`, // Updated path
            extraInfo: { uploaderId: (itemToReject as any).uploaderId }
         });

         setIsRejectModalOpen(false);
         setItemToReject(null);
         setRejectionReason('');
      } catch (error) {
         console.error("Error requesting revision:", error);
         addToast("Lỗi", "Không thể gửi yêu cầu sửa. Vui lòng thử lại.", "error");
      }
   };

   // Scroll to bottom of chat
   useEffect(() => {
      if (isDrawerOpen) {
         commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
   }, [isDrawerOpen, selectedItem]);

   const handleItemClick = (item: GroupPlan | MeetingMinute) => {
      setSelectedItem(item);
      setIsFileViewerOpen(true);
   };

   // Permission Check for Deletion - Only author can delete
   const canDelete = (item: GroupPlan | MeetingMinute): boolean => {
      if (!user) return false;
      const itemData = item as any;
      const isOwnerById = itemData.uploaderId && itemData.uploaderId === user.id;
      const isOwnerByName = item.uploader === user.fullName;
      return isOwnerById || isOwnerByName;
   };

   const openDeleteModal = (item: GroupPlan | MeetingMinute, e: React.MouseEvent) => {
      e.stopPropagation();
      setItemToDelete(item);
      setIsDeleteModalOpen(true);
   };

   const confirmDelete = async () => {
      // Permission safeguarding
      if (itemToDelete && !canDelete(itemToDelete)) {
         addToast("Không có quyền", "Bạn không thể xóa tài liệu của người khác.", "error");
         setIsDeleteModalOpen(false);
         return;
      }

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

   // Handle Author Response
   const handleResponse = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newComment.trim() || !selectedItem || !user) return;

      if (!canRespond(selectedItem)) return;

      const response: Comment = {
         id: Date.now().toString(),
         userId: user.id,
         userName: user.fullName,
         userRole: user.role,
         content: newComment,
         timestamp: new Date().toISOString(),
         type: 'response'
      };

      try {
         const docRef = doc(db, 'plans', selectedItem.id);

         // When author responds, we assume they have fixed the issue or are explaining.
         // Optionally we could set status back to 'pending' if it was 'needs_revision'
         // so it shows up for the admin again.
         // User requirement: "Allowing Edit/Delete... Reverting Status...". 
         // For Response specifically: "Author Response... Admin Re-approve". 
         // If we don't change status to pending, it might stay in 'Cần sửa' filter.
         // Let's set it to 'pending' to signal "I'm done, please review".

         await updateDoc(docRef, {
            approval: {
               ...selectedItem.approval,
               status: 'pending', // Revert to pending on response
               reviewedAt: new Date().toISOString() // Update timestamp
            },
            comments: arrayUnion(response),
            commentCount: (selectedItem.commentCount || 0) + 1
         });

         setNewComment('');
         addToast("Đã gửi phản hồi", "Phản hồi của bạn đã được gửi. Hồ sơ chuyển sang trạng thái chờ duyệt.", "success");

         // Notify Reviewer (The one who requested revision, or just Principal)
         // Find the last reviewer ID
         const targetId = selectedItem.approval?.reviewerId;

         // If a specific reviewer requested it, notify them. Otherwise notify Head/ViceHead/Principal logic?
         // Since we don't have a complex role map here, let's try to notify the last reviewer.
         // If no reviewerId, maybe generic notification?

         if (targetId && targetId !== user.id) {
            await createNotification('comment', user, {
               type: 'group',
               name: `Phản hồi từ ${user.fullName}: ${selectedItem.title}`,
               targetPath: `/to-chuyen-mon-ke-hoach?fileId=${selectedItem.id}&highlight=true`,
               extraInfo: { uploaderId: targetId }
            });
         }

      } catch (error) {
         console.error("Error adding response: ", error);
         addToast("Lỗi", "Không thể gửi phản hồi.", "error");
      }
   };


   // --- Comment Management (Edit/Delete) ---
   const handleDeleteComment = (comment: Comment) => {
      setCommentToDelete(comment);
      setIsDeleteCommentModalOpen(true);
   };

   const confirmDeleteComment = async () => {
      if (!user || !commentToDelete || !selectedItem) return;

      try {
         const docRef = doc(db, 'plans', selectedItem.id);
         const updatedComments = selectedItem.comments!.filter(c => c.id !== commentToDelete.id);

         const updateData: any = {
            comments: updatedComments,
            commentCount: updatedComments.length
         };

         // Special Logic: If deleting a 'request', check if we need to revert status
         let newApprovalStatus = selectedItem.approval?.status;
         let newRejectionReason = selectedItem.approval?.rejectionReason;

         if (commentToDelete.type === 'request') {
            if (newApprovalStatus === 'needs_revision') {
               newApprovalStatus = 'pending';
               newRejectionReason = undefined; // For local state

               // Use Dot Notation for nested FieldValue ops in Firestore
               updateData['approval.status'] = 'pending';
               updateData['approval.rejectionReason'] = deleteField();

               addToast("Đã hoàn tác", "Yêu cầu sửa đã bị xóa. Trạng thái hồ sơ trở về 'Chờ duyệt'.", "info");
            }
         }

         await updateDoc(docRef, updateData);

         // Update Local State for UI
         if (selectedItem) {
            setSelectedItem({
               ...selectedItem,
               comments: updatedComments,
               commentCount: updatedComments.length,
               approval: {
                  ...selectedItem.approval,
                  status: newApprovalStatus,
                  rejectionReason: newRejectionReason
               } as any
            });
         }

         addToast("Đã xóa", "Nội dung đã được xóa.", "success");

         setIsDeleteCommentModalOpen(false);
         setCommentToDelete(null);

      } catch (error) {
         console.error("Error deleting comment:", error);
         addToast("Lỗi", "Không thể xóa nội dung.", "error");
      }
   };

   // --- Handle Active Revision (Legacy/Orphan Support) ---
   const handleDeleteActiveRevision = (item: GroupPlan | MeetingMinute) => {
      setItemToDeleteRevision(item);
      setIsDeleteRevisionModalOpen(true);
   };

   const confirmDeleteActiveRevision = async () => {
      if (!itemToDeleteRevision) return;
      try {
         const docRef = doc(db, 'plans', itemToDeleteRevision.id);
         await updateDoc(docRef, {
            'approval.status': 'pending',
            'approval.rejectionReason': deleteField(),
            'approval.reviewedAt': new Date().toISOString()
         });

         // Update Local State for UI
         if (selectedItem && selectedItem.id === itemToDeleteRevision.id) {
            setSelectedItem({
               ...selectedItem,
               approval: {
                  ...selectedItem.approval,
                  status: 'pending',
                  rejectionReason: undefined // Clear it locally
               } as any
            });
         }

         addToast("Đã hoàn tác", "Yêu cầu sửa đã được xóa.", "success");
         setIsDeleteRevisionModalOpen(false);
         setItemToDeleteRevision(null);
      } catch (error) {
         console.error("Error deleting active revision:", error);
         addToast("Lỗi", "Không thể xóa yêu cầu.", "error");
      }
   };

   const handleEditActiveRevision = async (item: GroupPlan | MeetingMinute) => {
      const newReason = prompt("Nhập nội dung yêu cầu sửa mới:", item.approval?.rejectionReason);
      if (newReason === null || newReason === item.approval?.rejectionReason) return;
      if (!newReason.trim()) {
         alert("Nội dung không được để trống!");
         return;
      }

      try {
         const docRef = doc(db, 'plans', item.id);
         await updateDoc(docRef, {
            'approval.rejectionReason': newReason,
            'approval.reviewedAt': new Date().toISOString()
         });

         // Update Local State for UI
         if (selectedItem && selectedItem.id === item.id) {
            setSelectedItem({
               ...selectedItem,
               approval: {
                  ...selectedItem.approval,
                  rejectionReason: newReason
               } as any
            });
         }

         addToast("Thành công", "Đã cập nhật yêu cầu sửa.", "success");
      } catch (error) {
         console.error("Error editing active revision:", error);
         addToast("Lỗi", "Không thể cập nhật yêu cầu.", "error");
      }
   };

   const handleEditComment = async (commentId: string, item: GroupPlan | MeetingMinute) => {
      if (!user || !editingContent.trim()) return;

      try {
         const docRef = doc(db, 'plans', item.id);
         const updatedComments = item.comments!.map(c =>
            c.id === commentId
               ? { ...c, content: editingContent, editedAt: new Date().toISOString() }
               : c
         );

         await updateDoc(docRef, {
            comments: updatedComments
         });

         addToast("Đã cập nhật", "Góp ý đã được chỉnh sửa.", "success");
         setEditingCommentId(null);
         setEditingContent('');

         // Notify about edit
         await createNotification('comment', user, {
            type: 'group',
            name: `Đã sửa góp ý: ${item.title}`,
            targetPath: '/to-chuyen-mon-ke-hoach',
            extraInfo: { uploaderId: (item as any).uploaderId }
         });

      } catch (error) {
         console.error("Error editing comment:", error);
         addToast("Lỗi", "Không thể chỉnh sửa góp ý.", "error");
      }
   };

   const startEditingComment = (comment: Comment) => {
      setEditingCommentId(comment.id);
      setEditingContent(comment.content);
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
            uploaderId: user?.id || '', // Thêm uploaderId để kiểm tra quyền chính xác
            uploaderRole: user?.role || 'teacher', // Lưu vai trò người upload
            uploadDate: new Date().toISOString(),
            schoolYear: currentSchoolYear, // Add current school year
            viewers: [],
            commentCount: 0,
            comments: [],
            fileType: fileType,
            url: downloadUrl,
            // Trạng thái phê duyệt mặc định là "Chờ duyệt"
            approval: {
               status: 'pending'
            }
         };

         await addDoc(collection(db, 'plans'), newItem);

         addToast("Tải lên thành công", `Đã lưu hồ sơ: ${uploadFormData.name} (${uploadFormData.type === 'plan' ? 'Kế hoạch' : 'Biên bản'})`, "success");
         setIsUploadModalOpen(false);

         // Send Notification
         if (user) {
            await createNotification('upload', user, {
               type: 'group',
               name: uploadFormData.name,
               targetPath: '/to-chuyen-mon-ke-hoach'
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
                        id={`file-${plan.id}`} // Check ID for scroll
                        onClick={() => handleItemClick(plan)}
                        className={`bg-white rounded-xl p-5 border shadow-sm hover:shadow-md transition-all cursor-pointer group
                           ${highlightFileId === plan.id ? 'ring-2 ring-orange-500 bg-orange-50 animate-pulse' : 'border-gray-100 hover:border-orange-200'}
                        `}
                     >
                        <div className="flex items-start justify-between">
                           <div className="flex items-center gap-4">
                              <div className="h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
                                 <FileText className="h-6 w-6" />
                              </div>
                              <div>
                                 <div className="flex items-center gap-2">
                                    <h3 className="text-base font-bold text-gray-900 group-hover:text-orange-700 transition-colors">
                                       {plan.title}
                                    </h3>
                                    {/* Approval Status Badge */}
                                    {plan.approval?.status === 'pending' && (
                                       <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 uppercase">
                                          <Clock className="h-3 w-3" /> Chờ duyệt
                                       </span>
                                    )}
                                    {plan.approval?.status === 'approved' && (
                                       <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 uppercase">
                                          <CheckCircle2 className="h-3 w-3" /> Đã duyệt
                                       </span>
                                    )}
                                    {(plan.approval?.status === 'rejected' || plan.approval?.status === 'needs_revision') && (
                                       <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 uppercase" title={plan.approval.rejectionReason}>
                                          <Edit3 className="h-3 w-3" /> Cần sửa
                                       </span>
                                    )}
                                 </div>
                                 <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                    <span className="flex items-center gap-1">
                                       <Users className="h-3 w-3" /> {plan.uploader}
                                    </span>
                                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                    <span className="flex items-center gap-1">
                                       <Clock className="h-3 w-3" /> {new Date(plan.uploadDate).toLocaleDateString('vi-VN')}
                                    </span>
                                 </div>
                                 {/* Show revision reason - MOVED TO MODAL */}
                              </div>
                           </div>

                           {/* Interaction Column */}
                           <div className="flex items-center gap-4">
                              {/* Approval Buttons - Only show for users who can approve and item is pending */}
                              {canApprove(plan) && plan.approval?.status === 'pending' && (
                                 <div className="flex items-center gap-1">
                                    <button
                                       onClick={(e) => { e.stopPropagation(); handleApprove(plan); }}
                                       className="px-3 py-1.5 text-xs font-bold text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors shadow-sm flex items-center gap-1"
                                    >
                                       <CheckCircle2 className="h-3.5 w-3.5" /> Duyệt
                                    </button>
                                    <button
                                       onClick={(e) => { e.stopPropagation(); openRejectModal(plan); }}
                                       className="px-3 py-1.5 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors shadow-sm flex items-center gap-1"
                                    >
                                       <Edit3 className="h-3.5 w-3.5" /> Yêu cầu sửa
                                    </button>
                                 </div>
                              )}
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
                                 {/* Delete button removed from list view */}
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
                           id={`file-${minute.id}`} // Check ID for scroll
                           onClick={() => handleItemClick(minute)}
                           className={`bg-white rounded-lg border p-4 hover:shadow-md transition-all cursor-pointer group relative pr-10
                              ${highlightFileId === minute.id ? 'ring-2 ring-orange-500 bg-orange-50 animate-pulse' : 'border-gray-200 hover:border-orange-300'}
                           `}
                        >
                           <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                 {minute.status === 'finalized' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 uppercase">
                                       <CheckCircle2 className="h-3 w-3" /> Đã chốt
                                    </span>
                                 ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 uppercase animate-pulse">
                                       <AlertCircle className="h-3 w-3" /> Đang thảo luận
                                    </span>
                                 )}
                                 {/* Approval Status Badge */}
                                 {minute.approval?.status === 'pending' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200">
                                       <Clock className="h-3 w-3" /> Chờ duyệt
                                    </span>
                                 )}
                                 {minute.approval?.status === 'approved' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-600 border border-green-200">
                                       <CheckCircle2 className="h-3 w-3" /> Đã duyệt
                                    </span>
                                 )}
                                 {(minute.approval?.status === 'rejected' || minute.approval?.status === 'needs_revision') && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-600 border border-orange-200" title={minute.approval.rejectionReason}>
                                       <Edit3 className="h-3 w-3" /> Cần sửa
                                    </span>
                                 )}
                              </div>
                              {/* Approval Buttons for Minutes */}
                              {canApprove(minute) && minute.approval?.status === 'pending' && (
                                 <div className="flex items-center gap-1">
                                    <button
                                       onClick={(e) => { e.stopPropagation(); handleApprove(minute); }}
                                       className="px-2 py-1 text-[10px] font-bold text-white bg-green-500 hover:bg-green-600 rounded transition-colors flex items-center gap-0.5"
                                    >
                                       <CheckCircle2 className="h-3 w-3" /> Duyệt
                                    </button>
                                    <button
                                       onClick={(e) => { e.stopPropagation(); openRejectModal(minute); }}
                                       className="px-2 py-1 text-[10px] font-bold text-white bg-amber-500 hover:bg-amber-600 rounded transition-colors flex items-center gap-0.5"
                                    >
                                       <Edit3 className="h-3 w-3" /> Yêu cầu sửa
                                    </button>
                                 </div>
                              )}
                           </div>

                           <h3 className="text-sm font-bold text-gray-900 mb-3 group-hover:text-orange-700">
                              {minute.title}
                           </h3>

                           {/* Show rejection reason if rejected */}
                           {(minute.approval?.status === 'rejected' || minute.approval?.status === 'needs_revision') && minute.approval.rejectionReason && (
                              <div className="mb-3 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100">
                                 <span className="font-semibold">Yêu cầu sửa:</span> {minute.approval.rejectionReason}
                              </div>
                           )}

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

                           {/* Timeline Item Actions (Absolute positioned) */}
                           <div className="absolute top-2 right-2 flex gap-1 z-10">
                              {/* Finalize Button - Only Author & Not Finalized */}
                              {canDelete(minute) && minute.status !== 'finalized' && (
                                 <button
                                    onClick={(e) => { e.stopPropagation(); handleFinalizeMinute(minute); }}
                                    className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors"
                                    title="Chốt biên bản"
                                 >
                                    <Lock className="h-4 w-4" />
                                 </button>
                              )}

                              {/* Delete Button - Only Author */}
                              {canDelete(minute) && (
                                 <button
                                    onClick={(e) => openDeleteModal(minute, e)}
                                    className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                    title="Xóa tài liệu"
                                 >
                                    <Trash2 className="h-4 w-4" />
                                 </button>
                              )}
                           </div>
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

         {/* Request Revision Modal */}
         {isRejectModalOpen && itemToReject && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
               <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-6">
                     <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Edit3 className="h-8 w-8 text-amber-600" />
                     </div>
                     <h3 className="text-lg font-bold text-gray-900 mb-2 text-center">Yêu cầu sửa lại?</h3>
                     <p className="text-sm text-gray-500 mb-4 text-center">
                        Bạn đang yêu cầu chỉnh sửa cho <span className="font-semibold text-gray-800">"{itemToReject.title}"</span>
                     </p>

                     <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                           Nội dung cần chỉnh sửa <span className="text-red-500">*</span>
                        </label>
                        <textarea
                           className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all resize-none"
                           rows={4}
                           placeholder="Nhập chi tiết các điểm cần sửa..."
                           value={rejectionReason}
                           onChange={(e) => setRejectionReason(e.target.value)}
                        />
                     </div>

                     <div className="flex gap-3 justify-center">
                        <button
                           onClick={() => { setIsRejectModalOpen(false); setItemToReject(null); }}
                           className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                           Hủy bỏ
                        </button>
                        <button
                           onClick={handleRequestRevision}
                           disabled={!rejectionReason.trim()}
                           className="px-4 py-2 text-sm font-bold text-white bg-amber-500 rounded-lg hover:bg-amber-600 shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                           <Send className="h-4 w-4 mr-1 inline" /> Gửi yêu cầu
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         )}


         {/* --- DRAWER / PANEL (Interaction) --- */}
         {
            isDrawerOpen && selectedItem && (
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

                           {/* Edit Button - Only show for Word files and file owner */}
                           {selectedItem && isWordFile(selectedItem) && canEdit(selectedItem) && (
                              <button
                                 onClick={(e) => handleOpenWordEditor(selectedItem, e)}
                                 className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors flex items-center gap-1"
                                 title="Chỉnh sửa file Word"
                              >
                                 <Edit3 className="h-5 w-5" />
                                 <span className="text-xs font-medium hidden md:inline">Chỉnh sửa</span>
                              </button>
                           )}

                           {/* Finalize Button for Minutes in Drawer */}
                           {selectedItem.type === 'minute' && canDelete(selectedItem) && (selectedItem as MeetingMinute).status !== 'finalized' && (
                              <button
                                 onClick={() => handleFinalizeMinute(selectedItem as MeetingMinute)}
                                 className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors flex items-center gap-1"
                                 title="Chốt biên bản"
                              >
                                 <Lock className="h-5 w-5" />
                                 <span className="text-xs font-medium hidden md:inline">Chốt</span>
                              </button>
                           )}
                           <button className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Tải xuống">
                              <Download className="h-5 w-5" />
                           </button>

                           {/* Strict Delete Button - Only Author */}
                           {canDelete(selectedItem) && (
                              <button
                                 onClick={(e) => openDeleteModal(selectedItem, e)}
                                 className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                 title="Xóa tài liệu"
                              >
                                 <Trash2 className="h-5 w-5" />
                              </button>
                           )}
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

                        {/* Right Panel: Revision History */}
                        <div className="w-full md:w-96 bg-gray-50 border-l border-gray-200 flex flex-col h-1/2 md:h-full flex-shrink-0">
                           {/* Meta Info */}
                           <div className="p-4 border-b border-gray-100 bg-white">
                              <div className="flex items-center justify-between mb-2">
                                 <span className="text-xs text-gray-500">Người đăng</span>
                                 <span className="text-xs font-bold text-gray-800">{selectedItem.author || 'Không rõ'}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                 <span className="text-xs text-gray-500">Ngày tải lên</span>
                                 <span className="text-xs font-bold text-gray-800">{new Date(selectedItem.uploadDate || selectedItem.createdAt || Date.now()).toLocaleDateString('vi-VN')}</span>
                              </div>
                           </div>

                           <div className="p-4 bg-white border-b border-gray-100 shadow-sm flex items-center gap-2">
                              <MessageSquare className="h-5 w-5 text-gray-500" />
                              <h3 className="font-bold text-gray-800">Lịch sử Yêu cầu & Phản hồi</h3>
                           </div>

                           {/* List of Revisions */}
                           <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans">

                              {/* Show initial alert if needs revision (Hide if matches last history item) */}
                              {selectedItem.approval?.status === 'needs_revision' &&
                                 selectedItem.approval?.rejectionReason &&
                                 // Check if the latest comment is already showing this request
                                 !(selectedItem.comments?.length &&
                                    selectedItem.comments[selectedItem.comments.length - 1].type === 'request' &&
                                    selectedItem.comments[selectedItem.comments.length - 1].content === selectedItem.approval.rejectionReason) && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 group relative">
                                       <div className="flex justify-between items-start">
                                          <div>
                                             <h4 className="text-xs font-bold text-amber-800 uppercase mb-1 flex items-center gap-1">
                                                <AlertCircle className="h-3 w-3" /> Yêu cầu sửa hiện tại
                                             </h4>
                                             <p className="text-sm text-amber-900">{selectedItem.approval.rejectionReason}</p>
                                          </div>

                                          {/* Helper Actions for Reviewer (Edit/Delete Active Request) */}
                                          {canApprove(selectedItem) && (
                                             <div className="flex gap-1 ml-2">
                                                <button
                                                   onClick={() => handleEditActiveRevision(selectedItem)}
                                                   className="p-1 text-amber-700 hover:bg-amber-100 rounded transition-colors"
                                                   title="Sửa nội dung yêu cầu"
                                                >
                                                   <Edit3 className="h-3 w-3" />
                                                </button>
                                                <button
                                                   onClick={() => handleDeleteActiveRevision(selectedItem)}
                                                   className="p-1 text-amber-700 hover:bg-amber-100 hover:text-red-600 rounded transition-colors"
                                                   title="Hủy bỏ yêu cầu này"
                                                >
                                                   <Trash2 className="h-3 w-3" />
                                                </button>
                                             </div>
                                          )}
                                       </div>
                                    </div>
                                 )}

                              {(!selectedItem.comments || selectedItem.comments.length === 0) ? (
                                 <div className="text-center py-10 text-gray-400">
                                    <div className="bg-gray-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                                       <CheckCircle className="h-6 w-6 text-gray-300" />
                                    </div>
                                    <p className="text-sm">Chưa có lịch sử chỉnh sửa nào.</p>
                                 </div>
                              ) : (
                                 selectedItem.comments.map((comment) => (
                                    <div key={comment.id} className={`flex gap-3 ${comment.type === 'response' ? 'flex-row-reverse' : ''}`}>
                                       <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white shadow-sm
                                          ${comment.type === 'request' ? 'bg-amber-500' : 'bg-blue-500'}
                                       `}>
                                          {comment.userName.charAt(0)}
                                       </div>
                                       <div className={`flex-1 max-w-[85%] space-y-1`}>
                                          <div className={`p-3 rounded-2xl shadow-sm text-sm relative group
                                             ${comment.type === 'request' ? 'bg-amber-50 border border-amber-100 text-gray-800 rounded-tl-none' :
                                                comment.type === 'response' ? 'bg-blue-50 border border-blue-100 text-gray-800 rounded-tr-none' :
                                                   'bg-white border border-gray-200 text-gray-600'}
                                          `}>
                                             <div className="flex justify-between items-start mb-1">
                                                <span className={`text-xs font-bold ${comment.type === 'request' ? 'text-amber-700' : 'text-blue-700'}`}>
                                                   {comment.userName}
                                                   {comment.type === 'request' && <span className="ml-1 text-[10px] bg-amber-200 px-1 rounded text-amber-800">Yêu cầu sửa</span>}
                                                </span>

                                                {/* Edit/Delete Actions */}
                                                {(comment.userId === user?.id) && (
                                                   <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2 bg-white/50 rounded-lg p-0.5 backdrop-blur-sm">
                                                      <button
                                                         onClick={() => startEditingComment(comment)}
                                                         className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-blue-600"
                                                         title="Sửa"
                                                      >
                                                         <Edit3 className="h-3 w-3" />
                                                      </button>
                                                      <button
                                                         onClick={() => handleDeleteComment(comment)}
                                                         className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-red-600"
                                                         title="Xóa"
                                                      >
                                                         <Trash2 className="h-3 w-3" />
                                                      </button>
                                                   </div>
                                                )}
                                             </div>

                                             {/* Content */}
                                             {editingCommentId === comment.id ? (
                                                <div className="mt-2">
                                                   <textarea
                                                      className="w-full text-sm border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                                      value={editingContent}
                                                      onChange={(e) => setEditingContent(e.target.value)}
                                                      rows={2}
                                                   />
                                                   <div className="flex justify-end gap-2 mt-2">
                                                      <button
                                                         onClick={() => setEditingCommentId(null)}
                                                         className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                                                      >Hủy</button>
                                                      <button
                                                         onClick={() => handleEditComment(comment.id, selectedItem)}
                                                         className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                                                      >Lưu</button>
                                                   </div>
                                                </div>
                                             ) : (
                                                <p className="whitespace-pre-wrap">{comment.content}</p>
                                             )}

                                             <p className="text-[10px] text-gray-400 mt-1 text-right">
                                                {new Date(comment.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(comment.timestamp).toLocaleDateString('vi-VN')}
                                                {comment.editedAt && <span className="italic ml-1">(đã sửa)</span>}
                                             </p>
                                          </div>
                                       </div>
                                    </div>
                                 ))
                              )}
                              <div ref={commentsEndRef} />
                           </div>

                           {/* Input Area (Conditional) */}
                           <div className="p-4 bg-white border-t border-gray-200">
                              {selectedItem.approval?.status === 'needs_revision' && canRespond(selectedItem) ? (
                                 /* 1. Show Response Input for Author if Needs Revision */
                                 <form onSubmit={handleResponse} className="flex gap-2 relative">
                                    <input
                                       type="text"
                                       value={newComment}
                                       onChange={(e) => setNewComment(e.target.value)}
                                       placeholder="Nhập phản hồi/giải trình của bạn..."
                                       className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
                                    />
                                    <button
                                       type="submit"
                                       disabled={!newComment.trim()}
                                       className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center"
                                    >
                                       <Send className="h-5 w-5" />
                                    </button>
                                 </form>
                              ) : selectedItem.approval?.status === 'pending' && canApprove(selectedItem) ? (
                                 /* 2. Show Actions for Reviewer if Pending */
                                 <div className="flex gap-2">
                                    <button
                                       onClick={() => handleApprove(selectedItem)}
                                       className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-xl px-4 py-3 font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                                    >
                                       <CheckCircle2 className="h-5 w-5" /> Duyệt ngay
                                    </button>
                                    <button
                                       onClick={() => openRejectModal(selectedItem)}
                                       className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-4 py-3 font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                                    >
                                       <Edit3 className="h-5 w-5" /> Yêu cầu sửa
                                    </button>
                                 </div>
                              ) : (
                                 /* 3. Helper or Disabled State */
                                 <div className="text-center text-xs text-gray-500 bg-gray-50 p-2 rounded-lg border border-dashed border-gray-200">
                                    {selectedItem.approval?.status === 'approved'
                                       ? "Hồ sơ đã được duyệt. Không thể chỉnh sửa thêm."
                                       : !canRespond(selectedItem) && selectedItem.approval?.status === 'needs_revision'
                                          ? "Đang chờ tác giả phản hồi..."
                                          : "Hồ sơ đang chờ xử lý."}
                                 </div>
                              )}
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            )
         }

         {/* --- 4. UPLOAD MODAL (PROFESSIONAL GROUP) --- */}
         {
            isUploadModalOpen && (
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
            )
         }

         {/* --- INTEGRATED FILE VIEWER --- */}
         {
            isFileViewerOpen && selectedItem && (
               <IntegratedFileViewer
                  file={{
                     id: selectedItem.id,
                     name: selectedItem.title,
                     url: (selectedItem as any).url || '',
                     type: (selectedItem as any).fileType,
                     uploader: selectedItem.uploader,
                     uploaderId: (selectedItem as any).uploaderId,
                     uploaderRole: selectedItem.uploaderRole,
                     date: (selectedItem as any).uploadDate,
                     comments: selectedItem.comments || [],
                     commentCount: selectedItem.commentCount || 0,
                     approval: selectedItem.approval,
                     status: selectedItem.approval?.status || 'pending'
                  }}
                  onClose={() => {
                     setIsFileViewerOpen(false);
                     setSelectedItem(null);
                  }}
                  onSaveSuccess={handleFileViewerSaveSuccess}
                  collectionName="plans"
                  storageFolder="plans"
                  canEdit={canEdit(selectedItem)}
                  canApprove={canApprove(selectedItem)}
                  canComment={canComment(selectedItem)}
                  canRespond={canRespond(selectedItem)}
                  onApprove={() => handleApprove(selectedItem)}
                  onRequestRevision={(reason) => {
                     setItemToReject(selectedItem);
                     setRejectionReason(reason);
                     handleRequestRevision();
                  }}
                  onPostComment={(content, type) => {
                     if (type === 'response') {
                        setNewComment(content);
                        handleResponse({ preventDefault: () => { } } as React.FormEvent);
                     }
                  }}
                  canManageComment={canManageComment}
                  onEditComment={async (commentId: string, newContent: string) => {
                     if (!selectedItem || !user) return;
                     try {
                        const collectionRef = selectedItem.type === 'plan' ? 'plans' : 'plans';
                        const docRef = doc(db, collectionRef, selectedItem.id);
                        const currentComments = selectedItem.comments || [];
                        const updatedComments = currentComments.map((c: Comment) =>
                           c.id === commentId
                              ? { ...c, content: newContent, editedAt: new Date().toISOString() }
                              : c
                        );
                        await updateDoc(docRef, { comments: updatedComments });
                        setSelectedItem({
                           ...selectedItem,
                           comments: updatedComments
                        } as any);
                        addToast("Đã cập nhật góp ý", "Nội dung góp ý đã được lưu.", "success");
                     } catch (error) {
                        console.error("Error editing comment:", error);
                        addToast("Lỗi", "Không thể cập nhật góp ý.", "error");
                     }
                  }}
                  onDeleteComment={async (commentId: string) => {
                     if (!selectedItem || !user) return;
                     const commentToDeleteFound = selectedItem.comments?.find((c: Comment) => c.id === commentId);
                     if (!commentToDeleteFound) return;

                     try {
                        const collectionRef = selectedItem.type === 'plan' ? 'plans' : 'plans';
                        const docRef = doc(db, collectionRef, selectedItem.id);
                        const currentComments = selectedItem.comments || [];
                        const updatedComments = currentComments.filter((c: Comment) => c.id !== commentId);

                        const updateData: any = {
                           comments: updatedComments,
                           commentCount: updatedComments.length
                        };

                        // Special Logic: If deleting a 'request', revert status to pending
                        let newApprovalStatus = selectedItem.approval?.status;
                        let newRejectionReason = selectedItem.approval?.rejectionReason;

                        if (commentToDeleteFound.type === 'request') {
                           if (newApprovalStatus === 'needs_revision') {
                              newApprovalStatus = 'pending';
                              newRejectionReason = undefined;
                              updateData['approval.status'] = 'pending';
                              updateData['approval.rejectionReason'] = deleteField();
                              addToast("Đã hoàn tác", "Yêu cầu sửa đã bị xóa. Trạng thái hồ sơ trở về 'Chờ duyệt'.", "info");
                           }
                        }

                        // Special Logic: If deleting a 'response', check if there's still an active request
                        if (commentToDeleteFound.type === 'response') {
                           const hasActiveRequest = updatedComments.some((c: Comment) => c.type === 'request');
                           if (hasActiveRequest && newApprovalStatus === 'pending') {
                              newApprovalStatus = 'needs_revision';
                              updateData['approval.status'] = 'needs_revision';
                              addToast("Đã hoàn tác", "Phản hồi đã bị xóa. Bạn có thể phản hồi lại.", "info");
                           }
                        }

                        await updateDoc(docRef, updateData);

                        setSelectedItem({
                           ...selectedItem,
                           comments: updatedComments,
                           commentCount: updatedComments.length,
                           approval: {
                              ...selectedItem.approval,
                              status: newApprovalStatus,
                              rejectionReason: newRejectionReason
                           }
                        } as any);

                        addToast("Đã xóa góp ý", "Góp ý đã được xóa thành công.", "success");
                     } catch (error) {
                        console.error("Error deleting comment:", error);
                        addToast("Lỗi", "Không thể xóa góp ý.", "error");
                     }
                  }}
               />
            )
         }


         {/* Delete Comment Modal */}
         {isDeleteCommentModalOpen && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
               <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-6 text-center">
                     <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Trash2 className="h-6 w-6 text-red-600" />
                     </div>
                     <h3 className="text-lg font-bold text-gray-900 mb-2">Xóa góp ý?</h3>
                     <p className="text-sm text-gray-500 mb-6">
                        Bạn có chắc chắn muốn xóa góp ý này không? Hành động này không thể hoàn tác.
                     </p>

                     <div className="flex gap-3 justify-center">
                        <button
                           onClick={() => setIsDeleteCommentModalOpen(false)}
                           className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                           Hủy bỏ
                        </button>
                        <button
                           onClick={confirmDeleteComment}
                           className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 shadow-md transition-colors"
                        >
                           Xóa góp ý
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         )}

         {/* Delete Active Revision Modal (Custom Toast-like Dialog) */}
         {isDeleteRevisionModalOpen && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
               <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-6 text-center">
                     <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="h-6 w-6 text-amber-600" />
                     </div>
                     <h3 className="text-lg font-bold text-gray-900 mb-2">Hủy yêu cầu sửa?</h3>
                     <p className="text-sm text-gray-500 mb-6">
                        Bạn có chắc chắn muốn xóa yêu cầu sửa này? <br />
                        Hồ sơ sẽ quay về trạng thái <span className="font-bold text-blue-600">'Chờ duyệt'</span>.
                     </p>

                     <div className="flex gap-3 justify-center">
                        <button
                           onClick={() => setIsDeleteRevisionModalOpen(false)}
                           className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                           Không xóa
                        </button>
                        <button
                           onClick={confirmDeleteActiveRevision}
                           className="px-4 py-2 text-sm font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700 shadow-md transition-colors"
                        >
                           Đồng ý xóa
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         )}
      </div >
   );
};

export default ProfessionalGroupPlans;