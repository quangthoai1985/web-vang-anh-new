import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import useMobile from '../hooks/useMobile';
import {
    BarChart3,
    Upload,
    CheckCircle2,
    Clock,
    MessageSquare,
    Reply,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    Calendar,
    CalendarDays,
    XCircle,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';

interface ClassroomStatsCardProps {
    currentSchoolYear: string;
    classes: any[];
}

interface ClassDetailedStatus {
    classId: string;
    className: string;
    // Upload stats
    hasWeekPlan: boolean;
    hasMonthPlan: boolean;
    weekPlanCount: number;
    monthPlanCount: number;
    // Approval stats per class
    weekApprovedCount: number;
    weekPendingCount: number;
    monthApprovedCount: number;
    monthPendingCount: number;
}

interface PlanTypeStats {
    approvedCount: number;
    pendingCount: number;
    revisionCount: number;
    respondedCount: number;
}

interface StatsData {
    totalClasses: number;
    classStatuses: ClassDetailedStatus[];
    classesWithWeekPlan: number;
    classesWithMonthPlan: number;
    weekPlanStats: PlanTypeStats;
    monthPlanStats: PlanTypeStats;
}

const ClassroomStatsCard: React.FC<ClassroomStatsCardProps> = ({ currentSchoolYear, classes }) => {
    const isMobile = useMobile();
    const [stats, setStats] = useState<StatsData>({
        totalClasses: 0,
        classStatuses: [],
        classesWithWeekPlan: 0,
        classesWithMonthPlan: 0,
        weekPlanStats: { approvedCount: 0, pendingCount: 0, revisionCount: 0, respondedCount: 0 },
        monthPlanStats: { approvedCount: 0, pendingCount: 0, revisionCount: 0, respondedCount: 0 }
    });
    const [showUploadDetail, setShowUploadDetail] = useState(false);
    const [showApprovalDetail, setShowApprovalDetail] = useState(false);
    const [activeTab, setActiveTab] = useState<'week' | 'month'>('week');
    const [loading, setLoading] = useState(true);

    // Get current month info
    const now = new Date();
    const systemMonth = (now.getMonth() + 1).toString().padStart(2, '0');
    const systemYear = now.getFullYear();

    // Selected month state - default to current system month
    const [selectedMonth, setSelectedMonth] = useState(systemMonth);
    const [selectedYear, setSelectedYear] = useState(systemYear);

    // --- NEW: Fetch Approver Info ---
    const [approvers, setApprovers] = useState<{
        vicePrincipals: any[];
        headTeachers: any[]; // List of all head/vice head teachers
        headTeacherScopes: string[]; // accessScope của Tổ trưởng/Phó (lớp của họ)
    }>({ vicePrincipals: [], headTeachers: [], headTeacherScopes: [] });

    useEffect(() => {
        const qUsers = query(
            collection(db, 'users'),
            where('role', 'in', ['vice_principal', 'head_teacher', 'vice_head_teacher'])
        );

        const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
            const users = snapshot.docs.map(doc => doc.data());

            const vps = users.filter((u: any) => u.role === 'vice_principal');

            const heads = users.filter((u: any) => ['head_teacher', 'vice_head_teacher'].includes(u.role));
            const scopes = heads.map((u: any) => u.accessScope).filter(Boolean);

            setApprovers({ vicePrincipals: vps, headTeachers: heads, headTeacherScopes: scopes });
        });

        return () => unsubscribeUsers();
    }, []);

    const monthNames: { [key: string]: string } = {
        '01': 'Tháng 1', '02': 'Tháng 2', '03': 'Tháng 3', '04': 'Tháng 4',
        '05': 'Tháng 5', '06': 'Tháng 6', '07': 'Tháng 7', '08': 'Tháng 8',
        '09': 'Tháng 9', '10': 'Tháng 10', '11': 'Tháng 11', '12': 'Tháng 12'
    };

    // Month navigation helpers
    const navigateMonth = (direction: 'prev' | 'next') => {
        let newMonth = parseInt(selectedMonth);
        let newYear = selectedYear;

        if (direction === 'prev') {
            newMonth--;
            if (newMonth < 1) {
                newMonth = 12;
                newYear--;
            }
        } else {
            newMonth++;
            if (newMonth > 12) {
                newMonth = 1;
                newYear++;
            }
        }

        setSelectedMonth(newMonth.toString().padStart(2, '0'));
        setSelectedYear(newYear);
    };

    useEffect(() => {
        if (!currentSchoolYear || classes.length === 0) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'class_files'),
            where('category', '==', 'plan')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allFiles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

            // Filter by school year - default to '2025-2026' for legacy files
            const files = allFiles.filter(file => {
                const fileSchoolYear = file.schoolYear || '2025-2026';
                return fileSchoolYear === currentSchoolYear;
            });

            // Filter by selected month
            const currentMonthFiles = files.filter(file => {
                const fileMonth = String(file.month || '').replace('m', '').padStart(2, '0');
                return fileMonth === selectedMonth;
            });

            // Separate by planType
            const weekPlanFiles = currentMonthFiles.filter(f => f.planType === 'week');
            const monthPlanFiles = currentMonthFiles.filter(f => f.planType === 'month');

            // Build detailed status for each class
            const classStatuses: ClassDetailedStatus[] = classes.map(cls => {
                const classWeekFiles = weekPlanFiles.filter(f => f.classId === cls.id);
                const classMonthFiles = monthPlanFiles.filter(f => f.classId === cls.id);

                return {
                    classId: cls.id,
                    className: cls.name,
                    hasWeekPlan: classWeekFiles.length > 0,
                    hasMonthPlan: classMonthFiles.length > 0,
                    weekPlanCount: classWeekFiles.length,
                    monthPlanCount: classMonthFiles.length,
                    weekApprovedCount: classWeekFiles.filter(f => f.approval?.status === 'approved').length,
                    weekPendingCount: classWeekFiles.filter(f => !f.approval?.status || f.approval?.status === 'pending').length,
                    monthApprovedCount: classMonthFiles.filter(f => f.approval?.status === 'approved').length,
                    monthPendingCount: classMonthFiles.filter(f => !f.approval?.status || f.approval?.status === 'pending').length,
                };
            });

            // Calculate overall stats
            const calculatePlanStats = (planFiles: any[]): PlanTypeStats => {
                const approved = planFiles.filter(f => f.approval?.status === 'approved').length;
                const pending = planFiles.filter(f => !f.approval?.status || f.approval?.status === 'pending').length;
                const revisionFiles = planFiles.filter(f => f.approval?.status === 'needs_revision');
                const revision = revisionFiles.length;
                const responded = revisionFiles.filter(file => {
                    const comments = file.comments || [];
                    const hasRequest = comments.some((c: any) => c.type === 'request');
                    const hasResponse = comments.some((c: any) => c.type === 'response');
                    return hasRequest && hasResponse;
                }).length;

                return { approvedCount: approved, pendingCount: pending, revisionCount: revision, respondedCount: responded };
            };

            setStats({
                totalClasses: classes.length,
                classStatuses,
                classesWithWeekPlan: classStatuses.filter(c => c.hasWeekPlan).length,
                classesWithMonthPlan: classStatuses.filter(c => c.hasMonthPlan).length,
                weekPlanStats: calculatePlanStats(weekPlanFiles),
                monthPlanStats: calculatePlanStats(monthPlanFiles)
            });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentSchoolYear, classes, selectedMonth]);

    const currentStats = activeTab === 'week' ? stats.weekPlanStats : stats.monthPlanStats;
    const currentUploadCount = activeTab === 'week' ? stats.classesWithWeekPlan : stats.classesWithMonthPlan;

    // Get class list for current tab
    const uploadedClasses = stats.classStatuses.filter(c => activeTab === 'week' ? c.hasWeekPlan : c.hasMonthPlan);
    const missingClasses = stats.classStatuses.filter(c => activeTab === 'week' ? !c.hasWeekPlan : !c.hasMonthPlan);

    if (loading) {
        return (
            <div className={`group relative overflow-hidden ${isMobile ? 'rounded-xl' : 'rounded-2xl'} border border-teal-100 bg-white shadow-lg p-6`}>
                <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
                </div>
            </div>
        );
    }

    const getReviewerName = (clsId: string, type: 'week' | 'month') => {
        if (type === 'month') {
            // Kế hoạch Tháng -> Phó Hiệu trưởng duyệt tất cả
            return approvers.vicePrincipals.map(u => u.fullName).join(', ') || 'Chưa có PHT';
        } else {
            // Kế hoạch Tuần:
            // - Nếu lớp này là lớp của Tổ trưởng/Tổ phó (accessScope của họ) -> Phó Hiệu trưởng duyệt
            // - Ngược lại -> Tổ trưởng/Tổ phó duyệt
            const isHeadTeacherClass = approvers.headTeacherScopes.includes(clsId);
            if (isHeadTeacherClass) {
                return approvers.vicePrincipals.map(u => u.fullName).join(', ') || 'Chưa có PHT';
            } else {
                return approvers.headTeachers.map((u: any) => u.fullName).join(', ') || 'Chưa phân công';
            }
        }
    };

    return (
        <div className={`group relative overflow-hidden ${isMobile ? 'rounded-xl' : 'rounded-2xl'} border border-teal-100 bg-white shadow-lg transition-all duration-500 ease-out hover:-translate-y-1 hover:shadow-xl hover:shadow-teal-200 hover:border-teal-300`}>
            {/* Background Decor */}
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-teal-50 to-cyan-100 blur-3xl opacity-50 group-hover:opacity-80 transition-opacity"></div>

            {/* Header */}
            <div className={`${isMobile ? 'p-3' : 'p-5'} relative z-10 bg-gradient-to-r from-teal-500 to-cyan-500`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`${isMobile ? 'h-9 w-9' : 'h-11 w-11'} inline-flex items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm text-white shadow-sm`}>
                            <BarChart3 className={`${isMobile ? 'h-5 w-5' : 'h-6 w-6'}`} />
                        </div>
                        <h3 className={`${isMobile ? 'text-sm' : 'text-base'} font-bold text-white`}>
                            THEO DÕI PHÊ DUYỆT KẾ HOẠCH
                        </h3>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => navigateMonth('prev')}
                            className="p-1 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                        >
                            <ChevronLeft className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} text-white`} />
                        </button>
                        <div className={`${isMobile ? 'px-2 py-0.5 min-w-[90px]' : 'px-3 py-1 min-w-[120px]'} bg-white rounded-full shadow-lg text-center`}>
                            <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-bold text-teal-700`}>
                                {monthNames[selectedMonth]} {selectedYear}
                            </span>
                        </div>
                        <button
                            onClick={() => navigateMonth('next')}
                            className="p-1 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                        >
                            <ChevronRight className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} text-white`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Tab Selector */}
            <div className={`${isMobile ? 'px-3 pt-3' : 'px-5 pt-4'} relative z-10`}>
                <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => { setActiveTab('week'); setShowUploadDetail(false); setShowApprovalDetail(false); }}
                        className={`flex-1 flex items-center justify-center gap-1.5 ${isMobile ? 'py-1.5 text-[10px]' : 'py-2 text-xs'} font-semibold rounded-md transition-all ${activeTab === 'week' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Calendar className={`${isMobile ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} />
                        Kế hoạch Tuần
                    </button>
                    <button
                        onClick={() => { setActiveTab('month'); setShowUploadDetail(false); setShowApprovalDetail(false); }}
                        className={`flex-1 flex items-center justify-center gap-1.5 ${isMobile ? 'py-1.5 text-[10px]' : 'py-2 text-xs'} font-semibold rounded-md transition-all ${activeTab === 'month' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <CalendarDays className={`${isMobile ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} />
                        Kế hoạch Tháng
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className={`${isMobile ? 'p-3' : 'p-5 pt-4'} relative z-10`}>
                <div className={`grid ${isMobile ? 'grid-cols-3 gap-2' : 'grid-cols-3 gap-4'}`}>

                    {/* Upload Stats - Clickable */}
                    <div
                        onClick={() => setShowUploadDetail(!showUploadDetail)}
                        className={`${isMobile ? 'p-2' : 'p-4'} bg-gradient-to-br from-teal-50 to-teal-100/50 rounded-xl border border-teal-100 cursor-pointer hover:shadow-md transition-shadow`}
                    >
                        <div className="flex items-center gap-1.5 mb-2">
                            <Upload className={`${isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-teal-600`} />
                            <span className={`${isMobile ? 'text-[9px]' : 'text-xs'} font-medium text-teal-700 uppercase tracking-wide`}>
                                Tải lên
                            </span>
                        </div>
                        <div className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold text-teal-700`}>
                            {currentUploadCount}/{stats.totalClasses}
                        </div>
                        <button className={`mt-1 flex items-center gap-1 ${isMobile ? 'text-[9px]' : 'text-xs'} text-teal-600 hover:text-teal-800`}>
                            Chi tiết {showUploadDetail ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                    </div>

                    {/* Approval Stats - Clickable */}
                    <div
                        onClick={() => setShowApprovalDetail(!showApprovalDetail)}
                        className={`${isMobile ? 'p-2' : 'p-4'} bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl border border-emerald-100 cursor-pointer hover:shadow-md transition-shadow`}
                    >
                        <div className="flex items-center gap-1.5 mb-2">
                            <CheckCircle2 className={`${isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-emerald-600`} />
                            <span className={`${isMobile ? 'text-[9px]' : 'text-xs'} font-medium text-emerald-700 uppercase tracking-wide`}>
                                Phê duyệt
                            </span>
                        </div>
                        <div className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold text-emerald-700`}>
                            {currentStats.approvedCount}
                        </div>
                        <div className={`flex items-center gap-1 mt-1`}>
                            {currentStats.pendingCount > 0 && (
                                <span className={`flex items-center gap-0.5 ${isMobile ? 'text-[9px]' : 'text-xs'} text-amber-600`}>
                                    <Clock className="h-2.5 w-2.5" /> {currentStats.pendingCount} chờ
                                </span>
                            )}
                        </div>
                        <button className={`mt-1 flex items-center gap-1 ${isMobile ? 'text-[9px]' : 'text-xs'} text-emerald-600 hover:text-emerald-800`}>
                            Chi tiết {showApprovalDetail ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                    </div>

                    {/* Revision Stats */}
                    <div className={`${isMobile ? 'p-2' : 'p-4'} bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-xl border border-orange-100`}>
                        <div className="flex items-center gap-1.5 mb-2">
                            <MessageSquare className={`${isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-orange-600`} />
                            <span className={`${isMobile ? 'text-[9px]' : 'text-xs'} font-medium text-orange-700 uppercase tracking-wide`}>
                                Yêu cầu sửa
                            </span>
                        </div>
                        <div className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold text-orange-700`}>
                            {currentStats.revisionCount}
                        </div>
                        <div className={`flex items-center gap-1 mt-1`}>
                            <Reply className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'} text-blue-500`} />
                            <span className={`${isMobile ? 'text-[9px]' : 'text-xs'} text-blue-600`}>
                                {currentStats.respondedCount} đã phản hồi
                            </span>
                        </div>
                    </div>
                </div>

                {/* Upload Detail Panel */}
                {showUploadDetail && (
                    <div className={`mt-3 ${isMobile ? 'p-2' : 'p-3'} bg-gray-50 rounded-lg border border-gray-200`}>
                        <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-semibold text-gray-700 mb-2`}>
                            Chi tiết tải lên {activeTab === 'week' ? 'kế hoạch tuần' : 'kế hoạch tháng'}:
                        </p>

                        {/* Uploaded Classes */}
                        {uploadedClasses.length > 0 && (
                            <div className="mb-2">
                                <p className={`${isMobile ? 'text-[9px]' : 'text-[10px]'} text-emerald-700 font-medium mb-1 flex items-center gap-1`}>
                                    <CheckCircle2 className="h-3 w-3" /> Đã nộp ({uploadedClasses.length}):
                                </p>
                                <div className="flex flex-wrap gap-1">
                                    {uploadedClasses.map(cls => (
                                        <span
                                            key={cls.classId}
                                            className={`${isMobile ? 'text-[9px] px-1.5 py-0.5' : 'text-xs px-2 py-1'} bg-emerald-100 text-emerald-700 rounded border border-emerald-200 font-medium`}
                                        >
                                            {cls.className} ({activeTab === 'week' ? cls.weekPlanCount : cls.monthPlanCount})
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Missing Classes */}
                        {missingClasses.length > 0 && (
                            <div>
                                <p className={`${isMobile ? 'text-[9px]' : 'text-[10px]'} text-amber-700 font-medium mb-1 flex items-center gap-1`}>
                                    <XCircle className="h-3 w-3" /> Chưa nộp ({missingClasses.length}):
                                </p>
                                <div className="flex flex-wrap gap-1">
                                    {missingClasses.map(cls => (
                                        <span
                                            key={cls.classId}
                                            className={`${isMobile ? 'text-[9px] px-1.5 py-0.5' : 'text-xs px-2 py-1'} bg-amber-100 text-amber-700 rounded border border-amber-200 font-medium`}
                                        >
                                            {cls.className}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Approval Detail Panel */}
                {showApprovalDetail && (
                    <div className={`mt-3 ${isMobile ? 'p-2' : 'p-3'} bg-gray-50 rounded-lg border border-gray-200`}>
                        <div className="flex items-center justify-between mb-2">
                            <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-semibold text-gray-700`}>
                                Chi tiết phê duyệt {activeTab === 'week' ? 'kế hoạch tuần' : 'kế hoạch tháng'}:
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            {stats.classStatuses.map(cls => {
                                const approved = activeTab === 'week' ? cls.weekApprovedCount : cls.monthApprovedCount;
                                const pending = activeTab === 'week' ? cls.weekPendingCount : cls.monthPendingCount;
                                const total = approved + pending;
                                const hasUploaded = activeTab === 'week' ? cls.hasWeekPlan : cls.hasMonthPlan;
                                const reviewerName = getReviewerName(cls.classId, activeTab);

                                return (
                                    <div key={cls.classId} className={`flex items-center justify-between ${isMobile ? 'py-1 px-1.5' : 'py-1.5 px-2'} ${hasUploaded ? 'bg-white' : 'bg-gray-100'} rounded border border-gray-100`}>
                                        <div className="flex flex-col">
                                            <span className={`${isMobile ? 'text-[9px]' : 'text-xs'} font-medium text-gray-700`}>{cls.className}</span>
                                            {/* Reviewer Name */}
                                            <span className={`${isMobile ? 'text-[8px]' : 'text-[10px]'} text-gray-500`}>
                                                Người duyệt: <span className="font-semibold text-teal-600">{reviewerName}</span>
                                            </span>
                                        </div>

                                        {!hasUploaded ? (
                                            <span className={`${isMobile ? 'text-[9px]' : 'text-xs'} text-gray-400 italic`}>Chưa nộp</span>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                {approved > 0 && (
                                                    <span className={`flex items-center gap-0.5 ${isMobile ? 'text-[9px]' : 'text-xs'} text-emerald-600`}>
                                                        <CheckCircle2 className="h-3 w-3" /> {approved} duyệt
                                                    </span>
                                                )}
                                                {pending > 0 && (
                                                    <span className={`flex items-center gap-0.5 ${isMobile ? 'text-[9px]' : 'text-xs'} text-amber-600`}>
                                                        <Clock className="h-3 w-3" /> {pending} chờ
                                                    </span>
                                                )}
                                                {total === 0 && (
                                                    <span className={`${isMobile ? 'text-[9px]' : 'text-xs'} text-gray-400`}>0 kế hoạch</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClassroomStatsCard;
