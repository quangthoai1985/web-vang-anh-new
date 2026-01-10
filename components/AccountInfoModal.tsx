import React, { useState, useEffect, useRef } from 'react';
import { X, User, Save, Loader2, Mail, Phone, MapPin, Briefcase, Camera, PenLine, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { db, storage } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface AccountInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AccountInfoModal: React.FC<AccountInfoModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const { addToast } = useNotification();

    // Form State
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [avatar, setAvatar] = useState('');
    const [signatureUrl, setSignatureUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [isUploadingSignature, setIsUploadingSignature] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const signatureInputRef = useRef<HTMLInputElement>(null);

    // Initialize form when user data loads or modal opens
    useEffect(() => {
        if (user && isOpen) {
            setFullName(user.fullName || '');
            setPhone((user as any).phone || '');
            setAddress((user as any).address || '');
            setAvatar(user.avatar || '');
            setSignatureUrl((user as any).signatureUrl || '');
        }
    }, [user, isOpen]);

    if (!isOpen) return null;

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            addToast('Vui lòng chọn file ảnh!', '', 'error');
            return;
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            addToast('Kích thước ảnh tối đa là 2MB!', '', 'error');
            return;
        }

        setIsUploadingAvatar(true);
        try {
            // Upload to Firebase Storage
            const storageRef = ref(storage, `avatars/${user.id}/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const downloadUrl = await getDownloadURL(storageRef);
            setAvatar(downloadUrl);
            addToast('Tải ảnh đại diện thành công!', '', 'success');
        } catch (error) {
            console.error('Error uploading avatar:', error);
            addToast('Lỗi khi tải ảnh đại diện!', '', 'error');
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        // Validate file type - only PNG for transparent background
        if (file.type !== 'image/png') {
            addToast('Vui lòng chọn file PNG cho chữ ký (để có nền trong suốt)!', '', 'error');
            return;
        }

        // Validate file size (max 1MB for signature)
        if (file.size > 1 * 1024 * 1024) {
            addToast('Kích thước chữ ký tối đa là 1MB!', '', 'error');
            return;
        }

        setIsUploadingSignature(true);
        try {
            // Upload to Firebase Storage - overwrite existing signature
            const storageRef = ref(storage, `signatures/${user.id}/signature.png`);
            await uploadBytes(storageRef, file, { contentType: 'image/png' });
            const downloadUrl = await getDownloadURL(storageRef);
            setSignatureUrl(downloadUrl);
            addToast('Tải chữ ký thành công!', '', 'success');
        } catch (error) {
            console.error('Error uploading signature:', error);
            addToast('Lỗi khi tải chữ ký!', '', 'error');
        } finally {
            setIsUploadingSignature(false);
        }
    };

    const handleDeleteSignature = () => {
        setSignatureUrl('');
        addToast('Đã xóa chữ ký!', '', 'success');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        if (!fullName.trim()) {
            addToast('Họ và tên không được để trống!', '', 'error');
            return;
        }

        setIsSubmitting(true);

        try {
            const userDocRef = doc(db, 'users', user.id);
            await updateDoc(userDocRef, {
                fullName: fullName.trim(),
                phone: phone.trim(),
                address: address.trim(),
                avatar: avatar,
                signatureUrl: signatureUrl,
            });

            addToast('Cập nhật thông tin thành công!', '', 'success');
            onClose();

            // Reload page to update user context
            window.location.reload();
        } catch (error) {
            console.error('Error updating profile:', error);
            addToast('Lỗi khi cập nhật thông tin!', '', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getInitials = (name: string) => {
        return name ? name.charAt(0).toUpperCase() : 'U';
    };

    const getRoleBadgeClass = (role?: string) => {
        switch (role) {
            case 'admin': return 'bg-red-100 text-red-700 border-red-200';
            case 'head_teacher': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'office_head': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
            case 'teacher': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'staff': return 'bg-purple-100 text-purple-700 border-purple-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 text-gray-900">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex justify-between items-center flex-shrink-0">
                    <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Thông tin tài khoản
                    </h3>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Avatar Section */}
                        <div className="flex flex-col items-center gap-4">
                            <div className="relative group">
                                {avatar ? (
                                    <img
                                        src={avatar}
                                        alt={fullName}
                                        className="h-24 w-24 rounded-full object-cover border-4 border-blue-100 shadow-lg"
                                    />
                                ) : (
                                    <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold border-4 border-blue-100 shadow-lg">
                                        {getInitials(fullName)}
                                    </div>
                                )}

                                {/* Upload overlay */}
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploadingAvatar}
                                    className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                                >
                                    {isUploadingAvatar ? (
                                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                                    ) : (
                                        <Camera className="h-6 w-6 text-white" />
                                    )}
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleAvatarUpload}
                                    accept="image/*"
                                    className="hidden"
                                />
                            </div>

                            {/* Role Badge */}
                            <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getRoleBadgeClass(user?.role)}`}>
                                {user?.roleLabel}
                            </span>
                        </div>

                        {/* Read-only fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                    <Mail className="h-4 w-4 text-gray-400" />
                                    <span className="truncate">{user?.email}</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Tên đăng nhập</label>
                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                    <User className="h-4 w-4 text-gray-400" />
                                    <span>{user?.username}</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Nhóm</label>
                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                    <Briefcase className="h-4 w-4 text-gray-400" />
                                    <span>{user?.group || 'Chưa cập nhật'}</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Trạng thái</label>
                                <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${user?.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {user?.status === 'active' ? 'Hoạt động' : 'Không hoạt động'}
                                </span>
                            </div>
                        </div>

                        {/* Editable Fields */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Họ và tên <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                    <input
                                        type="text"
                                        required
                                        className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 bg-white"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder="Nhập họ và tên..."
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                    <input
                                        type="tel"
                                        className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 bg-white"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="Nhập số điện thoại..."
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                    <input
                                        type="text"
                                        className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 bg-white"
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        placeholder="Nhập địa chỉ..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Signature Section */}
                        <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                            <div className="flex items-center gap-2 mb-3">
                                <PenLine className="h-5 w-5 text-indigo-600" />
                                <label className="text-sm font-medium text-gray-700">Chữ ký điện tử</label>
                            </div>
                            <p className="text-xs text-gray-500 mb-3">
                                Tải lên ảnh chữ ký định dạng PNG với nền trong suốt. Chữ ký sẽ được sử dụng khi chèn vào tài liệu Word.
                            </p>

                            {/* Signature Preview with Checkerboard Background */}
                            {signatureUrl ? (
                                <div className="mb-3">
                                    <div
                                        className="relative inline-block rounded-lg border-2 border-dashed border-indigo-200 p-2"
                                        style={{
                                            background: `repeating-conic-gradient(#e5e7eb 0% 25%, transparent 0% 50%) 50% / 16px 16px`
                                        }}
                                    >
                                        <img
                                            src={signatureUrl}
                                            alt="Chữ ký"
                                            className="max-h-20 max-w-full object-contain"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleDeleteSignature}
                                            className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md"
                                            title="Xóa chữ ký"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    className="mb-3 flex items-center justify-center h-20 rounded-lg border-2 border-dashed border-indigo-200"
                                    style={{
                                        background: `repeating-conic-gradient(#e5e7eb 0% 25%, transparent 0% 50%) 50% / 16px 16px`
                                    }}
                                >
                                    <span className="text-sm text-gray-400">Chưa có chữ ký</span>
                                </div>
                            )}

                            {/* Upload Button */}
                            <button
                                type="button"
                                onClick={() => signatureInputRef.current?.click()}
                                disabled={isUploadingSignature}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 bg-white border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
                            >
                                {isUploadingSignature ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
                                    </>
                                ) : (
                                    <>
                                        <PenLine className="h-4 w-4" /> {signatureUrl ? 'Thay đổi chữ ký' : 'Tải lên chữ ký'}
                                    </>
                                )}
                            </button>
                            <input
                                type="file"
                                ref={signatureInputRef}
                                onChange={handleSignatureUpload}
                                accept="image/png"
                                className="hidden"
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-300 transition-all"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4" /> Lưu thay đổi
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AccountInfoModal;
