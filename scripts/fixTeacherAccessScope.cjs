// Script để fix accessScope cho giáo viên - updated version
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Mapping từ các biến thể tên lớp -> classId chuẩn
const CLASS_NAME_VARIATIONS_TO_ID = {
    // Lowercase full names
    'lớp chồi': 'choi',
    'lớp lá 1': 'la1',
    'lớp lá 2': 'la2',
    'lớp lá 3': 'la3',
    'lớp lá 4': 'la4',

    // Title case
    'Lớp Chồi': 'choi',
    'Lớp Lá 1': 'la1',
    'Lớp Lá 2': 'la2',
    'Lớp Lá 3': 'la3',
    'Lớp Lá 4': 'la4',

    // UPPERCASE
    'LỚP CHỒI': 'choi',
    'LỚP LÁ 1': 'la1',
    'LỚP LÁ 2': 'la2',
    'LỚP LÁ 3': 'la3',
    'LỚP LÁ 4': 'la4',

    // Already correct (for safety)
    'choi': 'choi',
    'la1': 'la1',
    'la2': 'la2',
    'la3': 'la3',
    'la4': 'la4'
};

async function fixAccessScope() {
    console.log('\n=== FIXING TEACHER ACCESS SCOPE ===\n');

    // Get all teachers
    const teachersSnapshot = await db.collection('users').where('role', '==', 'teacher').get();

    let updateCount = 0;
    const batch = db.batch();

    teachersSnapshot.forEach(doc => {
        const data = doc.data();
        const currentScope = data.accessScope;

        // Check if need to fix
        const correctId = CLASS_NAME_VARIATIONS_TO_ID[currentScope];

        if (correctId && correctId !== currentScope) {
            console.log(`✏️  Updating ${data.fullName}:`);
            console.log(`   From: "${currentScope}"`);
            console.log(`   To:   "${correctId}"`);

            batch.update(doc.ref, { accessScope: correctId });
            updateCount++;
        } else if (!correctId) {
            console.log(`⚠️  ${data.fullName} has unknown accessScope: "${currentScope}" - SKIPPED`);
        } else {
            console.log(`✅ ${data.fullName} - Already correct: "${currentScope}"`);
        }
    });

    if (updateCount > 0) {
        await batch.commit();
        console.log(`\n✅ Updated ${updateCount} teachers successfully!`);
    } else {
        console.log('\n✅ All teachers already have correct accessScope format!');
    }

    console.log('\n=== DONE ===\n');
}

fixAccessScope()
    .then(() => {
        console.log('Fix completed!');
        process.exit(0);
    })
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
