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

const ADMIN_EMAIL = 'admin@mgvanganh.edu.vn';

async function repairAdmin() {
    console.log(`🚀 Bắt đầu sửa lỗi tài khoản Admin (${ADMIN_EMAIL})...`);

    try {
        // 1. Lấy thông tin từ Authentication (Gốc)
        let authUser;
        try {
            authUser = await auth.getUserByEmail(ADMIN_EMAIL);
            console.log(`✅ Tìm thấy Auth User. UID: ${authUser.uid}`);
        } catch (error) {
            console.error("❌ Không tìm thấy tài khoản Auth! Bạn cần tạo tài khoản này trước.");
            return;
        }

        const correctUid = authUser.uid;

        // 2. Tìm hồ sơ trong Firestore (có thể đang sai ID)
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('email', '==', ADMIN_EMAIL).get();

        if (snapshot.empty) {
            console.log("⚠️ Không tìm thấy hồ sơ Firestore nào khớp email. Đang tạo mới...");
            // Tạo mới đúng ID
            await usersRef.doc(correctUid).set({
                id: correctUid,
                email: ADMIN_EMAIL,
                username: 'admin',
                fullName: 'Quản Trị Viên',
                role: 'admin',
                roleLabel: 'Hiệu Trưởng',
                group: 'Ban Giám Hiệu',
                accessScope: 'Toàn trường',
                status: 'active',
                createdAt: new Date().toISOString()
            });
            console.log("✅ Đã tạo hồ sơ mới thành công.");
        } else {
            // Có hồ sơ, kiểm tra xem ID có đúng không
            let foundCorrectDoc = false;

            for (const doc of snapshot.docs) {
                if (doc.id === correctUid) {
                    console.log("✅ Hồ sơ Firestore đã đúng ID.");
                    foundCorrectDoc = true;
                    // Đảm bảo role đúng
                    if (doc.data().role !== 'admin') {
                        await doc.ref.update({ role: 'admin' });
                        console.log("   -> Đã cập nhật lại role = admin");
                    }
                } else {
                    console.log(`⚠️ Phát hiện hồ sơ sai ID: ${doc.id}. Đang chuyển dữ liệu sang ID chuẩn...`);
                    const data = doc.data();
                    // Copy sang ID mới
                    await usersRef.doc(correctUid).set({
                        ...data,
                        id: correctUid // Cập nhật lại field id bên trong
                    });
                    // Xóa ID cũ
                    await doc.ref.delete();
                    console.log(`   -> Đã chuyển từ ${doc.id} sang ${correctUid}`);
                }
            }
        }

        // 3. Cấp lại Custom Claims (Quan trọng nhất)
        await auth.setCustomUserClaims(correctUid, { role: 'admin' });
        console.log("👑 Đã cấp lại quyền Admin (Custom Claims).");

        console.log("\n🎉 SỬA LỖI HOÀN TẤT!");
        console.log("👉 Vui lòng Đăng xuất và Đăng nhập lại để kiểm tra.");

    } catch (error) {
        console.error("❌ Lỗi:", error);
    }
}

repairAdmin();
