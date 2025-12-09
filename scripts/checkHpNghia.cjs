const admin = require('firebase-admin');
const serviceAccount = require('../vang-anh-bd21c-firebase-adminsdk-key.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkUser() {
    try {
        console.log('Checking user hp.nghia...\n');

        // Find user by username
        const usersSnapshot = await db.collection('users').where('username', '==', 'hp.nghia').get();

        if (usersSnapshot.empty) {
            console.log('❌ User hp.nghia NOT FOUND');
            return;
        }

        const userDoc = usersSnapshot.docs[0];
        const userData = userDoc.data();

        console.log('✅ User found:');
        console.log(`   ID: ${userDoc.id}`);
        console.log(`   Username: ${userData.username}`);
        console.log(`   Full Name: ${userData.fullName}`);
        console.log(`   Email: ${userData.email}`);
        console.log(`   Role: ${userData.role}`);
        console.log(`   Role Label: ${userData.roleLabel}`);
        console.log(`   Group: ${userData.group}`);
        console.log(`   Access Scope: ${userData.accessScope}`);
        console.log(`   Permissions: ${JSON.stringify(userData.permissions || [])}`);
        console.log(`   Status: ${userData.status}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

checkUser();
