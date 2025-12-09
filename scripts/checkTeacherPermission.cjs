// Script để kiểm tra user document và debug delete permission
// Chạy: node scripts/checkTeacherPermission.cjs

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function checkPermission() {
    console.log('\n=== CHECKING TEACHER PERMISSION ===\n');

    // Tìm giáo viên La Thùy Trân
    const teacherEmail = 'lt.tran@mgvanganh.edu.vn';

    console.log(`🔍 Looking for teacher: ${teacherEmail}\n`);

    // 1. Check Firestore user document
    const usersSnapshot = await db.collection('users').where('email', '==', teacherEmail).get();

    if (usersSnapshot.empty) {
        console.log('❌ User not found in Firestore!');
        return;
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();

    console.log('📄 Firestore User Document:');
    console.log('  UID:', userDoc.id);
    console.log('  Full Name:', userData.fullName);
    console.log('  Email:', userData.email);
    console.log('  Role:', userData.role);
    console.log('  Access Scope:', userData.accessScope);
    console.log('');

    // 2. Check Firebase Auth custom claims
    try {
        const userRecord = await auth.getUserByEmail(teacherEmail);
        console.log('🔐 Firebase Auth Info:');
        console.log('  UID:', userRecord.uid);
        console.log('  Custom Claims:', userRecord.customClaims || 'None');
        console.log('');

        // 3. Check if custom claims match Firestore
        if (!userRecord.customClaims || !userRecord.customClaims.role) {
            console.log('⚠️  WARNING: No custom claims set in Firebase Auth!');
            console.log('   This will cause Firestore rules to fail.');
            console.log('   Need to set custom claims with role and accessScope.');
            console.log('');
        }
    } catch (error) {
        console.log('❌ Error getting Auth user:', error.message);
    }

    // 4. Check files in choi class
    console.log('📁 Files in "choi" class:');
    const filesSnapshot = await db.collection('class_files').where('classId', '==', 'choi').get();

    if (filesSnapshot.empty) {
        console.log('  (No files)');
    } else {
        filesSnapshot.forEach(doc => {
            const data = doc.data();
            console.log(`  - ${data.name}`);
            console.log(`    ID: ${doc.id}`);
            console.log(`    ClassId: "${data.classId}"`);
            console.log('');
        });
    }

    // 5. Simulate rule check
    console.log('🔍 SIMULATING FIRESTORE RULE CHECK:');
    console.log(`  Teacher accessScope: "${userData.accessScope}"`);
    console.log(`  File classId: "choi"`);
    console.log(`  Match: ${userData.accessScope === 'choi' ? '✅ YES' : '❌ NO'}`);
    console.log('');

    // 6. Check if custom claims needed
    console.log('💡 DIAGNOSIS:');
    if (userData.accessScope !== 'choi') {
        console.log('  ❌ accessScope mismatch - Need to fix user data');
    } else {
        console.log('  ✅ accessScope matches classId');
    }

    console.log('\n=== END ===\n');
}

checkPermission()
    .then(() => {
        console.log('Check completed!');
        process.exit(0);
    })
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
