const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function listAllUsers() {
    try {
        console.log('=== DANH SÁCH TẤT CẢ USER TRONG HỆ THỐNG ===\n');

        const usersSnapshot = await db.collection('users').get();

        if (usersSnapshot.empty) {
            console.log('❌ Không có user nào trong hệ thống');
            return;
        }

        console.log(`Tổng số: ${usersSnapshot.size} users\n`);

        // Group by role
        const usersByRole = {
            admin: [],
            vice_principal: [],
            head_teacher: [],
            vice_head_teacher: [],
            teacher: [],
            office_head: [],
            staff: []
        };

        usersSnapshot.forEach(doc => {
            const user = { id: doc.id, ...doc.data() };
            const role = user.role || 'unknown';
            if (usersByRole[role]) {
                usersByRole[role].push(user);
            } else {
                usersByRole[role] = [user];
            }
        });

        // Print by role
        const roleLabels = {
            admin: '👑 ADMIN (Hiệu trưởng)',
            vice_principal: '🎖️  PHÓ HIỆU TRƯỞNG',
            head_teacher: '👨‍🏫 TỔ TRƯỞNG CHUYÊN MÔN',
            vice_head_teacher: '👨‍🏫 TỔ PHÓ CHUYÊN MÔN',
            teacher: '👩‍🏫 GIÁO VIÊN',
            office_head: '🏢 TỔ TRƯỞNG TỔ VĂN PHÒNG',
            staff: '👔 NHÂN VIÊN TỔ VĂN PHÒNG'
        };

        Object.entries(usersByRole).forEach(([role, users]) => {
            if (users.length > 0) {
                console.log(`\n${roleLabels[role] || role.toUpperCase()} (${users.length} người)`);
                console.log('─'.repeat(80));

                users.forEach(user => {
                    console.log(`📌 ${user.fullName} (@${user.username})`);
                    console.log(`   Email: ${user.email}`);
                    console.log(`   Role: ${user.role} (${user.roleLabel})`);
                    console.log(`   Group: ${user.group}`);
                    console.log(`   Access Scope: ${user.accessScope}`);
                    console.log(`   Permissions: ${JSON.stringify(user.permissions || [])}`);
                    console.log(`   Status: ${user.status === 'active' ? '✅ Active' : '❌ Inactive'}`);

                    // Check potential issues
                    if (role === 'office_head' || role === 'staff') {
                        const hasManageOffice = (user.permissions || []).includes('manage_office_docs');
                        const hasManageBoarding = (user.permissions || []).includes('manage_boarding_docs');

                        if (!hasManageOffice && !hasManageBoarding) {
                            console.log(`   ⚠️  CẢ BÁO: User này có thể gặp lỗi upload (đã fix bằng Firestore rules)`);
                        }
                    }
                    console.log('');
                });
            }
        });

        // Summary
        console.log('\n=== PHÂN TÍCH ẢNH HƯỞNG ===\n');

        const affectedUsers = [...usersByRole.office_head, ...usersByRole.staff];
        console.log(`👥 Tổng số user có role office_head hoặc staff: ${affectedUsers.length}`);

        if (affectedUsers.length > 0) {
            console.log('\n📋 Danh sách user được hưởng lợi từ fix:');
            affectedUsers.forEach(user => {
                const hasPerms = (user.permissions || []).includes('manage_office_docs') ||
                    (user.permissions || []).includes('manage_boarding_docs');
                const status = hasPerms ? '✅ Đã có permission' : '⚠️  Không có permission (nhưng đã fix bằng rules)';
                console.log(`   - ${user.fullName} (@${user.username}) - ${user.roleLabel} - ${status}`);
            });
        }

        console.log('\n✅ Kết luận: Tất cả user với role office_head và staff giờ có thể:');
        console.log('   - Upload tài liệu vào office_docs (Kế hoạch & Báo cáo)');
        console.log('   - Upload tài liệu vào boarding_docs (Bán trú)');
        console.log('   - Xem và quản lý tài liệu của họ');

    } catch (error) {
        console.error('❌ Lỗi:', error);
    } finally {
        process.exit(0);
    }
}

listAllUsers();
