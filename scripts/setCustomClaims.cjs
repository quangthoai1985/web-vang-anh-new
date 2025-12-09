const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function setCustomClaims() {
    console.log("🚀 Bắt đầu thiết lập Custom Claims (với accessScope)...\n");

    try {
        const usersSnapshot = await db.collection('users').get();

        if (usersSnapshot.empty) {
            console.log("⚠️ Không tìm thấy user nào trong Firestore.");
            return;
        }

        let count = 0;
        const updates = [];

        for (const doc of usersSnapshot.docs) {
            const userData = doc.data();
            const uid = doc.id;
            const role = userData.role;
            const accessScope = userData.accessScope;

            if (!role) {
                console.log(`⚠️ User ${uid} (${userData.email}) không có role. Bỏ qua.`);
                continue;
            }

            // Set custom claims với role VÀ accessScope
            const claims = {
                role: role,
                accessScope: accessScope || '' // Thêm accessScope nếu có
            };

            const updatePromise = auth.setCustomUserClaims(uid, claims)
                .then(() => {
                    console.log(`✅ ${userData.email}`);
                    console.log(`   Claims: { role: '${role}', accessScope: '${accessScope || 'N/A'}' }`);
                    count++;
                })
                .catch(error => {
                    console.error(`❌ Lỗi set claim cho user ${userData.email}:`, error.message);
                });

            updates.push(updatePromise);
        }

        await Promise.all(updates);

        console.log(`\n🎉 Hoàn tất! Đã cập nhật Custom Claims cho ${count} người dùng.`);
        console.log("👉 Lưu ý: User cần đăng xuất và đăng nhập lại để claim có hiệu lực.\n");

    } catch (error) {
        console.error("❌ Lỗi chương trình:", error);
    }
}

setCustomClaims()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
