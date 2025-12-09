const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Triggered when a user document is updated in the 'users' collection.
 * Checks if the email field has changed and updates the Firebase Auth user accordingly.
 */
exports.syncUserEmail = functions.firestore
    .document("users/{userId}")
    .onUpdate(async (change, context) => {
        const newData = change.after.data();
        const oldData = change.before.data();
        const userId = context.params.userId;

        // Check if email has changed
        if (newData.email === oldData.email) {
            return null;
        }

        const newEmail = newData.email;
        console.log(`Email changed for user ${userId}. Updating Auth...`);

        try {
            await admin.auth().updateUser(userId, {
                email: newEmail,
            });
            console.log(`Successfully updated email for user ${userId} to ${newEmail}`);
        } catch (error) {
            console.error(`Error updating email for user ${userId}:`, error);
            // Optional: Revert Firestore change if Auth update fails? 
            // For now, we just log the error.
        }

        return null;
    });

/**
 * Callable function for Admins to reset user passwords.
 */
exports.adminResetPassword = functions.https.onCall(async (data, context) => {
    // 1. Check if requester is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'The function must be called while authenticated.'
        );
    }

    // 2. Check if requester is Admin (using Custom Claims for speed/security)
    // Note: We rely on Custom Claims here. If not set, we might need to check Firestore.
    // Let's check both to be safe during transition.
    const requesterUid = context.auth.uid;
    const requesterToken = context.auth.token;

    let isAdmin = requesterToken.role === 'admin';

    if (!isAdmin) {
        // Fallback: Check Firestore
        const userDoc = await admin.firestore().collection('users').doc(requesterUid).get();
        if (userDoc.exists && userDoc.data().role === 'admin') {
            isAdmin = true;
        }
    }

    if (!isAdmin) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'Only Admins can reset passwords.'
        );
    }

    const { targetUserId, newPassword } = data;

    if (!targetUserId || !newPassword) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'The function must be called with "targetUserId" and "newPassword".'
        );
    }

    try {
        await admin.auth().updateUser(targetUserId, {
            password: newPassword
        });
        return { success: true, message: `Password updated for user ${targetUserId}` };
    } catch (error) {
        console.error("Error updating password:", error);
        throw new functions.https.HttpsError(
            'internal',
            'Unable to update password.',
            error
        );
    }
});

/**
 * Triggered when a user document is updated.
 * Syncs 'role' changes to Custom Claims.
 */
exports.syncUserRole = functions.firestore
    .document("users/{userId}")
    .onUpdate(async (change, context) => {
        const newData = change.after.data();
        const oldData = change.before.data();
        const userId = context.params.userId;

        if (newData.role === oldData.role) return null;

        console.log(`Role changed for user ${userId} to ${newData.role}. Updating Custom Claims...`);

        try {
            await admin.auth().setCustomUserClaims(userId, { role: newData.role });
        } catch (error) {
            console.error("Error setting custom claims:", error);
        }
        return null;
    });

/**
 * Public function to lookup email by username (for Login).
 * Allows unauthenticated access.
 */
exports.getEmailByUsername = functions.https.onCall(async (data, context) => {
    const { username } = data;
    if (!username) {
        throw new functions.https.HttpsError('invalid-argument', 'Username is required');
    }

    // Query Firestore (Admin SDK bypasses security rules)
    const snapshot = await admin.firestore()
        .collection('users')
        .where('username', '==', username)
        .limit(1)
        .get();

    if (snapshot.empty) {
        throw new functions.https.HttpsError('not-found', 'Username not found');
    }

    const user = snapshot.docs[0].data();
    return { email: user.email };
});
