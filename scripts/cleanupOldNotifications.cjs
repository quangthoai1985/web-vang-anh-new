/**
 * Script để xóa tất cả thông báo cũ từ Firestore
 * Chạy: node scripts/cleanupOldNotifications.cjs
 */

const admin = require('firebase-admin');

// Khởi tạo Firebase Admin với service account
// Lưu ý: Cần tải service account key từ Firebase Console
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://vang-anh-bd21c.firebaseio.com'
});

const db = admin.firestore();

async function cleanupOldNotifications() {
    console.log('🗑️  Đang xóa thông báo cũ...\n');

    try {
        // Lấy ngày hiện tại trừ 7 ngày (giữ lại thông báo trong 7 ngày gần nhất)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        const cutoffISO = cutoffDate.toISOString();

        console.log(`📅 Xóa thông báo trước: ${cutoffDate.toLocaleDateString('vi-VN')}\n`);

        // Query các notification cũ
        const notificationsRef = db.collection('notifications');
        const oldNotifications = await notificationsRef
            .where('createdAt', '<', cutoffISO)
            .get();

        if (oldNotifications.empty) {
            console.log('✅ Không có thông báo cũ cần xóa.');
            return;
        }

        console.log(`🔍 Tìm thấy ${oldNotifications.size} thông báo cũ cần xóa.\n`);

        // Xóa từng document
        const batch = db.batch();
        let count = 0;

        oldNotifications.forEach(doc => {
            batch.delete(doc.ref);
            count++;
            console.log(`   - Xóa: ${doc.id} (${doc.data().message?.substring(0, 50)}...)`);
        });

        await batch.commit();

        console.log(`\n✅ Đã xóa ${count} thông báo cũ thành công!`);

    } catch (error) {
        console.error('❌ Lỗi khi xóa thông báo:', error);
    } finally {
        process.exit(0);
    }
}

cleanupOldNotifications();
