/**
 * Script để xóa TẤT CẢ thông báo từ Firestore
 * Chạy: node scripts/deleteAllNotifications.cjs
 */

const admin = require('firebase-admin');

// Khởi tạo Firebase Admin với service account
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://vang-anh-bd21c.firebaseio.com'
});

const db = admin.firestore();

async function deleteAllNotifications() {
    console.log('🗑️  Đang xóa TẤT CẢ thông báo...\n');

    try {
        const notificationsRef = db.collection('notifications');
        const allNotifications = await notificationsRef.get();

        if (allNotifications.empty) {
            console.log('✅ Không có thông báo nào trong hệ thống.');
            return;
        }

        console.log(`🔍 Tìm thấy ${allNotifications.size} thông báo cần xóa.\n`);

        // Xóa từng batch (Firestore giới hạn 500 documents/batch)
        const batchSize = 500;
        let batch = db.batch();
        let count = 0;

        allNotifications.forEach(doc => {
            batch.delete(doc.ref);
            count++;

            if (count % batchSize === 0) {
                batch.commit();
                batch = db.batch();
                console.log(`   Đã xóa ${count} thông báo...`);
            }
        });

        // Commit batch cuối cùng
        if (count % batchSize !== 0) {
            await batch.commit();
        }

        console.log(`\n✅ Đã xóa ${count} thông báo thành công!`);
        console.log('📢 Hệ thống thông báo đã được làm mới hoàn toàn.');

    } catch (error) {
        console.error('❌ Lỗi khi xóa thông báo:', error);
    } finally {
        process.exit(0);
    }
}

deleteAllNotifications();
