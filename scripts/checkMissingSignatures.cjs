const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkMissingSignatures() {
    try {
        const usersSnapshot = await db.collection('users').get();
        if (usersSnapshot.empty) {
            console.log('NO_USERS');
            return;
        }

        const teacherRoles = ['teacher', 'head_teacher', 'vice_head_teacher', 'admin', 'vice_principal'];
        const missingTeachers = [];
        const missingOthers = [];

        usersSnapshot.forEach(doc => {
            const user = { id: doc.id, ...doc.data() };
            if (!user.signatureUrl || user.signatureUrl.trim() === '') {
                if (teacherRoles.includes(user.role)) {
                    missingTeachers.push(user.fullName + ' (@' + user.username + ') - ' + (user.roleLabel || user.role));
                } else {
                    missingOthers.push(user.fullName + ' (@' + user.username + ') - ' + (user.roleLabel || user.role));
                }
            }
        });

        console.log('RESULTS_START');
        console.log('MISSING_TEACHERS:');
        missingTeachers.forEach(name => console.log('- ' + name));
        console.log('MISSING_OTHERS:');
        missingOthers.forEach(name => console.log('- ' + name));
        console.log('RESULTS_END');

    } catch (error) {
        console.error('ERROR:', error);
    } finally {
        process.exit(0);
    }
}

checkMissingSignatures();
