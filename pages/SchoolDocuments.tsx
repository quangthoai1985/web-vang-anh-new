import React, { useState, useMemo } from 'react';
import useMobile from '../hooks/useMobile';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  FileText,
  Download,
  Eye,
  Edit,
  Trash2,
  ArrowLeft,
  Calendar,
  Building2,
  X,
  Save,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Upload,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { DirectiveDocument, UserRole } from '../types';

import { db, storage } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useNotification } from '../context/NotificationContext';
import { useSchoolYear } from '../context/SchoolYearContext';
import { useAuth } from '../context/AuthContext';
import { getPreviewUrl } from '../utils/fileUtils';

const Badge = ({ children, colorClass }: { children?: React.ReactNode, colorClass: string }) => (
  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
    {children}
  </span>
);

const SchoolDocuments: React.FC = () => {
  const navigate = useNavigate();
  const { currentSchoolYear } = useSchoolYear();
  const { addToast } = useNotification();

  // State
  const [documents, setDocuments] = useState<DirectiveDocument[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string>('Tất cả');
  const { user } = useAuth();
  const isMobile = useMobile();
  // Only users with explicit 'manage_documents' permission can manage
  const canManageDocuments = user?.permissions?.includes('manage_documents');

  // Modal States
  const [selectedDoc, setSelectedDoc] = useState<DirectiveDocument | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<DirectiveDocument | null>(null);

  // Preview Zoom State
  const [previewZoom, setPreviewZoom] = useState(1.0);

  // Form State
  const [formData, setFormData] = useState<Partial<DirectiveDocument>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');

  // Fetch Documents
  React.useEffect(() => {
    const q = query(collection(db, 'school_documents'), orderBy('ngayBanHanh', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docsData: DirectiveDocument[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // School Year Check
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
    return documents.filter(doc => {
      const matchesSearch =
        doc.trichYeu.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.soKyHieu.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesTab = activeTab === 'Tất cả' || doc.loaiVanBan === activeTab;

      return matchesSearch && matchesTab;
    });
  }, [documents, searchTerm, activeTab]);

  // Handlers
  const openDeleteModal = (doc: DirectiveDocument) => {
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
    setPreviewZoom(1.0);
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

  const handleOpenEdit = (doc: DirectiveDocument) => {
    setFormData({ ...doc });
    setIsEditMode(true);
    setSelectedFile(null);
    // Simulate existing file for update mode visual
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

      if (isEditMode && formData.id) {
        await updateDoc(doc(db, 'school_documents', formData.id), {
          ...formData,
          fileDinhKemUrl: fileUrl
        });
        addToast("Cập nhật thành công", "Thông tin văn bản đã được lưu.", "success");
      } else {
        await addDoc(collection(db, 'school_documents'), {
          ...formData,
          fileDinhKemUrl: fileUrl,
          schoolYear: currentSchoolYear,
          createdAt: new Date().toISOString()
        });
        addToast("Thêm mới thành công", "Văn bản đã được thêm vào hệ thống.", "success");
      }
      setIsFormModalOpen(false);
    } catch (error) {
      console.error("Error saving document:", error);
      addToast("Lỗi lưu dữ liệu", "Không thể lưu văn bản này.", "error");
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'Kế hoạch': return 'bg-emerald-100 text-emerald-700';
      case 'Quyết định': return 'bg-amber-100 text-amber-700';
      case 'Thông báo': return 'bg-blue-100 text-blue-700';
      case 'Báo cáo': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header Area */}
      <div className="bg-white border-b border-gray-200">
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${isMobile ? 'py-4' : 'py-6'}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="min-w-0">
              {!isMobile && (
                <button
                  onClick={() => navigate('/')}
                  className="flex items-center text-sm text-gray-500 hover:text-emerald-600 transition-colors mb-2"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" /> Quay lại Dashboard
                </button>
              )}
              <div
                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate('/')}
              >
                <div className={`${isMobile ? 'p-1.5' : 'p-2'} bg-emerald-100 rounded-lg`}>
                  <Building2 className={`${isMobile ? 'h-5 w-5' : 'h-6 w-6'} text-emerald-600`} />
                </div>
                <h1 className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-gray-900 uppercase`}>VĂN BẢN CỦA TRƯỜNG</h1>
              </div>
            </div>
            {canManageDocuments && (
              <button
                onClick={handleOpenAdd}
                className={`flex items-center gap-2 bg-emerald-600 text-white ${isMobile ? 'px-3 py-2 text-sm' : 'px-4 py-2'} rounded-lg hover:bg-emerald-700 transition-colors shadow-md flex-shrink-0`}
              >
                <Plus className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
                <span>{isMobile ? 'Thêm mới' : 'Thêm văn bản mới'}</span>
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="mt-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex overflow-x-auto pb-1 lg:pb-0 gap-2 w-full lg:w-auto no-scrollbar">
              {['Tất cả', 'Kế hoạch', 'Quyết định', 'Thông báo', 'Báo cáo', 'Văn bản khác'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`
                    whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all
                    ${activeTab === tab
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}
                  `}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex w-full lg:w-auto gap-3">
              <div className="relative flex-grow lg:w-64 group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm transition-shadow"
                  placeholder="Tìm theo tên hoặc số hiệu..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>


            </div>
          </div>
        </div>
      </div>

      {/* List View */}
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${isMobile ? 'py-4' : 'py-8'}`}>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

          {/* Mobile: Card Layout */}
          {isMobile ? (
            <div className="divide-y divide-gray-100">
              {filteredDocs.length > 0 ? (
                filteredDocs.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => handleOpenView(doc)}
                    className="p-4 hover:bg-emerald-50/50 transition-colors cursor-pointer active:bg-emerald-100"
                  >
                    {/* Row 1: Title */}
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded-lg bg-gray-100 text-gray-500 flex-shrink-0">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 line-clamp-2">
                          {doc.trichYeu}
                        </p>
                      </div>
                    </div>

                    {/* Row 2: Badges + Meta */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2 ml-9">
                      <span className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 text-gray-600">
                        {doc.soKyHieu}
                      </span>
                      <Badge colorClass={getTypeBadgeColor(doc.loaiVanBan)}>{doc.loaiVanBan}</Badge>
                      <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                        <Calendar className="h-2.5 w-2.5" />
                        {new Date(doc.ngayBanHanh).toLocaleDateString('vi-VN')}
                      </span>
                    </div>

                    {/* Row 3: Actions */}
                    <div
                      className="flex items-center gap-2 mt-3 ml-9"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleOpenView(doc)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" /> Xem
                      </button>
                      <button
                        onClick={() => handleDownload(doc)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" /> Tải
                      </button>
                      {canManageDocuments && (
                        <>
                          <button
                            onClick={() => handleOpenEdit(doc)}
                            className="p-1.5 text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(doc)}
                            className="p-1.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-gray-500">
                  <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-medium">Không tìm thấy văn bản nào</p>
                  <p className="text-xs mt-1">Thử thay đổi bộ lọc</p>
                </div>
              )}
            </div>
          ) : (
            /* Desktop: Table Layout */
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/2">
                      Trích yếu văn bản
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Thông tin
                    </th>
                    <th scope="col" className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDocs.length > 0 ? (
                    filteredDocs.map((doc) => (
                      <tr
                        key={doc.id}
                        className="hover:bg-emerald-50/50 transition-colors cursor-pointer group"
                        onClick={() => handleOpenView(doc)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-gray-100 text-gray-500 group-hover:bg-white group-hover:text-emerald-600 transition-colors">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-emerald-700 transition-colors">
                                {doc.trichYeu}
                              </p>
                              {doc.tomTatNoiDung && (
                                <p className="mt-1 text-xs text-gray-500 line-clamp-1">
                                  {doc.tomTatNoiDung}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded border border-gray-200 text-gray-600">
                                {doc.soKyHieu}
                              </span>
                              <Badge colorClass={getTypeBadgeColor(doc.loaiVanBan)}>{doc.loaiVanBan}</Badge>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <div className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                <span>{doc.coQuanBanHanh}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(doc.ngayBanHanh).toLocaleDateString('vi-VN')}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex justify-center items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleOpenView(doc)}
                              className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
                              title="Xem chi tiết"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDownload(doc)}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors"
                              title="Tải xuống"
                            >
                              <Download className="h-4 w-4" />
                            </button>

                            {canManageDocuments && (
                              <>
                                <button
                                  onClick={() => handleOpenEdit(doc)}
                                  className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-full transition-colors"
                                  title="Chỉnh sửa"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => openDeleteModal(doc)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                  title="Xóa"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center">
                          <FileText className="h-12 w-12 text-gray-300 mb-3" />
                          <p className="text-base font-medium">Không tìm thấy văn bản nào</p>
                          <p className="text-sm mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div className={`${isMobile ? 'px-4 py-3' : 'px-6 py-4'} bg-gray-50 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500`}>
            <span className={isMobile ? 'text-xs' : ''}>{filteredDocs.length} văn bản</span>
            {!isMobile && (
              <div className="flex gap-2">
                <button className="px-3 py-1 border border-gray-300 rounded bg-white disabled:opacity-50" disabled>Trước</button>
                <button className="px-3 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50">Sau</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {
        isDeleteModalOpen && docToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Xác nhận xóa tài liệu?</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Bạn có chắc chắn muốn xóa văn bản <span className="font-semibold text-gray-800">"{docToDelete.trichYeu}"</span> không? Hành động này không thể hoàn tác.
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
        )
      }

      {/* View Modal - Mobile Optimized */}
      {
        isViewModalOpen && selectedDoc && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            {/* Mobile Layout */}
            {isMobile ? (
              <div className="h-full flex flex-col bg-gray-50">
                {/* Compact Header */}
                <div className="bg-emerald-600 px-4 py-3 flex items-center gap-3 flex-shrink-0 safe-area-inset-top">
                  <button
                    onClick={() => setIsViewModalOpen(false)}
                    className="p-1.5 -ml-1.5 text-white/80 hover:text-white hover:bg-emerald-700 rounded-full transition-all"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold text-sm truncate">{selectedDoc.trichYeu}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-emerald-100 text-[10px] font-mono">{selectedDoc.soKyHieu}</span>
                      <span className="text-emerald-200 text-[10px]">•</span>
                      <span className="text-emerald-100 text-[10px]">{new Date(selectedDoc.ngayBanHanh).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>
                </div>

                {/* Document Preview - Full Height */}
                <div className="flex-1 relative overflow-hidden">
                  {selectedDoc.fileDinhKemUrl && selectedDoc.fileDinhKemUrl !== '#' ? (
                    <iframe
                      src={getPreviewUrl(selectedDoc.fileDinhKemUrl)}
                      className="w-full h-full bg-white"
                      title="Document Preview"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 bg-white">
                      <FileText className="h-16 w-16 mb-4 text-gray-300" />
                      <p className="text-base font-medium">Không có bản xem trước</p>
                      <p className="text-sm text-gray-400 mt-1 text-center px-8">Văn bản này chưa có file đính kèm</p>
                    </div>
                  )}
                </div>

                {/* Mobile Bottom Action Bar */}
                <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between gap-3 safe-area-inset-bottom">
                  <div className="flex items-center gap-2">
                    <Badge colorClass={getTypeBadgeColor(selectedDoc.loaiVanBan)}>{selectedDoc.loaiVanBan}</Badge>
                  </div>
                  <button
                    onClick={() => handleDownload(selectedDoc)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-lg transition-all active:scale-95"
                  >
                    <Download className="h-4 w-4" /> Tải về
                  </button>
                </div>
              </div>
            ) : (
              /* Desktop Layout - Original Split View */
              <div className="h-full flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

                  <div className="bg-emerald-600 px-6 py-3 flex justify-between items-center flex-shrink-0 shadow-md z-20">
                    <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5" /> Chi tiết văn bản
                    </h3>
                    <button onClick={() => setIsViewModalOpen(false)} className="text-emerald-100 hover:text-white hover:bg-emerald-700 p-1 rounded-full transition-all">
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                  <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                    <div className="w-full lg:w-[35%] flex flex-col border-r border-gray-200 bg-white h-full">
                      <div className="overflow-y-auto p-6 flex-1">
                        <div className="mb-6">
                          <h2 className="text-xl font-bold text-gray-900 mb-2 leading-tight">{selectedDoc.trichYeu}</h2>
                          <div className="flex flex-wrap gap-2 mt-3">
                            <Badge colorClass={getTypeBadgeColor(selectedDoc.loaiVanBan)}>{selectedDoc.loaiVanBan}</Badge>
                            <span className="text-xs text-gray-500 flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-full">
                              <Calendar className="h-3 w-3" /> {new Date(selectedDoc.ngayBanHanh).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-4 mb-8">
                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Số / Ký hiệu</p>
                                <p className="font-mono text-sm text-gray-800 font-medium">{selectedDoc.soKyHieu}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Ngày ban hành</p>
                                <p className="text-sm font-medium text-gray-800">{new Date(selectedDoc.ngayBanHanh).toLocaleDateString('vi-VN')}</p>
                              </div>
                            </div>
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-gray-400" /> Đơn vị ban hành
                            </p>
                            <p className="text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm">
                              {selectedDoc.coQuanBanHanh}
                            </p>
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-gray-700 mb-2">Tóm tắt nội dung</p>
                            <p className="text-gray-600 text-sm leading-relaxed bg-gray-50 p-4 rounded-lg border border-gray-100 h-auto min-h-[100px]">
                              {selectedDoc.tomTatNoiDung || "Chưa có tóm tắt nội dung cho văn bản này."}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center flex-shrink-0">
                        <button className="text-sm text-gray-500 hover:text-gray-800 underline">Báo cáo lỗi</button>
                        <button
                          onClick={() => handleDownload(selectedDoc)}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-md transition-colors"
                        >
                          <Download className="h-4 w-4" /> Tải về máy
                        </button>
                      </div>
                    </div>

                    <div className="w-full lg:w-[65%] bg-gray-100 flex flex-col h-full relative">

                      <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 shadow-sm z-10">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Xem trước văn bản</span>
                        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                          <button
                            onClick={() => setPreviewZoom(z => Math.max(0.5, z - 0.1))}
                            className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-gray-600 transition-all"
                            title="Thu nhỏ"
                          >
                            <ZoomOut className="h-4 w-4" />
                          </button>
                          <span className="text-xs font-medium w-12 text-center text-gray-700">{Math.round(previewZoom * 100)}%</span>
                          <button
                            onClick={() => setPreviewZoom(z => Math.min(2.0, z + 0.1))}
                            className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-gray-600 transition-all"
                            title="Phóng to"
                          >
                            <ZoomIn className="h-4 w-4" />
                          </button>
                          <div className="w-px h-4 bg-gray-300 mx-1"></div>
                          <button
                            onClick={() => setPreviewZoom(1)}
                            className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-gray-600 transition-all"
                            title="Mặc định"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Preview Canvas */}
                      <div className="flex-1 overflow-hidden bg-slate-100/50 relative">
                        <div className="absolute inset-0 w-full h-full">
                          {selectedDoc.fileDinhKemUrl && selectedDoc.fileDinhKemUrl !== '#' ? (
                            <iframe
                              src={getPreviewUrl(selectedDoc.fileDinhKemUrl)}
                              className="w-full h-full"
                              title="Document Preview"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                              <FileText className="h-16 w-16 mb-4 text-gray-400" />
                              <p className="text-lg font-medium">Không có bản xem trước</p>
                              <p className="text-sm">Văn bản này chưa có file đính kèm hoặc file không hỗ trợ xem trước.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      }

      {/* Add/Edit Form Modal */}
      {
        isFormModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="bg-gray-900 px-6 py-4 flex justify-between items-center flex-shrink-0">
                <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                  {isEditMode ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                  {isEditMode ? 'Cập nhật văn bản' : 'Thêm văn bản mới'}
                </h3>
                <button onClick={() => setIsFormModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto">
                <form id="documentForm" onSubmit={handleSave} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Trích yếu văn bản <span className="text-red-500">*</span></label>
                    <textarea
                      required
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                      placeholder="Nhập trích yếu nội dung văn bản..."
                      value={formData.trichYeu || ''}
                      onChange={e => setFormData({ ...formData, trichYeu: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Số / Ký hiệu <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                        placeholder="VD: 123/KH-MGVA"
                        value={formData.soKyHieu || ''}
                        onChange={e => setFormData({ ...formData, soKyHieu: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ngày ban hành <span className="text-red-500">*</span></label>
                      <input
                        type="date"
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                        value={formData.ngayBanHanh || ''}
                        onChange={e => setFormData({ ...formData, ngayBanHanh: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cơ quan ban hành</label>
                      <select
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white"
                        value={formData.coQuanBanHanh || 'Ban Giám Hiệu'}
                        onChange={e => setFormData({ ...formData, coQuanBanHanh: e.target.value as any })}
                      >
                        <option value="Ban Giám Hiệu">Ban Giám Hiệu</option>
                        <option value="Hiệu Trưởng">Hiệu Trưởng</option>
                        <option value="Tổ Chuyên Môn">Tổ Chuyên Môn</option>
                        <option value="Tổ Văn Phòng">Tổ Văn Phòng</option>
                        <option value="Hội đồng TĐKT">Hội đồng TĐKT</option>
                        <option value="Khác">Khác</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Loại văn bản</label>
                      <select
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white"
                        value={formData.loaiVanBan || 'Kế hoạch'}
                        onChange={e => setFormData({ ...formData, loaiVanBan: e.target.value as any })}
                      >
                        <option value="Kế hoạch">Kế hoạch</option>
                        <option value="Quyết định">Quyết định</option>
                        <option value="Thông báo">Thông báo</option>
                        <option value="Báo cáo">Báo cáo</option>
                        <option value="Văn bản khác">Văn bản khác</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tóm tắt nội dung</label>
                    <textarea
                      rows={4}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                      placeholder="Nhập tóm tắt nội dung chính..."
                      value={formData.tomTatNoiDung || ''}
                      onChange={e => setFormData({ ...formData, tomTatNoiDung: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">File đính kèm</label>

                    {selectedFileName ? (
                      <div className="mt-1 p-4 border border-emerald-200 rounded-lg bg-emerald-50 flex items-center justify-between animate-in fade-in zoom-in duration-300">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                            <FileText className="h-6 w-6" />
                          </div>
                          <div className="flex flex-col">
                            <p className="text-sm font-medium text-gray-900">{selectedFileName}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3 text-green-500" /> Đã chọn file
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={removeSelectedFile}
                          className="p-1.5 hover:bg-red-100 hover:text-red-500 rounded-full text-gray-400 transition-colors"
                          title="Xóa file"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1 relative flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-emerald-400 hover:bg-emerald-50/30 transition-all cursor-pointer bg-gray-50 group">
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          className="sr-only"
                          onChange={handleFileChange}
                        />
                        <label htmlFor="file-upload" className="absolute inset-0 w-full h-full cursor-pointer z-10"></label>
                        <div className="space-y-1 text-center pointer-events-none">
                          <Upload className="mx-auto h-12 w-12 text-gray-400 group-hover:text-emerald-500 transition-colors" />
                          <div className="flex text-sm text-gray-600 justify-center">
                            <span className="relative rounded-md font-medium text-emerald-600 focus-within:outline-none group-hover:underline">
                              <span>Tải file lên</span>
                            </span>
                            <p className="pl-1">hoặc kéo thả vào đây</p>
                          </div>
                          <p className="text-xs text-gray-500">PDF, DOC, DOCX tối đa 10MB</p>
                        </div>
                      </div>
                    )}
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
                  form="documentForm"
                  className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-md hover:shadow-lg transition-all"
                >
                  <Save className="h-4 w-4" /> {isEditMode ? 'Lưu thay đổi' : 'Tạo mới'}
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default SchoolDocuments;