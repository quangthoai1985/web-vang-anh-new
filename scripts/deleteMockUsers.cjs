/**
 * Script: Xóa Mock Users - Chỉ giữ lại users thật
 * 
 * Script này sẽ:
 * 1. Xóa tất cả users có ID từ u1-u6 (mock data)
 * 2. Giữ lại các users thật (có UID từ Firebase Auth)
 * 3. Backup danh sách users đã xóa
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Danh sách Mock User IDs cần xóa (từ mockData.ts)
const MOCK_USER_IDS = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'];

async function deleteMockUsers() {
    console.log('🗑️  BẮT ĐẦU XÓA MOCK USERS...\n');

    const deletedUsers = [];
    const errors = [];

    for (const userId of MOCK_USER_IDS) {
        try {
            // 1. Đọc thông tin user trước khi xóa (để backup)
            const userRef = db.collection('users').doc(userId);
            const userDoc = await userRef.get();

            if (userDoc.exists) {
                const userData = userDoc.data();
                deletedUsers.push({ id: userId, ...userData });

                // 2. Xóa user khỏi Firestore
                await userRef.delete();
                console.log(`✅ Đã xóa user: ${userId} (${userData.fullName})`);

                // 3. Thử xóa khỏi Firebase Auth (nếu có)
                try {
                    await admin.auth().deleteUser(userId);
                    console.log(`   └─ Đã xóa khỏi Firebase Auth`);
                } catch (authError) {
                    // User có thể không tồn tại trong Auth (vì mock data dùng custom ID)
                    console.log(`   └─ Không tồn tại trong Auth (skip)`);
                }
            } else {
                console.log(`⚠️  User ${userId} không tồn tại trong Firestore (đã xóa rồi?)`);
            }
        } catch (error) {
            console.error(`❌ Lỗi khi xóa user ${userId}:`, error.message);
            errors.push({ userId, error: error.message });
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 TỔNG KẾT:');
    console.log(`   - Đã xóa: ${deletedUsers.length} users`);
    console.log(`   - Lỗi: ${errors.length} users`);
    console.log('='.repeat(60) + '\n');

    // Kiểm tra users còn lại
    const remainingUsers = await db.collection('users').get();
    console.log('👥 USERS CÒN LẠI (Real users):');

    if (remainingUsers.empty) {
        console.log('   ⚠️  KHÔNG CÒN USER NÀO! (Database trống)');
    } else {
        remainingUsers.forEach(doc => {
            const data = doc.data();
            console.log(`   ✓ ${doc.id}: ${data.fullName} (${data.roleLabel})`);
        });
    }

    // Backup deleted users
    if (deletedUsers.length > 0) {
        console.log('\n💾 BACKUP USERS ĐÃ XÓA:');
        console.log('   File: deleted-mock-users-backup.json');

        const fs = require('fs');
        const backupPath = './deleted-mock-users-backup.json';
        fs.writeFileSync(
            backupPath,
            JSON.stringify({ deletedAt: new Date().toISOString(), users: deletedUsers }, null, 2)
        );
        console.log('   ✅ Đã lưu backup');
    }

    console.log('\n✅ HOÀN THÀNH!\n');
}

// Chạy script
deleteMockUsers()
    .then(() => {
        console.log('Script kết thúc thành công.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Script thất bại:', error);
        process.exit(1);
    });
