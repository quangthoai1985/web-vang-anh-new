import React, { useRef, useEffect, useState } from 'react';
import { X, Loader2, PenLine, FileText, Download, MessageSquare, CheckCircle, AlertCircle, Send, User, Clock, Edit3, Trash2, ExternalLink } from 'lucide-react';
import { storage, db } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Comment } from '../types';

interface FileData {
    id: string;
    name: string;
    url: string;
    type?: string;
    uploader?: string;
    uploaderId?: string;
    uploaderRole?: string;
    date?: string;
    comments?: Comment[];
    commentCount?: number;
    approval?: {
        status: 'pending' | 'approved' | 'needs_revision';
        reviewerId?: string;
        reviewerName?: string;
        reviewedAt?: string;
        rejectionReason?: string;
    };
}

interface IntegratedFileViewerProps {
    file: FileData;
    onClose: () => void;
    onSaveSuccess?: (newUrl: string) => void;
    onFileUpdate?: (updatedFile: FileData) => void;
    collectionName: string;
    storageFolder?: string;
    // Permission flags
    canEdit?: boolean;
    canApprove?: boolean;
    canComment?: boolean;
    canRespond?: boolean;
    // Actions
    onApprove?: () => void;
    onRequestRevision?: (reason: string) => void;
    onPostComment?: (content: string, type: 'comment' | 'response') => void;
}

