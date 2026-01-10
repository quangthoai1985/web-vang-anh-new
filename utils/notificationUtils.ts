import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { User, UserRole } from '../types';

const ROLE_NAMES: Record<string, string> = {
    admin: 'Ban Giám Hiệu',
    vice_principal: 'Phó Hiệu Trưởng',
    head_teacher: 'Tổ Trưởng Chuyên Môn',
    vice_head_teacher: 'Tổ Phó Chuyên Môn',
    teacher: 'Giáo Viên',
    staff: 'Nhân Viên',
    office_head: 'Tổ Trưởng Văn Phòng'
};

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
const getGroupTeacherIds = async (groupName: string): Promise<string[]> => {
    const q = query(collection(db, 'users'), where('role', '==', 'teacher'), where('group', '==', groupName));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.id);
};

// Helper to get Class Teacher (GVCN) by Class ID
const getClassTeacherId = async (classId: string): Promise<string[]> => {
    const q = query(collection(db, 'users'), where('role', '==', 'teacher'), where('accessScope', '==', classId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.id);
};


export const createNotification = async (
    actionType: 'upload' | 'comment' | 'system',
    actor: User & { id: string; group?: string }, // Ensure actor has ID and optional group
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

            // Comment notification (Handles both Reviewer -> Teacher and Teacher -> Reviewer)
            else if (actionType === 'comment') {
                // If specific target user is provided (e.g. Reviewer ID when Teacher responds)
                if (resource.extraInfo?.uploaderId) {
                    receivers = [resource.extraInfo.uploaderId];
                }
                // Fallback: If Admin/HT/Vice-HT comments and no specific target, send to all class teachers
                else if (actor.role === 'admin' || actor.role === 'head_teacher' || actor.role === 'vice_head_teacher') {
                    if (classId) {
                        const teacherIds = await getClassTeacherId(classId);
                        receivers = [...teacherIds];
                    }
                }
            }
        }

        // --- RULE 3: PROFESSIONAL GROUP (TỔ CHUYÊN MÔN) ---
        else if (resource.type === 'group') {
            // Head Teacher uploads Plan -> Admin + All Teachers in Group
            if (actionType === 'upload' && actor.role === 'head_teacher') {
                if (actor.group) {
                    const groupTeacherIds = await getGroupTeacherIds(actor.group);
                    receivers = [...adminIds, ...groupTeacherIds];
                } else {
                    receivers = [...adminIds];
                }
            }

            // Comment/System (Approve/Request Revision) -> Notify Uploader
            else if (actionType === 'comment' || actionType === 'system') {
                if (resource.extraInfo?.uploaderId) {
                    receivers.push(resource.extraInfo.uploaderId);
                }
            }
        }

        // --- RULE 4: BOARDING (BÁN TRÚ) ---
        else if (resource.type === 'boarding') {
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

        // Determine Sender Name
        // Priority: fullName -> name -> Role Name -> Role Code
        let finalSenderName = (actor as any).fullName || actor.name;

        // If name is still missing or looks like an internal role code, try to use Vietnamese Role Name
        if (!finalSenderName || finalSenderName === actor.role || finalSenderName === 'head_teacher' || finalSenderName === 'vice_head_teacher') {
            finalSenderName = ROLE_NAMES[actor.role] || actor.role;
        }

        // Create Notification Object
        const notificationData = {
            senderId: actor.id,
            senderName: finalSenderName,
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
