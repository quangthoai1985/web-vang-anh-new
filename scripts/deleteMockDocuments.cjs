/**
 * Script: Xóa Mock Documents - Chỉ giữ lại documents thật
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

// Danh sách Mock Document IDs cần xóa
const MOCK_IDS = {
    directive_documents: ['1', '2', '3', '4', '5'],
    school_documents: ['s1', 's2', 's3', 's4', 's5'],
    office_docs: ['od1', 'od2', 'od3'],
    boarding_docs: ['bd1', 'bd2', 'bd3', 'bd4']
    // KHÔNG xóa classes vì có thể đã được dùng
};

const CLASS_IDS = ['choi', 'la1', 'la2', 'la3', 'la4'];
const FILE_IDS = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9'];

async function deleteCollection(collectionName, docIds) {
    console.log(`\n📂 Xóa collection: ${collectionName}`);
    const deleted = [];

    for (const docId of docIds) {
        try {
            const docRef = db.collection(collectionName).doc(docId);
            const docSnap = await docRef.get();

            if (docSnap.exists) {
                await docRef.delete();
                console.log(`   ✅ ${docId}`);
                deleted.push(docId);
            } else {
                console.log(`   ⚠️  ${docId} (không tồn tại)`);
            }
        } catch (error) {
            console.error(`   ❌ ${docId}: ${error.message}`);
        }
    }

    return { deleted };
}

async function deleteMockClassFiles() {
    console.log(`\n📂 Xóa collection: class_files (mock)`);
    let deletedCount = 0;

    for (const classId of CLASS_IDS) {
        for (const fileId of FILE_IDS) {
            const mockFileId = `${classId}_${fileId}`;
            try {
                const docRef = db.collection('class_files').doc(mockFileId);
                await docRef.delete();
                deletedCount++;
            } catch (error) {
                // Skip
            }
        }
    }

    console.log(`   📊 Đã xóa: ${deletedCount} files`);
    return deletedCount;
}

async function deleteMockDocuments() {
    console.log('🗑️  BẮT ĐẦU XÓA MOCK DOCUMENTS...\n');

    const summary = {};

    // Xóa từng collection
    for (const [collectionName, docIds] of Object.entries(MOCK_IDS)) {
        const result = await deleteCollection(collectionName, docIds);
        summary[collectionName] = result;
    }

    // Xóa class_files
    const classFilesCount = await deleteMockClassFiles();
    summary.class_files = { deleted: classFilesCount };

    // Tổng kết
    console.log('\n' + '='.repeat(60));
    console.log('📊 TỔNG KẾT:');
    let totalDeleted = 0;
    for (const [collection, result] of Object.entries(summary)) {
        const count = Array.isArray(result.deleted) ? result.deleted.length : result.deleted;
        totalDeleted += count;
        console.log(`   ${collection}: ${count} documents`);
    }
    console.log(`\n   TỔNG: ${totalDeleted} documents đã xóa`);
    console.log('='.repeat(60));

    console.log('\n✅ HOÀN THÀNH!\n');
}

deleteMockDocuments()
    .then(() => {
        console.log('Script kết thúc thành công.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Script thất bại:', error);
        process.exit(1);
    });
