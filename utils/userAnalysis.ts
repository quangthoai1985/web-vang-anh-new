import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

export async function listAllUsers() {
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));

        const users: any[] = [];
        usersSnapshot.forEach(doc => {
            users.push({ id: doc.id, ...doc.data() });
        });

        // Group by role
        const usersByRole = {
            admin: [] as any[],
            vice_principal: [] as any[],
            head_teacher: [] as any[],
            vice_head_teacher: [] as any[],
            teacher: [] as any[],
            office_head: [] as any[],
            staff: [] as any[]
        };

        users.forEach(user => {
            const role = user.role || 'unknown';
            if (usersByRole[role as keyof typeof usersByRole]) {
                usersByRole[role as keyof typeof usersByRole].push(user);
            }
        });

        return {
            total: users.length,
            byRole: usersByRole,
            allUsers: users
        };
    } catch (error) {
        console.error('Error listing users:', error);
        throw error;
    }
}

export function analyzeAffectedUsers(usersByRole: any) {
    const affectedUsers = [
        ...usersByRole.office_head,
        ...usersByRole.staff
    ];

    const analysis = affectedUsers.map(user => {
        const hasManageOffice = (user.permissions || []).includes('manage_office_docs');
        const hasManageBoarding = (user.permissions || []).includes('manage_boarding_docs');
        const hasAnyPermission = hasManageOffice || hasManageBoarding;

        return {
            fullName: user.fullName,
            username: user.username,
            email: user.email,
            role: user.role,
            roleLabel: user.roleLabel,
            group: user.group,
            accessScope: user.accessScope,
            permissions: user.permissions || [],
            status: user.status,
            hadPermissionBefore: hasAnyPermission,
            wasAffected: !hasAnyPermission
        };
    });

    return {
        totalAffected: affectedUsers.length,
        usersWithoutPermissions: analysis.filter(u => u.wasAffected).length,
        usersWithPermissions: analysis.filter(u => u.hadPermissionBefore).length,
        details: analysis
    };
}
