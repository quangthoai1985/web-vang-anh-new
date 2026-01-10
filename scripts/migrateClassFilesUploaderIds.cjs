// Migration script to add uploaderId to existing class_files
// Matches uploader name to user fullName and adds their ID

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Check if already initialized
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function migrateClassFilesUploaderIds() {
    console.log('\n=== MIGRATING CLASS FILES UPLOADER IDS ===\n');

    // 1. Fetch all users and create a name-to-id mapping
    const usersSnapshot = await db.collection('users').get();
    const nameToIdMap = {};

    console.log('📋 Building user name-to-id mapping...');
    usersSnapshot.forEach(doc => {
        const data = doc.data();
        const fullName = data.fullName;
        if (fullName) {
            nameToIdMap[fullName] = doc.id;
        }
    });

    console.log(`✅ Found ${Object.keys(nameToIdMap).length} users with fullName\n`);

    // 2. Fetch all class_files
    const filesSnapshot = await db.collection('class_files').get();

    console.log('📄 Processing class_files...\n');

    let updated = 0;
    let skipped = 0;
    let notFound = 0;
    const notFoundUploaders = [];

    for (const fileDoc of filesSnapshot.docs) {
        const data = fileDoc.data();
        const uploader = data.uploader;
        const existingUploaderId = data.uploaderId;

        // Skip if already has uploaderId
        if (existingUploaderId) {
            console.log(`⏭️  SKIP: "${data.name}" - already has uploaderId`);
            skipped++;
            continue;
        }

        // Find matching user
        const userId = nameToIdMap[uploader];

        if (userId) {
            // Update the file with uploaderId
            await db.collection('class_files').doc(fileDoc.id).update({
                uploaderId: userId
            });
            console.log(`✅ UPDATED: "${data.name}"`);
            console.log(`   Uploader: "${uploader}" -> ID: "${userId}"`);
            updated++;
        } else {
            console.log(`❌ NOT FOUND: "${data.name}"`);
            console.log(`   Uploader name: "${uploader}" - No matching user found`);
            notFound++;
            if (uploader && !notFoundUploaders.includes(uploader)) {
                notFoundUploaders.push(uploader);
            }
        }
    }

    // 3. Summary
    console.log('\n\n=== MIGRATION SUMMARY ===');
    console.log(`📊 Total class_files: ${filesSnapshot.size}`);
    console.log(`✅ Updated: ${updated}`);
    console.log(`⏭️  Skipped (already had uploaderId): ${skipped}`);
    console.log(`❌ Not found (no matching user): ${notFound}`);

    if (notFoundUploaders.length > 0) {
        console.log('\n⚠️  Uploaders without matching user:');
        notFoundUploaders.forEach(name => {
            console.log(`   - "${name}"`);
        });
    }

    console.log('\n=== END MIGRATION ===\n');
}

migrateClassFilesUploaderIds()
    .then(() => {
        console.log('Migration completed!');
        process.exit(0);
    })
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
