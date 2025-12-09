const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const auth = admin.auth();

const DEFAULT_PASSWORD = 'password123'; // Mật khẩu mặc định cho tất cả user

async function syncAuthUsers() {
    console.log("🚀 Bắt đầu đồng bộ User từ Firestore sang Authentication...");

    try {
        // 1. Lấy tất cả users từ Firestore
        const usersSnapshot = await db.collection('users').get();

        if (usersSnapshot.empty) {
            console.log("⚠️ Không tìm thấy user nào trong Firestore.");
            return;
        }

        let createdCount = 0;
        let updatedCount = 0;
        let errorCount = 0;

        // 2. Duyệt qua từng user
        for (const doc of usersSnapshot.docs) {
            const userData = doc.data();
            const uid = doc.id; // ID từ Firestore (ví dụ: 'u1', 'u2')
            const email = userData.email;
            const displayName = userData.fullName || userData.username;
            const role = userData.role;

            if (!email) {
                console.log(`⚠️ User ${uid} không có email. Bỏ qua.`);
                continue;
            }

            try {
                // Kiểm tra xem user đã tồn tại trong Auth chưa
                try {
                    await auth.getUser(uid);
                    // Nếu tồn tại, update thông tin (nếu cần)
                    await auth.updateUser(uid, {
                        email: email,
                        displayName: displayName,
                        // password: DEFAULT_PASSWORD // Uncomment nếu muốn reset password
                    });
                    // Set Custom Claim luôn
                    await auth.setCustomUserClaims(uid, { role: role });
                    console.log(`✅ Đã cập nhật user: ${email} (${role})`);
                    updatedCount++;
                } catch (error) {
                    if (error.code === 'auth/user-not-found') {
                        // Nếu chưa tồn tại, tạo mới
                        await auth.createUser({
                            uid: uid, // Force UID giống Firestore
                            email: email,
                            password: DEFAULT_PASSWORD,
                            displayName: displayName
                        });
                        // Set Custom Claim
                        await auth.setCustomUserClaims(uid, { role: role });
                        console.log(`🎉 Đã tạo mới user: ${email} (Pass: ${DEFAULT_PASSWORD})`);
                        createdCount++;
                    } else {
                        throw error;
                    }
                }
            } catch (error) {
                console.error(`❌ Lỗi xử lý user ${email}:`, error.message);
                errorCount++;
            }
        }

        console.log("\n-----------------------------------");
        console.log(`📊 Tổng kết:`);
        console.log(`- Tạo mới: ${createdCount}`);
        console.log(`- Cập nhật: ${updatedCount}`);
        console.log(`- Lỗi: ${errorCount}`);
        console.log(`\n🔑 Mật khẩu mặc định cho user mới: ${DEFAULT_PASSWORD}`);
        console.log("-----------------------------------");

    } catch (error) {
        console.error("❌ Lỗi chương trình:", error);
    }
}

syncAuthUsers();
