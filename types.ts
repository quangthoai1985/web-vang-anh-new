import { LucideIcon } from 'lucide-react';

export interface DashboardCardData {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  colorClass: string; // Tailwind text color class
  bgClass: string; // Tailwind bg gradient class
  hoverClass: string;
  stats?: string; // Placeholder for "12 Documents" etc.
}

// Updated Roles based on requirements
export type UserRole = 'admin' | 'principal' | 'vice_principal' | 'head_teacher' | 'vice_head_teacher' | 'teacher' | 'staff' | 'office_head';

// Trạng thái phê duyệt kế hoạch
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'needs_revision';

// Chi tiết phê duyệt - lưu vào kế hoạch
export interface ApprovalInfo {
  status: ApprovalStatus;
  reviewerId?: string;      // ID người duyệt
  reviewerName?: string;    // Tên người duyệt
  reviewerRole?: UserRole;  // Vai trò người duyệt
  reviewedAt?: string;      // Thời điểm duyệt (ISO String)
  rejectionReason?: string; // Lý do từ chối (nếu rejected)
}

export interface User {
  name: string;
  avatar: string;
  role: UserRole;
}

export interface UserAccount {
  id: string;
  username: string;
  email: string;
  password?: string;
  fullName: string;
  role: UserRole; // Updated to use the specific type
  roleLabel: string; // Display name for the role (e.g., "Hiệu Trưởng")
  group: string;
  accessScope?: string; // Optional: specific class ID (e.g., 'la1')
  permissions?: string[]; // List of specific permissions (e.g., 'manage_documents')
  status: 'active' | 'inactive';
  avatar?: string;
}

export interface DirectiveDocument {
  id: string;
  trichYeu: string;
  soKyHieu: string;
  coQuanBanHanh: string;
  ngayBanHanh: string;
  loaiVanBan: string;
  tomTatNoiDung?: string;
  fileDinhKemUrl: string;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  content: string;
  timestamp: string;
  type?: 'comment' | 'response' | 'request';  // comment = góp ý, response = phản hồi, request = yêu cầu sửa
  editedAt?: string;
}

export interface OfficeDocument {
  id: string;
  name: string;
  type: 'excel' | 'word' | 'pdf' | 'other';
  category: 'finance' | 'medical' | 'general' | 'menu' | 'food_safety' | 'nutrition';
  uploader: {
    id: string;
    name: string;
    role: string;
    avatar?: string;
  };
  uploadDate: string;
  comments: Comment[];
  fileUrl: string;
}

export interface Notification {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  targetPath: string;
  message: string;
  type: 'upload' | 'comment' | 'system';
  isRead: boolean;
  createdAt: string; // ISO String
  receivers: string[];
  metadata?: {
    fileType?: 'word' | 'pdf' | 'excel' | 'image';
    fileName?: string;
  };
}

export interface ClassFile {
  id: string;
  name: string;
  type: 'word' | 'excel' | 'pdf' | 'image';
  date: string;
  uploader: string;
  uploaderId?: string;
  hasNewComments: boolean;
  commentCount: number;
  comments?: Comment[];
  planType?: 'year' | 'month' | 'week';
  week?: string;
  category?: 'plan' | 'assessment' | 'steam' | 'students';
}

export interface MonthFolder {
  id: string;
  name: string;
  fileCount: number;
  files: ClassFile[];
}