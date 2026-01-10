// Migration script to add uploaderId to existing plans
// Matches uploader name to user fullName and adds their ID

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateUploaderIds() {
    console.log('\n=== MIGRATING UPLOADER IDS ===\n');

    // 1. Fetch all users and create a name-to-id mapping
    const usersSnapshot = await db.collection('users').get();
    const nameToIdMap = {};

    console.log('📋 Building user name-to-id mapping...');
    usersSnapshot.forEach(doc => {
        const data = doc.data();
        const fullName = data.fullName;
        if (fullName) {
            nameToIdMap[fullName] = doc.id;
            console.log(`  - "${fullName}" -> "${doc.id}"`);
        }
    });

    console.log(`\n✅ Found ${Object.keys(nameToIdMap).length} users with fullName\n`);

    // 2. Fetch all plans
    const plansSnapshot = await db.collection('plans').get();

    console.log('📄 Processing plans...\n');

    let updated = 0;
    let skipped = 0;
    let notFound = 0;
    const notFoundUploaders = [];

    for (const planDoc of plansSnapshot.docs) {
        const data = planDoc.data();
        const uploader = data.uploader;
        const existingUploaderId = data.uploaderId;

        // Skip if already has uploaderId
        if (existingUploaderId) {
            console.log(`⏭️  SKIP: "${data.title}" - already has uploaderId`);
            skipped++;
            continue;
        }

        // Find matching user
        const userId = nameToIdMap[uploader];

        if (userId) {
            // Update the plan with uploaderId
            await db.collection('plans').doc(planDoc.id).update({
                uploaderId: userId
            });
            console.log(`✅ UPDATED: "${data.title}"`);
            console.log(`   Uploader: "${uploader}" -> ID: "${userId}"`);
            updated++;
        } else {
            console.log(`❌ NOT FOUND: "${data.title}"`);
            console.log(`   Uploader name: "${uploader}" - No matching user found`);
            notFound++;
            if (!notFoundUploaders.includes(uploader)) {
                notFoundUploaders.push(uploader);
            }
        }
    }

    // 3. Summary
    console.log('\n\n=== MIGRATION SUMMARY ===');
    console.log(`📊 Total plans: ${plansSnapshot.size}`);
    console.log(`✅ Updated: ${updated}`);
    console.log(`⏭️  Skipped (already had uploaderId): ${skipped}`);
    console.log(`❌ Not found (no matching user): ${notFound}`);

    if (notFoundUploaders.length > 0) {
        console.log('\n⚠️  Uploaders without matching user:');
        notFoundUploaders.forEach(name => {
            console.log(`   - "${name}"`);
        });
        console.log('\n💡 These may be users who were deleted or have different names now.');
    }

    console.log('\n=== END MIGRATION ===\n');
}

migrateUploaderIds()
    .then(() => {
        console.log('Migration completed!');
        process.exit(0);
    })
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