const IntegratedFileViewer: React.FC<IntegratedFileViewerProps> = ({
    file,
    onClose,
    onSaveSuccess,
    onFileUpdate,
    collectionName,
    storageFolder = 'files',
    canEdit = false,
    canApprove = false,
    canComment = false,
    canRespond = false,
    onApprove,
    onRequestRevision,
    onPostComment,
}) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [localFileUrl, setLocalFileUrl] = useState<string | null>(null);
    const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
    const [showSignaturePanel, setShowSignaturePanel] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [newComment, setNewComment] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [loadError, setLoadError] = useState<string | null>(null);
    const { user } = useAuth();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    // Use a ref to keep the timestamp stable across re-renders (like toast updates)
    const timestampRef = useRef(Date.now());

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Determine file type for correct editor mode
    const getFileExtension = (): string => {
        if (file.type) return file.type.toLowerCase();
        const ext = file.url?.split('.').pop()?.split('?')[0]?.toLowerCase() || '';
        return ext;
    };

    const getEditorFilename = (): string => {
        const ext = getFileExtension();
        const baseName = file.name.replace(/\.[^/.]+$/, '');
        if (['xlsx', 'xls', 'csv'].includes(ext)) return `${baseName}.xlsx`;
        if (['pptx', 'ppt'].includes(ext)) return `${baseName}.pptx`;
        if (ext === 'pdf') return `${baseName}.pdf`;
        return `${baseName}.docx`;
    };

    const isEditable = (): boolean => {
        const ext = getFileExtension();
        // PDF is view-only, others are editable
        return !['pdf'].includes(ext);
    };




    // Use direct file URL for the editor
    // We avoid fetching as Blob because:
    // 1. It duplicates memory usage (Browser logic + WASM logic)
    // 2. OnlyOffice/x2t WASM handles fetching internally
    // 3. Reduces chance of out-of-memory errors for large files
    // File loading is handled by the iframe/viewer itself.
    // We just need to ensure file.url exists.
    useEffect(() => {
        if (file.url) {
            setLocalFileUrl(file.url);
            setLoadError(null);
            // Loading indicator will be hidden by iframe onLoad
        }
    }, [file.url]);


    // Handle save from editor
    useEffect(() => {
        const handleMessage = async (event: MessageEvent) => {
            if (event.data.type === 'FILE_SAVED' && event.data.base64) {
                await handleUpload(event.data.base64);
            }
            if (event.data.type === 'FILE_LOAD_ERROR') {
                console.error("File load error from iframe:", event.data);
                const errorMsg = event.data.code === '88'
                    ? 'Tài liệu có định dạng phức tạp hoặc quá lớn, không thể xem trước trực tiếp.'
                    : `Lỗi tải tài liệu: ${event.data.message}`;
                setLoadError(errorMsg);
                setIsLoading(false);
            }
            if (event.data.type === 'SAVE_NOT_ALLOWED') {
                showToast(event.data.message || 'Bạn không phải là tác giả của file, vui lòng liên hệ tác giả để yêu cầu chỉnh sửa.', 'error');
            }
            if (event.data.type === 'SAVE_ERROR') {
                console.error('Save error from editor:', event.data.message);
                // Suppress "code: 88" error as requested by user (it's often a false positive alongside success)
                if (event.data.message && (event.data.message.includes('code: 88') || event.data.message.includes('code 88'))) {
                    console.log('Ignored error code 88 toast');
                } else {
                    showToast('Lỗi khi lưu: ' + (event.data.message || 'Unknown error'), 'error');
                }
                setIsSaving(false);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [file, storageFolder, collectionName]);

    const handleUpload = async (base64Data: string) => {
        if (!canEdit) return;
        setIsSaving(true);
        try {
            const byteString = atob(base64Data.split(',')[1]);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            const ext = getFileExtension();
            let mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            if (['xlsx', 'xls'].includes(ext)) mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            if (['pptx', 'ppt'].includes(ext)) mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

            const blob = new Blob([ab], { type: mimeType });
            const timestamp = Date.now();
            const safeName = file.name.replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = `${storageFolder}/${timestamp}_${safeName}.${ext === 'docx' || ext === 'doc' ? 'docx' : ext}`;
            const storageRefNew = ref(storage, fileName);

            await uploadBytes(storageRefNew, blob, { contentType: mimeType });
            const newDownloadUrl = await getDownloadURL(storageRefNew);

            const docRef = doc(db, collectionName, file.id);
            await updateDoc(docRef, {
                url: newDownloadUrl,
                lastModified: new Date().toISOString()
            });

            onSaveSuccess?.(newDownloadUrl);
            showToast('Đã lưu thành công!', 'success');
        } catch (error: any) {
            console.error('Error saving:', error);
            showToast('Lỗi khi lưu: ' + error.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSubmitComment = () => {
        if (!newComment.trim()) return;
        const type = canComment ? 'comment' : 'response';
        onPostComment?.(newComment.trim(), type);
        setNewComment('');
    };

    const handleApproveClick = () => {
        onApprove?.();
    };

    const handleRejectClick = () => {
        setShowRejectModal(true);
    };

    const handleSubmitReject = () => {
        if (!rejectReason.trim()) return;
        onRequestRevision?.(rejectReason.trim());
        setShowRejectModal(false);
        setRejectReason('');
    };

    const getApprovalBadge = () => {
        if (!file.approval) return null;
        const status = file.approval.status;
        if (status === 'approved') {
            return <span className="px-2 py-1 text-xs font-bold rounded-full bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Đã duyệt</span>;
        }
        if (status === 'needs_revision') {
            return <span className="px-2 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-700 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Cần sửa</span>;
        }
        return <span className="px-2 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-700">Chờ duyệt</span>;
    };

    return (
        <div className="fixed inset-0 z-[70] flex bg-gray-900">
            {/* Main Content Area - Editor */}
            <div className="flex-1 flex flex-col bg-white">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <FileText className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-base line-clamp-1">{file.name}</h2>
                            <p className="text-xs text-blue-100 opacity-80">
                                {isEditable() ? 'Chỉnh sửa trực tiếp' : 'Chỉ xem'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">


                        <div className="text-xs bg-blue-800 px-2 py-1 rounded text-blue-200">
                            {isSaving ? 'Đang lưu...' : 'Tự động lưu khi Save'}
                        </div>

                        <a
                            href={file.url}
                            download={file.name}
                            className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
                            title="Tải xuống"
                        >
                            <Download className="h-5 w-5" />
                        </a>

                        <button onClick={onClose} className="p-2 hover:bg-blue-500 rounded-full transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Editor iframe */}
                <div className="flex-1 relative bg-gray-100">
                    {loadError ? (
                        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                                <AlertCircle className="h-8 w-8 text-red-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Không thể xem trước tài liệu</h3>
                            <p className="text-gray-600 max-w-md mb-6">{loadError}</p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <a
                                    href={file.url}
                                    download={file.name}
                                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg hover:shadow-xl"
                                >
                                    <Download className="h-5 w-5" />
                                    Tải xuống
                                </a>
                                <a
                                    href={`https://docs.google.com/viewer?url=${encodeURIComponent(file.url)}&embedded=true`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-6 py-3 bg-white text-gray-700 border border-gray-300 font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors shadow-lg hover:shadow-xl"
                                >
                                    <ExternalLink className="h-5 w-5" />
                                    Xem bằng Google Viewer
                                </a>
                            </div>
                        </div>
                    ) : (
                        <>
                            {file.url && (
                                /* Use Ranuts X2T for all users - canSave controls save permission */
                                <iframe
                                    ref={iframeRef}
                                    src={`/office/index.html?t=${timestampRef.current}&src=${encodeURIComponent(file.url)}&filename=${encodeURIComponent(getEditorFilename())}&locale=en&mode=edit&canSave=${canEdit && isEditable() ? 'true' : 'false'}`}
                                    className="w-full h-full border-none"
                                    title="Document Editor"
                                    onLoad={() => setIsLoading(false)}
                                />
                            )}
                            {isLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                                    <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                                    <span className="ml-3 text-gray-600">Đang tải tài liệu...</span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Right Sidebar - Metadata & Comments */}
            <div className="w-80 bg-white border-l border-gray-200 flex flex-col flex-shrink-0">
                {/* File Info */}
                <div className="p-4 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-gray-800 text-sm">Thông tin file</h3>
                        {getApprovalBadge()}
                    </div>
                    <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="font-medium">{file.uploader || 'Không rõ'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <span>{file.date ? new Date(file.date).toLocaleDateString('vi-VN') : 'Không rõ'}</span>
                        </div>
                    </div>
                </div>

                {/* Approval Actions */}
                {canApprove && file.approval?.status !== 'approved' && (
                    <div className="p-4 border-b border-gray-100 bg-blue-50 flex gap-2">
                        <button
                            onClick={handleApproveClick}
                            className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-1 transition-colors"
                        >
                            <CheckCircle className="h-4 w-4" /> Duyệt
                        </button>
                        <button
                            onClick={handleRejectClick}
                            className="flex-1 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-1 transition-colors"
                        >
                            <AlertCircle className="h-4 w-4" /> Yêu cầu sửa
                        </button>
                    </div>
                )}

                {/* Comments Section */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-3 bg-white border-b border-gray-100 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-gray-500" />
                        <h4 className="font-bold text-gray-800 text-sm">Lịch sử trao đổi</h4>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {(file.comments || []).length === 0 ? (
                            <p className="text-sm text-gray-400 italic text-center py-4">Chưa có trao đổi nào</p>
                        ) : (
                            (file.comments || []).map((c: Comment) => (
                                <div key={c.id} className={`flex gap-2 ${c.type === 'response' ? 'flex-row-reverse' : ''}`}>
                                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white
                                        ${c.type === 'request' ? 'bg-amber-500' : c.type === 'response' ? 'bg-blue-500' : 'bg-gray-400'}`}>
                                        {c.userName?.charAt(0) || 'U'}
                                    </div>
                                    <div className={`flex-1 p-2 rounded-lg text-sm ${c.type === 'response' ? 'bg-blue-50' : 'bg-gray-100'}`}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-semibold text-gray-700 text-xs">{c.userName}</span>
                                            <span className="text-[10px] text-gray-400">{new Date(c.timestamp).toLocaleDateString('vi-VN')}</span>
                                        </div>
                                        <p className="text-gray-600">{c.content}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Comment Input */}
                    {(canComment || canRespond) && (
                        <div className="p-3 border-t border-gray-100 bg-gray-50">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder={canComment ? "Nhập góp ý..." : "Nhập phản hồi..."}
                                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment()}
                                />
                                <button
                                    onClick={handleSubmitComment}
                                    disabled={!newComment.trim()}
                                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Send className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>



            {/* Reject Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-96 max-w-[90vw]">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Yêu cầu sửa lại</h3>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Nhập lý do yêu cầu sửa..."
                            className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none h-24 text-gray-800"
                        />
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => { setShowRejectModal(false); setRejectReason(''); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">
                                Hủy
                            </button>
                            <button onClick={handleSubmitReject} disabled={!rejectReason.trim()} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold disabled:opacity-50">
                                Gửi yêu cầu
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-lg shadow-lg text-white font-medium flex items-center gap-2
                    ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>
                    {toast.type === 'success' && <span>✨</span>}
                    {toast.type === 'error' && <span>⚠️</span>}
                    {toast.message}
                </div>
            )}
        </div>
    );
};

export default IntegratedFileViewer;
