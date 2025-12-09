// Script để kiểm tra và debug data consistency
// Chạy: node scripts/debugClassData.cjs

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function debugClassData() {
    console.log('\n=== DEBUGGING CLASS DATA ===\n');

    // 1. Kiểm tra tất cả teachers
    console.log('📚 TEACHERS:');
    const teachersSnapshot = await db.collection('users').where('role', '==', 'teacher').get();
    teachersSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`  - ${data.fullName}`);
        console.log(`    Email: ${data.email}`);
        console.log(`    AccessScope: "${data.accessScope}"`);
        console.log(`    Role: ${data.role}`);
        console.log('');
    });

    // 2. Kiểm tra tất cả classes
    console.log('\n🏫 CLASSES:');
    const classesSnapshot = await db.collection('classes').get();
    classesSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`  - ID: "${doc.id}"`);
        console.log(`    Name: ${data.name}`);
        console.log(`    Teacher: ${data.teacher || 'N/A'}`);
        console.log('');
    });

    // 3. Kiểm tra class_files
    console.log('\n📄 CLASS FILES:');
    const filesSnapshot = await db.collection('class_files').get();
    if (filesSnapshot.empty) {
        console.log('  (No files yet)');
    } else {
        filesSnapshot.forEach(doc => {
            const data = doc.data();
            console.log(`  - ${data.name}`);
            console.log(`    ClassId: "${data.classId}"`);
            console.log(`    Uploader: ${data.uploader}`);
            console.log('');
        });
    }

    // 4. Tìm mismatch
    console.log('\n⚠️  POTENTIAL MISMATCHES:');
    let foundMismatch = false;

    const classIds = new Set();
    classesSnapshot.forEach(doc => classIds.add(doc.id));

    teachersSnapshot.forEach(doc => {
        const data = doc.data();
        const scope = data.accessScope;

        // Kiểm tra exact match
        if (!classIds.has(scope)) {
            foundMismatch = true;
            console.log(`  ❌ Teacher "${data.fullName}" has accessScope="${scope}" but no class with that ID exists`);

            // Tìm class gần nhất
            const similarClasses = [];
            classesSnapshot.forEach(classDoc => {
                const classId = classDoc.id;
                const className = classDoc.data().name;
                if (classId.toLowerCase().includes(scope.toLowerCase()) ||
                    scope.toLowerCase().includes(classId.toLowerCase()) ||
                    className.toLowerCase().includes(scope.toLowerCase())) {
                    similarClasses.push({ id: classId, name: className });
                }
            });

            if (similarClasses.length > 0) {
                console.log(`    💡 Similar classes found:`);
                similarClasses.forEach(c => {
                    console.log(`       - ID: "${c.id}", Name: "${c.name}"`);
                });
            }
        }
    });

    if (!foundMismatch) {
        console.log('  ✅ All teachers have matching class IDs');
    }

    console.log('\n=== END DEBUG ===\n');
}

debugClassData()
    .then(() => {
        console.log('Debug completed!');
        process.exit(0);
    })
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
