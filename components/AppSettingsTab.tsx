import React, { useState, useEffect } from 'react';
import { db, storage } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Upload, Image as ImageIcon, RefreshCcw, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

const AppSettingsTab: React.FC = () => {
    const { user } = useAuth();
    const { addToast } = useNotification();

    const [currentLogo, setCurrentLogo] = useState('');
    const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoUploading, setLogoUploading] = useState(false);

    // Certification Logo State
    const [certLogo, setCertLogo] = useState('');
    const [certLogoPreviewUrl, setCertLogoPreviewUrl] = useState('');
    const [certLogoFile, setCertLogoFile] = useState<File | null>(null);
    const [certLogoUploading, setCertLogoUploading] = useState(false);

    // Background Image State
    const [currentBackground, setCurrentBackground] = useState('/login-background.jpg');
    const [previewUrl, setPreviewUrl] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);

    // Fetch settings
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                // Fetch Background
                const bgDocRef = doc(db, 'app_settings', 'login_background');
                const bgDocSnap = await getDoc(bgDocRef);
                if (bgDocSnap.exists() && bgDocSnap.data().imageUrl) {
                    setCurrentBackground(bgDocSnap.data().imageUrl);
                }

                // Fetch Logo
                const logoDocRef = doc(db, 'app_settings', 'system_logo');
                const logoDocSnap = await getDoc(logoDocRef);
                if (logoDocSnap.exists() && logoDocSnap.data().imageUrl) {
                    setCurrentLogo(logoDocSnap.data().imageUrl);
                }

                // Fetch Certification Logo
                const certDocRef = doc(db, 'app_settings', 'certification_logo');
                const certDocSnap = await getDoc(certDocRef);
                if (certDocSnap.exists() && certDocSnap.data().imageUrl) {
                    setCertLogo(certDocSnap.data().imageUrl);
                }
            } catch (error) {
                console.error('Error fetching settings:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    // Handle Logo File Change
    const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];

            if (!selectedFile.type.startsWith('image/')) {
                addToast('Vui lòng chọn file hình ảnh', 'Chỉ chấp nhận file ảnh (JPG, PNG, etc.)', 'error');
                return;
            }

            if (selectedFile.size > 2 * 1024 * 1024) { // 2MB limit for logo
                addToast('File quá lớn', 'Logo không được vượt quá 2MB', 'error');
                return;
            }

            setLogoFile(selectedFile);
            setLogoPreviewUrl(URL.createObjectURL(selectedFile));
        }
    };

    // Upload Logo
    const handleSaveLogo = async () => {
        if (!logoFile || !user) return;

        setLogoUploading(true);
        try {
            const timestamp = Date.now();
            const storageRef = ref(storage, `app_settings/system-logo-${timestamp}.png`);
            await uploadBytes(storageRef, logoFile);
            const downloadUrl = await getDownloadURL(storageRef);

            await setDoc(doc(db, 'app_settings', 'system_logo'), {
                imageUrl: downloadUrl,
                updatedAt: new Date().toISOString(),
                updatedBy: user.id,
                updatedByName: user.fullName
            });

            setCurrentLogo(downloadUrl);
            setLogoPreviewUrl('');
            setLogoFile(null);
            addToast('Thành công!', 'Đã cập nhật logo hệ thống', 'success');

            // Reload page to reflect changes in Header immediately (simple way)
            // Or we could use a context, but reload is safer for global assets
            setTimeout(() => window.location.reload(), 1500);

        } catch (error) {
            console.error('Error uploading logo:', error);
            addToast('Lỗi tải lên', 'Không thể cập nhật logo. Vui lòng thử lại.', 'error');
        } finally {
            setLogoUploading(false);
        }
    };

    const handleResetLogo = () => {
        setLogoPreviewUrl('');
        setLogoFile(null);
    };

    // Handle Certification Logo File Change
    const handleCertLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];

            if (!selectedFile.type.startsWith('image/')) {
                addToast('Vui lòng chọn file hình ảnh', 'Chỉ chấp nhận file ảnh (JPG, PNG, etc.)', 'error');
                return;
            }

            if (selectedFile.size > 2 * 1024 * 1024) { // 2MB limit
                addToast('File quá lớn', 'Logo không được vượt quá 2MB', 'error');
                return;
            }

            setCertLogoFile(selectedFile);
            setCertLogoPreviewUrl(URL.createObjectURL(selectedFile));
        }
    };

    // Upload Certification Logo
    const handleSaveCertLogo = async () => {
        if (!certLogoFile || !user) return;

        setCertLogoUploading(true);
        try {
            const timestamp = Date.now();
            const storageRef = ref(storage, `app_settings/cert-logo-${timestamp}.png`);
            await uploadBytes(storageRef, certLogoFile);
            const downloadUrl = await getDownloadURL(storageRef);

            await setDoc(doc(db, 'app_settings', 'certification_logo'), {
                imageUrl: downloadUrl,
                updatedAt: new Date().toISOString(),
                updatedBy: user.id,
                updatedByName: user.fullName
            });

            setCertLogo(downloadUrl);
            setCertLogoPreviewUrl('');
            setCertLogoFile(null);
            addToast('Thành công!', 'Đã cập nhật logo chứng nhận', 'success');

            // Reload to reflect changes
            setTimeout(() => window.location.reload(), 1500);

        } catch (error) {
            console.error('Error uploading cert logo:', error);
            addToast('Lỗi tải lên', 'Không thể cập nhật logo. Vui lòng thử lại.', 'error');
        } finally {
            setCertLogoUploading(false);
        }
    };

    const handleResetCertLogo = () => {
        setCertLogoPreviewUrl('');
        setCertLogoFile(null);
    };

    // Handle Background File Change
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];

            // Validate file type
            if (!selectedFile.type.startsWith('image/')) {
                addToast('Vui lòng chọn file hình ảnh', 'Chỉ chấp nhận file ảnh (JPG, PNG, etc.)', 'error');
                return;
            }

            // Validate file size (max 5MB)
            if (selectedFile.size > 5 * 1024 * 1024) {
                addToast('File quá lớn', 'Kích thước file không được vượt quá 5MB', 'error');
                return;
            }

            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
        }
    };

    // Upload and save Background
    const handleSave = async () => {
        if (!file || !user) return;

        setUploading(true);
        try {
            // Upload to Firebase Storage
            const timestamp = Date.now();
            const storageRef = ref(storage, `app_settings/login-background-${timestamp}.jpg`);
            await uploadBytes(storageRef, file);
            const downloadUrl = await getDownloadURL(storageRef);

            // Save URL to Firestore
            await setDoc(doc(db, 'app_settings', 'login_background'), {
                imageUrl: downloadUrl,
                updatedAt: new Date().toISOString(),
                updatedBy: user.id,
                updatedByName: user.fullName
            });

            setCurrentBackground(downloadUrl);
            setPreviewUrl('');
            setFile(null);
            addToast('Thành công!', 'Đã cập nhật hình nền đăng nhập', 'success');
        } catch (error) {
            console.error('Error uploading:', error);
            addToast('Lỗi tải lên', 'Không thể cập nhật hình nền. Vui lòng thử lại.', 'error');
        } finally {
            setUploading(false);
        }
    };

    // Reset to default Background
    const handleReset = () => {
        setPreviewUrl('');
        setFile(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-slate-700 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* --- LOGO SETTINGS --- */}
            <div className="space-y-6">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-6">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-indigo-600 rounded-lg">
                            <ImageIcon className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">Logo Hệ thống</h2>
                            <p className="text-sm text-gray-600">
                                Logo hiển thị trên Header và trang Đăng nhập. Nên dùng ảnh PNG nền trong suốt, kích thước vuông (VD: 512x512px).
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Current Logo */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                            <h3 className="text-sm font-bold text-gray-700 uppercase flex items-center gap-2">
                                <Check className="h-4 w-4 text-green-600" /> Logo hiện tại
                            </h3>
                        </div>
                        <div className="p-6 flex justify-center items-center bg-gray-100 min-h-[200px]">
                            {currentLogo ? (
                                <img src={currentLogo} alt="Current Logo" className="h-32 w-32 object-contain" />
                            ) : (
                                <div className="text-gray-400 text-sm italic">Chưa có logo tùy chỉnh (Đang dùng mặc định)</div>
                            )}
                        </div>
                    </div>

                    {/* Upload Logo */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                            <h3 className="text-sm font-bold text-gray-700 uppercase flex items-center gap-2">
                                <Upload className="h-4 w-4 text-indigo-600" /> Tải lên Logo mới
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="mb-4">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleLogoFileChange}
                                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                                />
                            </div>

                            {logoPreviewUrl && (
                                <div className="mb-4 flex justify-center p-4 border border-dashed border-indigo-200 rounded-lg bg-indigo-50/30">
                                    <img src={logoPreviewUrl} alt="Preview" className="h-24 w-24 object-contain" />
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button
                                    onClick={handleSaveLogo}
                                    disabled={!logoFile || logoUploading}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all"
                                >
                                    {logoUploading ? 'Đang tải...' : 'Lưu Logo'}
                                </button>
                                {logoPreviewUrl && (
                                    <button
                                        onClick={handleResetLogo}
                                        disabled={logoUploading}
                                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                                    >
                                        Hủy
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <hr className="border-gray-200" />

            {/* --- CERTIFICATION LOGO SETTINGS --- */}
            <div className="space-y-6">
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-6">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-emerald-600 rounded-lg">
                            <ImageIcon className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">Logo Chứng Nhận (Đạt Chuẩn Quốc Gia)</h2>
                            <p className="text-sm text-gray-600">
                                Logo chứng nhận trường đạt chuẩn. Sẽ hiển thị ở góc trang đăng nhập và trên Header.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Current Cert Logo */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                            <h3 className="text-sm font-bold text-gray-700 uppercase flex items-center gap-2">
                                <Check className="h-4 w-4 text-green-600" /> Logo hiện tại
                            </h3>
                        </div>
                        <div className="p-6 flex justify-center items-center bg-gray-100 min-h-[200px]">
                            {certLogo ? (
                                <img src={certLogo} alt="Certification Logo" className="h-32 w-32 object-contain" />
                            ) : (
                                <div className="text-gray-400 text-sm italic">Chưa có logo chứng nhận</div>
                            )}
                        </div>
                    </div>

                    {/* Upload Cert Logo */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                            <h3 className="text-sm font-bold text-gray-700 uppercase flex items-center gap-2">
                                <Upload className="h-4 w-4 text-emerald-600" /> Tải lên Logo mới
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="mb-4">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleCertLogoFileChange}
                                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                                />
                            </div>

                            {certLogoPreviewUrl && (
                                <div className="mb-4 flex justify-center p-4 border border-dashed border-emerald-200 rounded-lg bg-emerald-50/30">
                                    <img src={certLogoPreviewUrl} alt="Preview" className="h-24 w-24 object-contain" />
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button
                                    onClick={handleSaveCertLogo}
                                    disabled={!certLogoFile || certLogoUploading}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all"
                                >
                                    {certLogoUploading ? 'Đang tải...' : 'Lưu Logo'}
                                </button>
                                {certLogoPreviewUrl && (
                                    <button
                                        onClick={handleResetCertLogo}
                                        disabled={certLogoUploading}
                                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                                    >
                                        Hủy
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <hr className="border-gray-200" />

            {/* --- BACKGROUND SETTINGS --- */}
            <div className="space-y-6">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-blue-600 rounded-lg">
                            <ImageIcon className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">Hình nền trang đăng nhập</h2>
                            <p className="text-sm text-gray-600">
                                Tùy chỉnh hình nền hiển thị trên trang đăng nhập của hệ thống. Hình ảnh nên có kích thước tối thiểu 1920x1080px để hiển thị tốt nhất.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Current Background Preview */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                        <h3 className="text-sm font-bold text-gray-700 uppercase flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" /> Hình nền hiện tại
                        </h3>
                    </div>
                    <div className="p-6">
                        <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-100">
                            <img
                                src={currentBackground}
                                alt="Current Background"
                                className="w-full h-64 object-contain"
                            />
                        </div>
                    </div>
                </div>

                {/* Upload New Background */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                        <h3 className="text-sm font-bold text-gray-700 uppercase flex items-center gap-2">
                            <Upload className="h-4 w-4 text-blue-600" /> Tải lên hình nền mới
                        </h3>
                    </div>
                    <div className="p-6">
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Chọn file hình ảnh
                            </label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                cursor-pointer"
                            />
                            <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Kích thước tối đa: 5MB. Định dạng: JPG, PNG, WEBP
                            </p>
                        </div>

                        {/* Preview New Image */}
                        {previewUrl && (
                            <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <p className="text-sm font-medium text-gray-700 mb-2">Xem trước hình nền mới:</p>
                                <div className="border-2 border-dashed border-blue-300 rounded-lg overflow-hidden bg-blue-50/30">
                                    <img
                                        src={previewUrl}
                                        alt="Preview"
                                        className="w-full h-64 object-contain"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={handleSave}
                                disabled={!file || uploading}
                                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                            >
                                {uploading ? (
                                    <>
                                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Đang tải lên...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="h-4 w-4" />
                                        Lưu và áp dụng
                                    </>
                                )}
                            </button>

                            {previewUrl && (
                                <button
                                    onClick={handleReset}
                                    disabled={uploading}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-all"
                                >
                                    <RefreshCcw className="h-4 w-4" />
                                    Hủy bỏ
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Info Box */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-800">
                            <p className="font-semibold mb-1">Lưu ý khi thay đổi hình nền:</p>
                            <ul className="list-disc list-inside space-y-1 text-amber-700">
                                <li>Hình nền sẽ được áp dụng ngay lập tức cho tất cả người dùng</li>
                                <li>Nên chọn hình ảnh có độ phân giải cao (tối thiểu 1920x1080px)</li>
                                <li>Hình ảnh nên có nội dung phù hợp với môi trường trường học</li>
                                <li>File cũ sẽ được lưu trữ trên Firebase Storage</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AppSettingsTab;
