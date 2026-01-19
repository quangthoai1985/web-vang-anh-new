import React, { useState, useMemo, useEffect } from 'react';
import useMobile from '../hooks/useMobile';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  FileText,
  Download,
  Edit,
  Trash2,
  ArrowLeft,
  Calendar,
  Building2,
  X,
  Upload,
  CheckCircle,
  AlertCircle,
  Share2,
  Info,
  Paperclip,
  ExternalLink,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { DirectiveDocument } from '../types';

import { db, storage } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useNotification } from '../context/NotificationContext';
import { useSchoolYear } from '../context/SchoolYearContext';
import { useAuth } from '../context/AuthContext';
import { getPreviewUrl } from '../utils/fileUtils';

// --- Components ---

const Badge = ({ children, colorClass }: { children?: React.ReactNode, colorClass: string }) => (
  <span className={`px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-medium uppercase tracking-wide ${colorClass}`}>
    {children}
  </span>
);

// --- Main Page Component ---

const SchoolDocuments: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useNotification();
  const { currentSchoolYear } = useSchoolYear();

  // State
  const [documents, setDocuments] = useState<DirectiveDocument[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string>('Tất cả');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const { user } = useAuth();
  const isMobile = useMobile();
  // Only users with explicit 'manage_documents' permission can manage
  const canManageDocuments = user?.permissions?.includes('manage_documents');

  // Modal States
  const [selectedDoc, setSelectedDoc] = useState<DirectiveDocument | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [viewMobileTab, setViewMobileTab] = useState<'preview' | 'info'>('preview');

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<DirectiveDocument | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<DirectiveDocument>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');

  // Fetch Documents
  useEffect(() => {
    const q = query(collection(db, 'school_documents'), orderBy('ngayBanHanh', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docsData: DirectiveDocument[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // School Year Check - Logic from original file
        const itemYear = data.schoolYear || '2025-2026';
        if (itemYear !== currentSchoolYear) return;

        docsData.push({ id: doc.id, ...data } as DirectiveDocument);
      });
      setDocuments(docsData);
    });
    return () => unsubscribe();
  }, [currentSchoolYear]);

  // Filter Logic
  const filteredDocs = useMemo(() => {
    let result = documents.filter(doc => {
      const matchesSearch =
        doc.trichYeu.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.soKyHieu.toLowerCase().includes(searchTerm.toLowerCase());

      // Filter by Document Type (Loại văn bản) for School Documents
      const matchesTab = activeTab === 'Tất cả' || doc.loaiVanBan === activeTab;

      return matchesSearch && matchesTab;
    });

    // Sorting
    result.sort((a, b) => {
      const dateA = new Date(a.ngayBanHanh).getTime();
      const dateB = new Date(b.ngayBanHanh).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [documents, searchTerm, activeTab, sortOrder]);

  // Handlers
  const openDeleteModal = (doc: DirectiveDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    setDocToDelete(doc);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (docToDelete) {
      try {
        await deleteDoc(doc(db, 'school_documents', docToDelete.id));
        addToast("Đã xóa tài liệu thành công", "Dữ liệu đã được cập nhật.", "success");
      } catch (error) {
        console.error("Error deleting document:", error);
        addToast("Lỗi xóa tài liệu", "Không thể xóa tài liệu này.", "error");
      }
      setIsDeleteModalOpen(false);
      setDocToDelete(null);
    }
  };

  const handleOpenView = (doc: DirectiveDocument) => {
    setSelectedDoc(doc);
    setViewMobileTab('preview');
    setIsViewModalOpen(true);
  };

  const handleOpenAdd = () => {
    setFormData({
      trichYeu: '',
      soKyHieu: '',
      coQuanBanHanh: 'Ban Giám Hiệu',
      ngayBanHanh: new Date().toISOString().split('T')[0],
      loaiVanBan: 'Kế hoạch',
      tomTatNoiDung: ''
    });
    setSelectedFile(null);
    setSelectedFileName('');
    setIsEditMode(false);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (doc: DirectiveDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormData({ ...doc });
    setIsEditMode(true);
    setSelectedFile(null);
    setSelectedFileName(doc.fileDinhKemUrl ? 'Van_ban_dinh_kem.pdf' : '');
    setIsFormModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setSelectedFileName(file.name);
    }
  };

  const handleDownload = (doc: DirectiveDocument) => {
    if (doc.fileDinhKemUrl && doc.fileDinhKemUrl !== '#') {
      window.open(doc.fileDinhKemUrl, '_blank');
    } else {
      addToast("Không có file", "Văn bản này không có file đính kèm.", "warning");
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setSelectedFileName('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.trichYeu || !formData.soKyHieu) return;

    try {
      let fileUrl = formData.fileDinhKemUrl || '#';

      if (selectedFile) {
        const storageRef = ref(storage, `school_documents/${Date.now()}_${selectedFile.name}`);
        const snapshot = await uploadBytes(storageRef, selectedFile);
        fileUrl = await getDownloadURL(snapshot.ref);
      } else if (!selectedFileName && !formData.fileDinhKemUrl) {
        fileUrl = '#';
      }

      const saveDocData = {
        ...formData,
        fileDinhKemUrl: fileUrl,
        schoolYear: currentSchoolYear, // Add current school year
        ...(isEditMode ? {} : { createdAt: new Date().toISOString() })
      };

      if (isEditMode && formData.id) {
        await updateDoc(doc(db, 'school_documents', formData.id), saveDocData);
        addToast("Cập nhật thành công", "Thông tin văn bản đã được lưu.", "success");
      } else {
        await addDoc(collection(db, 'school_documents'), saveDocData);
        addToast("Thêm mới thành công", "Văn bản đã được thêm vào hệ thống.", "success");
      }
      setIsFormModalOpen(false);
    } catch (error) {
      console.error("Error saving document:", error);
      addToast("Lỗi lưu dữ liệu", "Không thể lưu văn bản này.", "error");
    }
  };

  // Render Helpers
  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'Kế hoạch': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'Quyết định': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'Thông báo': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'Báo cáo': return 'bg-purple-50 text-purple-600 border-purple-100';
      default: return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  const getDocTypeIcon = (type: string) => {
    switch (type) {
      case 'Quyết định': return <CheckCircle className="h-5 w-5 text-emerald-500" />;
      case 'Kế hoạch': return <Calendar className="h-5 w-5 text-amber-500" />;
      case 'Thông báo': return <AlertCircle className="h-5 w-5 text-blue-500" />;
      default: return <FileText className="h-5 w-5 text-emerald-500" />;
    }
  };

  const getSoHieuBadge = (doc: DirectiveDocument) => {
    // Generate a consistent color based on the ID or SoKyHieu
    const colors = [
      'bg-blue-100 text-blue-700 border-blue-200',
      'bg-indigo-100 text-indigo-700 border-indigo-200',
      'bg-purple-100 text-purple-700 border-purple-200',
      'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
      'bg-pink-100 text-pink-700 border-pink-200',
      'bg-rose-100 text-rose-700 border-rose-200',
      'bg-orange-100 text-orange-700 border-orange-200',
      'bg-amber-100 text-amber-700 border-amber-200',
      'bg-emerald-100 text-emerald-700 border-emerald-200',
      'bg-teal-100 text-teal-700 border-teal-200',
      'bg-cyan-100 text-cyan-700 border-cyan-200',
      'bg-sky-100 text-sky-700 border-sky-200',
    ];

    // Simple hash function to pick a color
    const hash = doc.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colorClass = colors[hash % colors.length];

    return (
      <span className={`${colorClass} text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider shadow-sm border`}>
        {doc.soKyHieu}
      </span>
    );
  };

  // Tabs for School Documents
  const tabs = ['Tất cả', 'Kế hoạch', 'Quyết định', 'Thông báo', 'Báo cáo', 'Văn bản khác'];

  return (
    <div className="min-h-screen bg-[#F8FAFC] animate-in fade-in duration-500 pb-20">

      {/* --- Top Navigation Bar --- */}
      <div className="bg-white sticky top-0 z-30 border-b border-gray-200 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between h-auto md:h-16 py-3 md:py-0 gap-3">

            {/* Left: Brand & Mobile Menu */}
            <div className="flex items-center gap-3">
              {!isMobile && (
                <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}
              <div className="flex items-center gap-2">
                <div className="bg-emerald-600 p-1.5 rounded-lg text-white shadow-md shadow-emerald-200">
                  <Building2 className="h-5 w-5" />
                </div>
                <h1 className="text-lg md:text-xl font-bold text-gray-900 tracking-tight">VĂN BẢN CỦA TRƯỜNG</h1>
              </div>
            </div>

            {/* Center: Search Bar */}
            <div className="flex-1 max-w-2xl px-0 md:px-8 w-full">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl leading-5 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 sm:text-sm transition-all shadow-sm group-focus-within:shadow-md"
                  placeholder="Tìm kiếm văn bản, kế hoạch, quyết định..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center justify-between md:justify-end w-full md:w-auto mt-2 md:mt-0 gap-3">
              <div className="flex items-center gap-2 no-scrollbar overflow-x-auto w-full md:w-auto">
                {/* Quick Filters as Pills */}
                {tabs.map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === tab ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {canManageDocuments && (
                <button
                  onClick={handleOpenAdd}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200 active:scale-95 flex-shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm font-semibold">{isMobile ? 'Thêm' : 'Thêm văn bản'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- Main Content: Grid Layout --- */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">Văn bản - {currentSchoolYear}</h2>
          <div
            className="flex items-center text-sm text-gray-500 cursor-pointer hover:text-emerald-600 transition-colors select-none"
            onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
          >
            Sắp xếp theo:
            <span className="font-semibold text-emerald-600 ml-1 flex items-center gap-1">
              {sortOrder === 'newest' ? 'Mới nhất' : 'Cũ nhất'}
              {sortOrder === 'newest' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
            </span>
          </div>
        </div>

        {filteredDocs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                onClick={() => handleOpenView(doc)}
                className="group bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer relative overflow-hidden flex flex-col h-full"
              >
                {/* Decoration Gradient */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-50 to-white rounded-bl-[100px] -z-0 opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

                {/* Card Header */}
                <div className="flex items-start justify-between mb-4 relative z-10">
                  <div className={`p-2.5 rounded-xl ${doc.fileDinhKemUrl && doc.fileDinhKemUrl.endsWith('.pdf') ? 'bg-red-50' : 'bg-emerald-50'}`}>
                    {getDocTypeIcon(doc.loaiVanBan)}
                  </div>
                  {getSoHieuBadge(doc)}
                </div>

                {/* Card Body */}
                <div className="flex-1 relative z-10">
                  <h3 className="text-base font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-emerald-600 transition-colors" title={doc.trichYeu}>
                    {doc.trichYeu}
                  </h3>
                  <p className="text-xs text-gray-500 mb-4 line-clamp-3 leading-relaxed">
                    {doc.tomTatNoiDung || "Chưa có tóm tắt nội dung. Bấm xem chi tiết."}
                  </p>
                </div>

                {/* Footer Tags & Meta */}
                <div className="mt-4 pt-4 border-t border-gray-50 relative z-10">
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className={`text-[10px] px-2 py-1 rounded-md font-medium ${getTypeBadgeColor(doc.loaiVanBan)}`}>
                      #{doc.loaiVanBan}
                    </span>
                    <span className="text-[10px] px-2 py-1 rounded-md font-medium bg-gray-100 text-gray-600">
                      #{doc.coQuanBanHanh}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(doc.ngayBanHanh).toLocaleDateString('vi-VN')}
                    </div>

                    {canManageDocuments && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <button onClick={(e) => handleOpenEdit(doc, e)} className="p-1.5 hover:bg-amber-50 text-gray-400 hover:text-amber-600 rounded">
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={(e) => openDeleteModal(doc, e)} className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
            <div className="bg-emerald-50 p-4 rounded-full mb-4">
              <FileText className="h-8 w-8 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Không tìm thấy tài liệu nào</h3>
            <p className="text-gray-500 text-sm">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
          </div>
        )}
      </div>

      {/* --- NEW Full Screen View Modal --- */}
      {isViewModalOpen && selectedDoc && (
        <div className="fixed inset-0 z-[100] bg-gray-900 flex flex-col animate-in slide-in-from-bottom-5 duration-300">

          {/* 1. Modal Header (Dark Theme) */}
          <div className="h-14 bg-[#1A1A1A] border-b border-gray-800 flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
            <div className="flex items-center gap-4 overflow-hidden">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex flex-col overflow-hidden">
                <h3 className="text-sm md:text-base font-semibold text-white truncate max-w-xs md:max-w-md lg:max-w-xl">
                  {selectedDoc.trichYeu}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownload(selectedDoc)}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs md:text-sm font-medium rounded-lg transition-colors"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Tải xuống</span>
              </button>
            </div>
          </div>

          {/* 2. Modal Body - Split View */}
          <div className="flex-1 flex overflow-hidden relative">

            {/* Left Column: Preview (Interactive) */}
            <div className={`flex-1 bg-[#2C2C2C] relative flex flex-col transition-all duration-300 ${isMobile && viewMobileTab === 'info' ? 'hidden' : 'flex'}`}>
              {/* Minimal Toolbar */}
              <div className="h-8 bg-[#2C2C2C] border-b border-white/5 flex items-center justify-between px-4">
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Xem trước
                </span>
                {selectedDoc.fileDinhKemUrl && selectedDoc.fileDinhKemUrl !== '#' && (
                  <button
                    onClick={() => window.open(selectedDoc.fileDinhKemUrl, '_blank')}
                    className="text-[10px] text-gray-500 hover:text-gray-300 hover:underline flex items-center gap-1 transition-colors"
                  >
                    Mở tab mới <ExternalLink className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Full Iframe Container */}
              <div className="flex-1 w-full h-full bg-white relative overflow-hidden">
                {selectedDoc.fileDinhKemUrl && selectedDoc.fileDinhKemUrl !== '#' ? (
                  <iframe
                    src={getPreviewUrl(selectedDoc.fileDinhKemUrl, isMobile)}
                    className="w-full h-full border-0 block"
                    title="Preview"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <div className="bg-white/5 p-6 rounded-full mb-4">
                      <FileText className="h-12 w-12 text-gray-300" />
                    </div>
                    <p className="text-gray-400">Không có bản xem trước</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Info Sidebar */}
            <div className={`w-full md:w-[320px] lg:w-[360px] bg-white border-l border-gray-200 flex flex-col h-full overflow-y-auto ${isMobile ? (viewMobileTab === 'info' ? 'block' : 'hidden') : 'block'}`}>

              {/* Simplified Sidebar Header */}
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-center gap-1.5 text-gray-400 font-medium text-[10px] uppercase tracking-wider mb-3">
                  <Info className="h-3.5 w-3.5" /> Thông tin văn bản
                </div>
                <h2 className="text-base font-bold text-gray-900 leading-snug mb-3">
                  {selectedDoc.trichYeu}
                </h2>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">
                    {selectedDoc.coQuanBanHanh.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{selectedDoc.coQuanBanHanh}</p>
                    <p className="text-xs text-gray-500">{new Date(selectedDoc.ngayBanHanh).toLocaleDateString('vi-VN')}</p>
                  </div>
                </div>
              </div>

              {/* Sidebar Content */}
              <div className="p-5 space-y-6">

                {/* Classification Tags */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Phân loại</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-gray-100 text-gray-700 text-xs">
                      <Paperclip className="h-3 w-3" />
                      {selectedDoc.loaiVanBan}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 text-xs">
                      <Building2 className="h-3 w-3" />
                      {selectedDoc.coQuanBanHanh}
                    </span>
                  </div>
                </div>

                {/* Original Metadata */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <p className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Số ký hiệu</p>
                    <p className="text-sm font-mono font-medium text-gray-900 truncate" title={selectedDoc.soKyHieu}>{selectedDoc.soKyHieu}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <p className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Ngày ban hành</p>
                    <p className="text-sm font-medium text-gray-900">{new Date(selectedDoc.ngayBanHanh).toLocaleDateString('vi-VN')}</p>
                  </div>
                </div>

                {/* Content Summary */}
                {selectedDoc.tomTatNoiDung && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tóm tắt nội dung</p>
                    <div className="text-sm text-gray-700 leading-relaxed bg-yellow-50/50 p-3 rounded-lg border border-yellow-100">
                      {selectedDoc.tomTatNoiDung}
                    </div>
                  </div>
                )}

              </div>

              {/* Footer Actions in Sidebar */}
              <div className="mt-auto p-4 border-t border-gray-100 bg-gray-50">
                <button
                  onClick={() => handleDownload(selectedDoc)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:border-emerald-400 text-gray-700 hover:text-emerald-600 rounded-lg shadow-sm transition-all text-sm font-medium"
                >
                  <Download className="h-4 w-4" /> Tải về máy
                </button>
              </div>

            </div>

            {/* Mobile Bottom Tab Bar */}
            {isMobile && (
              <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex text-xs font-medium safe-area-inset-bottom z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <button
                  onClick={() => setViewMobileTab('preview')}
                  className={`flex-1 py-3 flex flex-col items-center justify-center gap-1 ${viewMobileTab === 'preview' ? 'text-emerald-600 bg-emerald-50/50' : 'text-gray-500'}`}
                >
                  <FileText className="h-5 w-5" />
                  <span>Văn bản</span>
                </button>
                <button
                  onClick={() => setViewMobileTab('info')}
                  className={`flex-1 py-3 flex flex-col items-center justify-center gap-1 ${viewMobileTab === 'info' ? 'text-emerald-600 bg-emerald-50/50' : 'text-gray-500'}`}
                >
                  <Info className="h-5 w-5" />
                  <span>Thông tin</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- ADD/EDIT MODAL --- */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gray-900 px-6 py-4 flex justify-between items-center text-white">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                {isEditMode ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                {isEditMode ? 'Cập nhật văn bản' : 'Thêm văn bản mới'}
              </h3>
              <button onClick={() => setIsFormModalOpen(false)} className="text-gray-400 hover:text-white"><X className="h-6 w-6" /></button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">
              <form id="documentForm" onSubmit={handleSave} className="space-y-5">
                {/* Form Fields... */}
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700">Trích yếu văn bản <span className="text-red-500">*</span></label>
                  <textarea
                    required rows={3}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                    placeholder="Nhập nội dung trích yếu..."
                    value={formData.trichYeu || ''}
                    onChange={e => setFormData({ ...formData, trichYeu: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-700">Số / Ký hiệu <span className="text-red-500">*</span></label>
                    <input type="text" required
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                      value={formData.soKyHieu || ''}
                      onChange={e => setFormData({ ...formData, soKyHieu: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-700">Ngày ban hành <span className="text-red-500">*</span></label>
                    <input type="date" required
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                      value={formData.ngayBanHanh || ''}
                      onChange={e => setFormData({ ...formData, ngayBanHanh: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-700">Cơ quan ban hành</label>
                    <select
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm bg-white"
                      value={formData.coQuanBanHanh || 'Ban Giám Hiệu'}
                      onChange={e => setFormData({ ...formData, coQuanBanHanh: e.target.value as any })}
                    >
                      {['Ban Giám Hiệu', 'Hiệu Trưởng', 'Tổ Chuyên Môn', 'Tổ Văn Phòng', 'Hội đồng TĐKT', 'Khác'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-700">Loại văn bản</label>
                    <select
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm bg-white"
                      value={formData.loaiVanBan || 'Kế hoạch'}
                      onChange={e => setFormData({ ...formData, loaiVanBan: e.target.value as any })}
                    >
                      {['Kế hoạch', 'Quyết định', 'Thông báo', 'Báo cáo', 'Văn bản khác'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700">Tóm tắt nội dung</label>
                  <textarea rows={4}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                    placeholder="Tóm tắt ngắn gọn nội dung văn bản..."
                    value={formData.tomTatNoiDung || ''}
                    onChange={e => setFormData({ ...formData, tomTatNoiDung: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">File đính kèm</label>
                  {selectedFileName ? (
                    <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="bg-white p-2 rounded-lg text-emerald-600"><FileText className="h-5 w-5" /></div>
                        <span className="text-sm font-medium text-emerald-900 truncate max-w-[200px]">{selectedFileName}</span>
                      </div>
                      <button type="button" onClick={removeSelectedFile} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center hover:bg-gray-50 hover:border-emerald-400 transition-all cursor-pointer relative group">
                      <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileChange} accept=".pdf,.doc,.docx" />
                      <Upload className="h-8 w-8 text-gray-400 group-hover:text-emerald-500 mb-2 transition-colors" />
                      <p className="text-sm text-gray-500 group-hover:text-emerald-600 font-medium">Bấm để chọn file hoặc kéo thả</p>
                      <p className="text-xs text-gray-400 mt-1">Hỗ trợ PDF, DOCX (Max 10MB)</p>
                    </div>
                  )}
                </div>
              </form>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setIsFormModalOpen(false)} className="px-5 py-2.5 rounded-xl text-gray-600 hover:bg-gray-200 font-medium text-sm transition-colors">Hủy bỏ</button>
              <button type="submit" form="documentForm" className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-200 transition-all transform active:scale-95">
                {isEditMode ? 'Lưu thay đổi' : 'Tạo văn bản'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DELETE ALERT --- */}
      {isDeleteModalOpen && docToDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Xóa văn bản này?</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Bạn có chắc chắn muốn xóa văn bản <strong>"{docToDelete.trichYeu}"</strong>? Hành động này không thể hoàn tác.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">Hủy</button>
              <button onClick={confirmDelete} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold shadow-md hover:bg-red-700">Xóa ngay</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SchoolDocuments;