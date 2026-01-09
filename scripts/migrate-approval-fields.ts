/**
 * Migration Script: Add approval fields to existing documents
 * 
 * Chạy script này một lần để cập nhật các tài liệu cũ với trạng thái "Chờ duyệt"
 * 
 * Cách chạy:
 * 1. Mở terminal
 * 2. cd vào thư mục dự án
 * 3. Chạy lệnh: npx ts-node scripts/migrate-approval-fields.ts
 *    HOẶC: npx tsx scripts/migrate-approval-fields.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';

// Firebase config - copy từ file firebase.ts
const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyBFv5I-hx-WYNHdqwrL4hT839L2zVS3w1A",
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "web-vang-anh.firebaseapp.com",
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "web-vang-anh",
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "web-vang-anh.firebasestorage.app",
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "855789626767",
    appId: process.env.VITE_FIREBASE_APP_ID || "1:855789626767:web:a44c3a1e7c06a3c2ef5d63"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateCollection(collectionName: string) {
    console.log(`\n📂 Đang xử lý collection: ${collectionName}...`);

    const querySnapshot = await getDocs(collection(db, collectionName));
    let updatedCount = 0;
    let skippedCount = 0;

    const batch = writeBatch(db);

    querySnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();

        // Kiểm tra nếu đã có approval field thì bỏ qua
        if (data.approval && data.approval.status) {
            skippedCount++;
            console.log(`  ⏭️  Bỏ qua "${data.title || data.name}" - đã có trạng thái: ${data.approval.status}`);
            return;
        }

        // Thêm approval fields
        const docRef = doc(db, collectionName, docSnapshot.id);
        batch.update(docRef, {
            approval: {
                status: 'pending'  // Chờ duyệt
            },
            // Nếu chưa có uploaderRole, gán mặc định là 'teacher'
            uploaderRole: data.uploaderRole || 'teacher'
        });

        updatedCount++;
        console.log(`  ✅ Cập nhật "${data.title || data.name}"`);
    });

    if (updatedCount > 0) {
        await batch.commit();
        console.log(`\n📊 Kết quả cho ${collectionName}:`);
        console.log(`   - Đã cập nhật: ${updatedCount} tài liệu`);
        console.log(`   - Bỏ qua: ${skippedCount} tài liệu`);
    } else {
        console.log(`\n📊 Không có tài liệu nào cần cập nhật trong ${collectionName}`);
    }

    return { updated: updatedCount, skipped: skippedCount };
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  MIGRATION SCRIPT: Thêm trạng thái "Chờ duyệt" cho tài liệu cũ');
    console.log('═══════════════════════════════════════════════════════════════');

    try {
        // Migrate collection 'plans' (Kế hoạch Tổ Chuyên Môn)
        const plansResult = await migrateCollection('plans');

        // Migrate collection 'class_files' (Hồ sơ Lớp)
        const classFilesResult = await migrateCollection('class_files');

        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('  ✅ HOÀN THÀNH MIGRATION!');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log(`  📁 Plans: ${plansResult.updated} cập nhật, ${plansResult.skipped} bỏ qua`);
        console.log(`  📁 Class Files: ${classFilesResult.updated} cập nhật, ${classFilesResult.skipped} bỏ qua`);
        console.log('═══════════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('\n❌ Lỗi khi chạy migration:', error);
        process.exit(1);
    }

    process.exit(0);
}

main();
