import React, { useState } from 'react';
import { seedDatabase } from '../utils/seedData';
import { Database, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const AdminTools: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleSeedData = async () => {
        if (!confirm('Bạn có chắc chắn muốn khởi tạo dữ liệu mẫu lên Cloud không?')) return;

        setLoading(true);
        setMessage(null);

        try {
            const result = await seedDatabase();
            setMessage({ type: 'success', text: result || 'Khởi tạo dữ liệu thành công!' });
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: 'Có lỗi xảy ra khi khởi tạo dữ liệu. Vui lòng kiểm tra console.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <Database className="w-5 h-5 mr-2 text-blue-600" />
                Công Cụ Quản Trị Dữ Liệu
            </h3>

            <div className="flex flex-col space-y-4">
                <p className="text-sm text-gray-600">
                    Sử dụng công cụ này để khởi tạo dữ liệu mẫu cho hệ thống. Dữ liệu sẽ được đẩy lên Firebase Firestore.
                </p>

                <div className="flex items-center space-x-4">
                    <button
                        onClick={handleSeedData}
                        disabled={loading}
                        className={`flex items-center px-4 py-2 rounded-md text-white font-medium transition-colors ${loading
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Đang xử lý...
                            </>
                        ) : (
                            <>
                                <Database className="w-4 h-4 mr-2" />
                                Khởi tạo dữ liệu mẫu lên Cloud
                            </>
                        )}
                    </button>
                </div>

                {message && (
                    <div className={`p-4 rounded-md flex items-start ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                        }`}>
                        {message.type === 'success' ? (
                            <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                        ) : (
                            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                        )}
                        <span>{message.text}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminTools;
