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

// CẤU HÌNH ADMIN MẶC ĐỊNH
const ADMIN_USER = {
    email: 'admin@mgvanganh.edu.vn',
    password: 'password123', // Bạn nên đổi pass sau khi đăng nhập
    displayName: 'Quản Trị Viên Hệ Thống',
    role: 'admin',
    roleLabel: 'Hiệu Trưởng',
    group: 'Ban Giám Hiệu',
    accessScope: 'Toàn trường'
};

async function createInitialAdmin() {
    console.log("🚀 Bắt đầu tạo tài khoản Admin khởi tạo...");

    try {
        let uid;

        // 1. Tạo hoặc lấy User trong Authentication
        try {
            const userRecord = await auth.getUserByEmail(ADMIN_USER.email);
            console.log(`ℹ️ User Auth đã tồn tại: ${userRecord.email} (UID: ${userRecord.uid})`);
            uid = userRecord.uid;
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                const userRecord = await auth.createUser({
                    email: ADMIN_USER.email,
                    password: ADMIN_USER.password,
                    displayName: ADMIN_USER.displayName
                });
                console.log(`✅ Đã tạo mới User Auth: ${userRecord.email}`);
                uid = userRecord.uid;
            } else {
                throw error;
            }
        }

        // 2. Tạo User trong Firestore (nếu chưa có)
        const userDocRef = db.collection('users').doc(uid);
        const userDoc = await userDocRef.get();

        if (!userDoc.exists) {
            await userDocRef.set({
                id: uid,
                email: ADMIN_USER.email,
                fullName: ADMIN_USER.displayName,
                username: 'admin', // Username để đăng nhập nếu cần
                role: ADMIN_USER.role,
                roleLabel: ADMIN_USER.roleLabel,
                group: ADMIN_USER.group,
                accessScope: ADMIN_USER.accessScope,
                status: 'active',
                createdAt: new Date().toISOString()
            });
            console.log(`✅ Đã tạo hồ sơ Firestore cho Admin.`);
        } else {
            console.log(`ℹ️ Hồ sơ Firestore đã tồn tại. Cập nhật lại quyền...`);
            await userDocRef.update({
                role: ADMIN_USER.role,
                status: 'active'
            });
        }

        // 3. Set Custom Claims (QUAN TRỌNG ĐỂ CÓ QUYỀN CAO NHẤT)
        await auth.setCustomUserClaims(uid, { role: ADMIN_USER.role });
        console.log(`👑 Đã cấp quyền "admin" (Custom Claims) thành công!`);

        console.log("\n---------------------------------------------------");
        console.log("🎉 TÀI KHOẢN ADMIN ĐÃ SẴN SÀNG!");
        console.log(`📧 Email:    ${ADMIN_USER.email}`);
        console.log(`🔑 Password: ${ADMIN_USER.password}`);
        console.log("---------------------------------------------------");

    } catch (error) {
        console.error("❌ Lỗi khi tạo Admin:", error);
    }
}

createInitialAdmin();
