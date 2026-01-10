/**
 * Script để migrate file cũ với uploaderRole và approval status
 * Chạy: node scripts/migrateClassFilesApproval.cjs
 */

const admin = require('firebase-admin');

// Khởi tạo Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://vang-anh-bd21c.firebaseio.com'
});

const db = admin.firestore();

async function migrateClassFilesApproval() {
    console.log('🔄 Bắt đầu migration class_files...\n');

    try {
        // 1. Lấy tất cả users để map tên → role
        console.log('📋 Đang tải danh sách người dùng...');
        const usersSnapshot = await db.collection('users').get();
        const userMap = {};

        usersSnapshot.forEach(doc => {
            const data = doc.data();
            // Map theo fullName, name, và id
            if (data.fullName) {
                userMap[data.fullName.toLowerCase().trim()] = {
                    id: doc.id,
                    role: data.role,
                    fullName: data.fullName
                };
            }
            if (data.name) {
                userMap[data.name.toLowerCase().trim()] = {
                    id: doc.id,
                    role: data.role,
                    fullName: data.fullName || data.name
                };
            }
            // Also map by email prefix for fallback
            if (data.email) {
                const emailPrefix = data.email.split('@')[0].toLowerCase();
                userMap[emailPrefix] = {
                    id: doc.id,
                    role: data.role,
                    fullName: data.fullName || data.name || emailPrefix
                };
            }
        });

        console.log(`✅ Đã tải ${usersSnapshot.size} người dùng.\n`);

        // 2. Lấy tất cả class_files
        console.log('📁 Đang tải danh sách class_files...');
        const filesSnapshot = await db.collection('class_files').get();
        console.log(`✅ Tìm thấy ${filesSnapshot.size} files.\n`);

        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        // 3. Update từng file
        for (const doc of filesSnapshot.docs) {
            const data = doc.data();
            const updates = {};
            let needsUpdate = false;

            // Check if uploaderRole is missing
            if (!data.uploaderRole && data.uploader) {
                const uploaderKey = data.uploader.toLowerCase().trim();
                const uploaderInfo = userMap[uploaderKey];

                if (uploaderInfo) {
                    updates.uploaderRole = uploaderInfo.role;
                    updates.uploaderId = updates.uploaderId || uploaderInfo.id;
                    needsUpdate = true;
                    console.log(`   ✓ ${doc.id}: ${data.uploader} → ${uploaderInfo.role}`);
                } else {
                    // Default to 'teacher' if can't find
                    updates.uploaderRole = 'teacher';
                    console.log(`   ⚠ ${doc.id}: ${data.uploader} → teacher (mặc định)`);
                    needsUpdate = true;
                }
            }

            // Check if approval is missing or needs update based on comments
            if (!data.approval || !data.approval.status) {
                // If file has comments, set to 'needs_revision' so GV can respond
                const hasComments = data.comments && data.comments.length > 0;
                updates.approval = {
                    status: hasComments ? 'needs_revision' : 'pending'
                };
                if (hasComments) {
                    console.log(`   📝 ${doc.id}: Có góp ý → needs_revision`);
                }
                needsUpdate = true;
            } else if (data.approval.status === 'pending' && data.comments && data.comments.length > 0) {
                // If status is pending but has comments, update to needs_revision
                updates.approval = {
                    ...data.approval,
                    status: 'needs_revision'
                };
                console.log(`   📝 ${doc.id}: pending → needs_revision (có góp ý)`);
                needsUpdate = true;
            }

            // Update comments with missing type field
            if (data.comments && data.comments.length > 0) {
                const updatedComments = data.comments.map(c => ({
                    ...c,
                    type: c.type || 'comment'  // Default old comments to 'comment'
                }));

                // Check if any comment was updated
                const hasUpdatedComments = data.comments.some(c => !c.type);
                if (hasUpdatedComments) {
                    updates.comments = updatedComments;
                    needsUpdate = true;
                }
            }

            // Apply updates
            if (needsUpdate) {
                try {
                    await db.collection('class_files').doc(doc.id).update(updates);
                    updatedCount++;
                } catch (err) {
                    console.error(`   ❌ Lỗi cập nhật ${doc.id}:`, err.message);
                    errorCount++;
                }
            } else {
                skippedCount++;
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log(`✅ Hoàn thành migration!`);
        console.log(`   📝 Đã cập nhật: ${updatedCount} files`);
        console.log(`   ⏭️  Bỏ qua (đã có): ${skippedCount} files`);
        if (errorCount > 0) {
            console.log(`   ❌ Lỗi: ${errorCount} files`);
        }

    } catch (error) {
        console.error('❌ Lỗi migration:', error);
    } finally {
        process.exit(0);
    }
}

migrateClassFilesApproval();
