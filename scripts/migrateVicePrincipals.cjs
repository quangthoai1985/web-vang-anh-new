const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function migrateVicePrincipals() {
    console.log("🚀 Starting migration for Vice Principals...");

    try {
        // Query all users with roleLabel "Phó Hiệu Trưởng"
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('roleLabel', '==', 'Phó Hiệu Trưởng').get();

        if (snapshot.empty) {
            console.log("No Vice Principals found to migrate.");
            return;
        }

        let count = 0;
        const batch = db.batch();

        snapshot.forEach(doc => {
            const userData = doc.data();
            // Check if role is NOT 'vice_principal'
            if (userData.role !== 'vice_principal') {
                console.log(`Migrating user: ${userData.fullName} (${doc.id}) from role '${userData.role}' to 'vice_principal'`);

                const docRef = usersRef.doc(doc.id);
                batch.update(docRef, {
                    role: 'vice_principal',
                    // Also update accessScope text if needed to match new UI, but logic is more important
                    accessScope: 'Toàn trường'
                });
                count++;
            }
        });

        if (count > 0) {
            await batch.commit();
            console.log(`✅ Successfully migrated ${count} Vice Principals.`);
        } else {
            console.log("ℹ️ All Vice Principals are already up to date.");
        }

    } catch (error) {
        console.error("❌ Error during migration:", error);
    }
}

migrateVicePrincipals();
