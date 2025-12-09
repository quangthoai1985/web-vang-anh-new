import { db } from '../firebase';
import { collection, doc, writeBatch, getDoc } from 'firebase/firestore';
import {
    MOCK_USERS,
    MOCK_DOCUMENTS,
    MOCK_SCHOOL_DOCUMENTS,
    MOCK_OFFICE_DOCS,
    MOCK_BOARDING_DOCS,
    MOCK_CLASSES,
    MOCK_FOLDERS
} from '../data/mockData';

export const seedDatabase = async () => {
    const batch = writeBatch(db);
    let operationCount = 0;
    const MAX_BATCH_SIZE = 500;

    const commitBatch = async () => {
        if (operationCount > 0) {
            await batch.commit();
            operationCount = 0;
            // Re-instantiate batch after commit if we were looping, but here we just return
            // In a real large-scale seed, we'd need a new batch object. 
            // For this size, one batch is likely enough, but let's be safe.
        }
    };

    try {
        // 1. Seed Users
        for (const user of MOCK_USERS) {
            const userRef = doc(db, 'users', user.id);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                batch.set(userRef, user);
                operationCount++;
            }
        }

        // 2. Seed Directive Documents
        for (const docItem of MOCK_DOCUMENTS) {
            const docRef = doc(db, 'directive_documents', docItem.id);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                batch.set(docRef, docItem);
                operationCount++;
            }
        }

        // 3. Seed School Documents
        for (const docItem of MOCK_SCHOOL_DOCUMENTS) {
            const docRef = doc(db, 'school_documents', docItem.id);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                batch.set(docRef, docItem);
                operationCount++;
            }
        }

        // 4. Seed Office Documents
        for (const docItem of MOCK_OFFICE_DOCS) {
            const docRef = doc(db, 'office_docs', docItem.id);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                batch.set(docRef, docItem);
                operationCount++;
            }
        }

        // 5. Seed Boarding/Menu Documents
        for (const docItem of MOCK_BOARDING_DOCS) {
            const docRef = doc(db, 'boarding_docs', docItem.id);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                batch.set(docRef, docItem);
                operationCount++;
            }
        }

        // 6. Seed Classes
        for (const classItem of MOCK_CLASSES) {
            const docRef = doc(db, 'classes', classItem.id);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                batch.set(docRef, classItem);
                operationCount++;
            }
        }

        // 7. Seed Class Files (Flattened)
        // We'll use a subcollection structure or a flat collection with classId?
        // Let's use a flat collection 'class_files' with 'classId' field for easier querying across classes if needed,
        // or just stick to the plan: fetch from 'class_files' where classId matches.
        // We need to distribute these files to the classes.
        // For simplicity in this mock migration, let's assign the MOCK_FOLDERS content to ALL classes 
        // or just 'la1' (Lớp Lá 1) as a demo, since MOCK_FOLDERS was hardcoded in ClassRecords.

        const targetClassIds = ['la1', 'la2', 'la3', 'la4', 'choi'];

        for (const classId of targetClassIds) {
            for (const folder of MOCK_FOLDERS) {
                for (const file of folder.files) {
                    // Create a unique ID for the file instance in this class
                    const fileId = `${classId}_${file.id}`;
                    const docRef = doc(db, 'class_files', fileId);
                    const docSnap = await getDoc(docRef);

                    if (!docSnap.exists()) {
                        batch.set(docRef, {
                            ...file,
                            classId: classId,
                            month: folder.id, // Store month ID to reconstruct folders
                            monthName: folder.name
                        });
                        operationCount++;
                    }
                }
            }
        }

        if (operationCount > 0) {
            await batch.commit();
            return `Successfully seeded ${operationCount} documents.`;
        } else {
            return 'Database already seeded. No new documents added.';
        }

    } catch (error) {
        console.error("Error seeding database:", error);
        throw error;
    }
};
