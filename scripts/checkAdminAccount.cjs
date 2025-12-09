// Check admin account in Firestore
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkAdmin() {
    console.log('\n=== CHECKING ADMIN ACCOUNT ===\n');

    // Check for admin accounts
    const usersSnapshot = await db.collection('users').where('role', '==', 'admin').get();

    if (usersSnapshot.empty) {
        console.log('❌ No admin accounts found!');
        return;
    }

    console.log('Found admin accounts:\n');
    usersSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`ID: ${doc.id}`);
        console.log(`  Username: ${data.username}`);
        console.log(`  Email: ${data.email}`);
        console.log(`  Full Name: ${data.fullName}`);
        console.log(`  Role: ${data.role}`);
        console.log(`  Status: ${data.status}`);
        console.log('');
    });

    console.log('=== END CHECK ===\n');
}

checkAdmin()
    .then(() => {
        console.log('Check completed!');
        process.exit(0);
    })
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
