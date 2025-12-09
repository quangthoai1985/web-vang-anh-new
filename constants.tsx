import { 
  FileText, 
  Building2, 
  Users, 
  Briefcase, 
  BookOpen,
  LayoutDashboard,
  ShieldCheck
} from 'lucide-react';
import { DashboardCardData } from './types';

export const DASHBOARD_CARDS: DashboardCardData[] = [
  {
    id: 'quan-tri-he-thong',
    title: "QUẢN TRỊ HỆ THỐNG",
    description: "Quản lý tài khoản, phân quyền người dùng và cấu hình hệ thống.",
    icon: ShieldCheck,
    colorClass: "text-slate-700",
    bgClass: "from-slate-100 to-slate-200",
    hoverClass: "hover:shadow-slate-300 hover:border-slate-400",
    stats: "Dành cho Admin"
  }
];

export const APP_NAME = "TRỤC DỮ LIỆU TRƯỜNG MẪU GIÁO VÀNG ANH";