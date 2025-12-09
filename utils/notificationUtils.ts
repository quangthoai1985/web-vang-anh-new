import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { User, UserRole } from '../types';

// Helper to get Admin UIDs
const getAdminIds = async (): Promise<string[]> => {
    const q = query(collection(db, 'users'), where('role', '==', 'admin'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.id);
};

// Helper to get Head Teacher UIDs
const getHeadTeacherIds = async (): Promise<string[]> => {
    const q = query(collection(db, 'users'), where('role', '==', 'head_teacher'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.id);
};

// Helper to get Group Members (Teachers in the same group)
// Note: This assumes we have a way to identify group. For now, we'll fetch all teachers if needed, 
// or refine based on specific requirements. The requirement says "UID tất cả Giáo viên trong tổ".
// We might need to fetch users by 'group' field if it exists.
const getGroupTeacherIds = async (groupName: string): Promise<string[]> => {
    const q = query(collection(db, 'users'), where('role', '==', 'teacher'), where('group', '==', groupName));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.id);
};

// Helper to get Class Teacher (GVCN) by Class ID
// The requirement says: "UID của Giáo viên chủ nhiệm Lớp Lá 1".
// We assume 'accessScope' in User holds the Class ID (e.g., 'la1').
const getClassTeacherId = async (classId: string): Promise<string[]> => {
    const q = query(collection(db, 'users'), where('role', '==', 'teacher'), where('accessScope', '==', classId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.id);
};


export const createNotification = async (
    actionType: 'upload' | 'comment' | 'system',
    actor: User & { id: string }, // Ensure actor has ID
    resource: {
        type: 'office' | 'class' | 'group' | 'boarding';
        id?: string; // Resource ID (e.g., classId, planId)
        name?: string; // Resource Name (e.g., "Kế hoạch tuần 1")
        targetPath: string; // URL to navigate to
        extraInfo?: any; // E.g., classId for class resources
    }
) => {
    try {
        let receivers: string[] = [];
        const adminIds = await getAdminIds();

        // --- RULE 1: OFFICE DOCUMENTS (VĂN PHÒNG) ---
        // --- RULE 1: OFFICE DOCUMENTS (VĂN PHÒNG) ---
        if (resource.type === 'office') {
            // Upload: Staff -> Admin only
            if (actionType === 'upload' && actor.role === 'staff') {
                receivers = [...adminIds];
            }

            // Comment: Notify Uploader + Admins
            if (actionType === 'comment') {
                const uploaderId = resource.extraInfo?.uploaderId;
                if (uploaderId) {
                    receivers.push(uploaderId);
                }
                // Also notify Admins (so they can monitor)
                receivers = [...receivers, ...adminIds];
            }
        }

        // --- RULE 2: CLASS RECORDS (LỚP HỌC) ---
        else if (resource.type === 'class') {
            const classId = resource.extraInfo?.classId;

            // Teacher uploads -> Admin + Head Teacher
            if (actionType === 'upload' && actor.role === 'teacher') {
                const headTeacherIds = await getHeadTeacherIds();
                receivers = [...adminIds, ...headTeacherIds];
            }

            // Admin/Head Teacher comments -> Class Teacher (GVCN)
            else if (actionType === 'comment' && (actor.role === 'admin' || actor.role === 'head_teacher')) {
                if (classId) {
                    const teacherIds = await getClassTeacherId(classId);
                    receivers = [...teacherIds];
                }
            }
        }

        // --- RULE 3: PROFESSIONAL GROUP (TỔ CHUYÊN MÔN) ---
        else if (resource.type === 'group') {
            // Head Teacher uploads Plan -> Admin + All Teachers in Group
            if (actionType === 'upload' && actor.role === 'head_teacher') {
                // Assuming actor.group is available and correct
                // If actor is Head Teacher, they might manage a group. 
                // Let's assume we send to ALL teachers for now if group is generic, 
                // or specific group if we can determine it.
                // Requirement: "UID Admin] + [UID tất cả Giáo viên trong tổ"
                // We will try to fetch teachers of the same group as the Head Teacher.
                // If actor.group is undefined, maybe fetch all teachers? 
                // Let's be safe and fetch based on actor.group if present.
                const groupName = (actor as any).group;
                if (groupName) {
                    const groupTeacherIds = await getGroupTeacherIds(groupName);
                    receivers = [...adminIds, ...groupTeacherIds];
                } else {
                    // Fallback: Send to all teachers if no group specified? Or just Admins?
                    // Let's send to Admins to be safe.
                    receivers = [...adminIds];
                }
            }
        }

        // --- RULE 4: BOARDING (BÁN TRÚ) ---
        else if (resource.type === 'boarding') {
            // Similar to Office? Staff (Kitchen) -> Admin/Head Teacher?
            // Requirement doesn't explicitly specify Boarding rules in the prompt summary 
            // but implies "Staff (Y tế/Kế toán) tải file lên -> Admin".
            // Let's treat it similar to Office for Staff.
            if (actor.role === 'staff') {
                receivers = [...adminIds];
            }
        }

        // Filter out the sender from receivers (prevent self-notification)
        receivers = receivers.filter(uid => uid !== actor.id);

        // Remove duplicates
        receivers = [...new Set(receivers)];

        if (receivers.length === 0) {
            console.log("No receivers for this notification. Skipping.");
            return;
        }

        // Create Notification Object
        const notificationData = {
            senderId: actor.id,
            senderName: actor.name || actor.role, // Fallback
            senderAvatar: actor.avatar || '',
            targetPath: resource.targetPath,
            message: `${actionType === 'upload' ? 'đã tải lên' : 'đã góp ý vào'} ${resource.name || 'tài liệu'}`,
            type: actionType,
            isRead: false,
            createdAt: new Date().toISOString(),
            receivers: receivers,
            metadata: {
                fileName: resource.name
            }
        };

        await addDoc(collection(db, 'notifications'), notificationData);
        console.log(`Notification sent to ${receivers.length} users.`);

    } catch (error) {
        console.error("Error creating notification:", error);
    }
};
