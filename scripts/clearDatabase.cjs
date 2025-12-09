const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

// Danh sách các collection cần xóa
const COLLECTIONS_TO_CLEAR = [
    'users',
    'directive_docs',
    'school_docs',
    'office_docs',
    'boarding_docs',
    'plans',
    'notifications',
    'classes' // Nếu có
];

async function deleteCollection(collectionPath, batchSize) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.orderBy('__name__').limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(db, query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(db, query, resolve) {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
        // When there are no documents left, we are done
        resolve();
        return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();

    // Recurse on the next process tick, to avoid
    // exploding the stack.
    process.nextTick(() => {
        deleteQueryBatch(db, query, resolve);
    });
}

async function clearDatabase() {
    console.log("🔥 Bắt đầu xóa dữ liệu...");

    // Hỏi xác nhận (giả lập, vì chạy script node thường không tương tác)
    // Trong thực tế nên cẩn thận. Ở đây chạy luôn theo yêu cầu.

    for (const collectionName of COLLECTIONS_TO_CLEAR) {
        console.log(`Deleting collection: ${collectionName}...`);
        try {
            await deleteCollection(collectionName, 100);
            console.log(`✅ Đã xóa sạch collection: ${collectionName}`);
        } catch (error) {
            console.error(`❌ Lỗi khi xóa collection ${collectionName}:`, error);
        }
    }

    console.log("\n✨ Hoàn tất! Database đã sạch sẽ.");
}

clearDatabase();
