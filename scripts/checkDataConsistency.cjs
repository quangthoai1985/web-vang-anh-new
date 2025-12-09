// Check data consistency between users and classes
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkConsistency() {
    console.log('\n=== CHECKING DATA CONSISTENCY ===\n');

    // 1. Fetch all classes
    const classesSnapshot = await db.collection('classes').get();
    const classIds = new Set();
    const classData = {};

    console.log('📚 CLASSES IN DATABASE:');
    classesSnapshot.forEach(doc => {
        const data = doc.data();
        classIds.add(doc.id);
        classData[doc.id] = data;
        console.log(`  - ID: "${doc.id}" -> Name: "${data.name}"`);
    });

    // 2. Fetch all teachers
    const teachersSnapshot = await db.collection('users').where('role', '==', 'teacher').get();

    console.log('\n\n👨‍🏫 TEACHERS AND THEIR ACCESS SCOPE:');
    const mismatches = [];

    teachersSnapshot.forEach(doc => {
        const data = doc.data();
        const scope = data.accessScope;
        const isValid = classIds.has(scope);

        console.log(`\n  Teacher: ${data.fullName}`);
        console.log(`    Email: ${data.email}`);
        console.log(`    AccessScope: "${scope}"`);
        console.log(`    Valid: ${isValid ? '✅' : '❌'}`);

        if (!isValid) {
            mismatches.push({
                id: doc.id,
                name: data.fullName,
                email: data.email,
                currentScope: scope,
                suggestedScope: findSimilarClass(scope, classData)
            });
        }
    });

    // 3. Report mismatches
    if (mismatches.length > 0) {
        console.log('\n\n⚠️  FOUND MISMATCHES:');
        console.log('=====================================');
        mismatches.forEach((m, idx) => {
            console.log(`\n${idx + 1}. ${m.name} (${m.email})`);
            console.log(`   Current accessScope: "${m.currentScope}"`);
            console.log(`   Suggested fix: "${m.suggestedScope}"`);
        });

        console.log('\n\n💡 TO FIX: Run the appropriate fix script or update manually in SystemAdmin UI');
    } else {
        console.log('\n\n✅ ALL TEACHERS HAVE VALID ACCESS SCOPE!');
    }

    console.log('\n=== END CHECK ===\n');
}

function findSimilarClass(scope, classData) {
    const scopeLower = scope.toLowerCase();

    // Try exact match (case insensitive)
    for (const [id, data] of Object.entries(classData)) {
        if (id.toLowerCase() === scopeLower) return id;
        if (data.name.toLowerCase() === scopeLower) return id;
    }

    // Try fuzzy match
    for (const [id, data] of Object.entries(classData)) {
        if (scopeLower.includes(id.toLowerCase()) || id.toLowerCase().includes(scopeLower)) {
            return id;
        }
        if (scopeLower.includes(data.name.toLowerCase()) || data.name.toLowerCase().includes(scopeLower)) {
            return id;
        }
    }

    // If no match, return first class as default
    return Object.keys(classData)[0] || 'choi';
}

checkConsistency()
    .then(() => {
        console.log('Check completed!');
        process.exit(0);
    })
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
