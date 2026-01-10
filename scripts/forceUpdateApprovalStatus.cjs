/**
 * Script để FORCE update tất cả files có comments thành needs_revision
 * Chạy: node scripts/forceUpdateApprovalStatus.cjs
 */

const admin = require('firebase-admin');

// Khởi tạo Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://vang-anh-bd21c.firebaseio.com'
});

const db = admin.firestore();

async function forceUpdateApprovalStatus() {
    console.log('🔄 Force update approval status cho files có comments...\n');

    try {
        const filesSnapshot = await db.collection('class_files').get();
        console.log(`📁 Tìm thấy ${filesSnapshot.size} files.\n`);

        let updatedCount = 0;

        for (const doc of filesSnapshot.docs) {
            const data = doc.data();

            // Check if file has comments
            if (data.comments && data.comments.length > 0) {
                const currentStatus = data.approval?.status;

                // If not already 'responded' or 'approved', set to 'needs_revision'
                if (currentStatus !== 'responded' && currentStatus !== 'approved' && currentStatus !== 'rejected') {
                    await db.collection('class_files').doc(doc.id).update({
                        'approval.status': 'needs_revision'
                    });
                    console.log(`   ✅ ${doc.id}: ${data.name?.substring(0, 40)}... → needs_revision`);
                    updatedCount++;
                } else {
                    console.log(`   ⏭️ ${doc.id}: Đã có status ${currentStatus}`);
                }
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log(`✅ Đã cập nhật ${updatedCount} files thành 'needs_revision'`);

    } catch (error) {
        console.error('❌ Lỗi:', error);
    } finally {
        process.exit(0);
    }
}

forceUpdateApprovalStatus();
