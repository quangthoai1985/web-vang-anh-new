
import { DirectiveDocument, UserAccount, OfficeDocument } from '../types';

export const MOCK_DOCUMENTS: DirectiveDocument[] = [
  {
    id: '1',
    trichYeu: 'Hướng dẫn thực hiện nhiệm vụ năm học 2024-2025 cấp học Mầm non',
    soKyHieu: '1234/BGDĐT-GDMN',
    coQuanBanHanh: 'Bộ GD&ĐT',
    ngayBanHanh: '2024-08-15',
    loaiVanBan: 'Công văn',
    tomTatNoiDung: 'Chi tiết hướng dẫn các nhiệm vụ trọng tâm, các giải pháp thực hiện cho năm học mới...',
    fileDinhKemUrl: '#'
  },
  {
    id: '2',
    trichYeu: 'Kế hoạch tổ chức Hội thi Giáo viên dạy giỏi cấp Tỉnh năm học 2024-2025',
    soKyHieu: '456/KH-SGDĐT',
    coQuanBanHanh: 'Sở GD&ĐT',
    ngayBanHanh: '2024-09-05',
    loaiVanBan: 'Kế hoạch',
    tomTatNoiDung: 'Quy định về đối tượng, tiêu chuẩn, hồ sơ đăng ký dự thi giáo viên giỏi.',
    fileDinhKemUrl: '#'
  },
  {
    id: '3',
    trichYeu: 'Về việc tăng cường công tác đảm bảo an toàn thực phẩm trong trường học',
    soKyHieu: '789/UBND-VX',
    coQuanBanHanh: 'UBND Tỉnh',
    ngayBanHanh: '2024-09-10',
    loaiVanBan: 'Công văn',
    tomTatNoiDung: 'Yêu cầu các cơ sở giáo dục tăng cường kiểm tra nguồn gốc thực phẩm, đảm bảo vệ sinh...',
    fileDinhKemUrl: '#'
  },
  {
    id: '4',
    trichYeu: 'Thông báo nghỉ lễ Quốc khánh 02/9 năm 2024',
    soKyHieu: '101/TB-UBND',
    coQuanBanHanh: 'UBND Phường',
    ngayBanHanh: '2024-08-20',
    loaiVanBan: 'Thông báo',
    tomTatNoiDung: 'Lịch nghỉ lễ chính thức cho cán bộ, công chức, viên chức và người lao động.',
    fileDinhKemUrl: '#'
  },
  {
    id: '5',
    trichYeu: 'Quyết định về việc phê duyệt danh sách nâng lương trước thời hạn',
    soKyHieu: '202/QĐ-SGDĐT',
    coQuanBanHanh: 'Sở GD&ĐT',
    ngayBanHanh: '2024-10-01',
    loaiVanBan: 'Quyết định',
    fileDinhKemUrl: '#'
  }
];

export const MOCK_SCHOOL_DOCUMENTS: DirectiveDocument[] = [
  {
    id: 's1',
    trichYeu: 'Kế hoạch tổ chức Lễ khai giảng năm học 2024 - 2025',
    soKyHieu: '01/KH-MGVA',
    coQuanBanHanh: 'Ban Giám Hiệu',
    ngayBanHanh: '2024-08-25',
    loaiVanBan: 'Kế hoạch',
    tomTatNoiDung: 'Phân công nhiệm vụ cho các tổ chuyên môn, văn nghệ chào mừng, đón tiếp đại biểu.',
    fileDinhKemUrl: '#'
  },
  {
    id: 's2',
    trichYeu: 'Quyết định thành lập Ban chỉ đạo phòng chống tai nạn thương tích',
    soKyHieu: '05/QĐ-MGVA',
    coQuanBanHanh: 'Hiệu Trưởng',
    ngayBanHanh: '2024-09-01',
    loaiVanBan: 'Quyết định',
    tomTatNoiDung: 'Kiện toàn bộ máy nhân sự phụ trách y tế và an toàn trường học.',
    fileDinhKemUrl: '#'
  },
  {
    id: 's3',
    trichYeu: 'Kế hoạch tổ chức hoạt động trải nghiệm "Bé vui Tết Trung Thu"',
    soKyHieu: '08/KH-CM',
    coQuanBanHanh: 'Tổ Chuyên Môn',
    ngayBanHanh: '2024-09-10',
    loaiVanBan: 'Kế hoạch',
    tomTatNoiDung: 'Tổ chức làm lồng đèn, bày mâm ngũ quả và múa lân cho các bé.',
    fileDinhKemUrl: '#'
  },
  {
    id: 's4',
    trichYeu: 'Quyết định khen thưởng giáo viên đạt thành tích xuất sắc tháng 9',
    soKyHieu: '12/QĐ-TĐKT',
    coQuanBanHanh: 'Hội đồng TĐKT',
    ngayBanHanh: '2024-10-05',
    loaiVanBan: 'Quyết định',
    fileDinhKemUrl: '#'
  },
  {
    id: 's5',
    trichYeu: 'Danh sách trực tuần và trực bảo vệ tháng 11/2024',
    soKyHieu: '15/VB-VP',
    coQuanBanHanh: 'Tổ Văn Phòng',
    ngayBanHanh: '2024-10-28',
    loaiVanBan: 'Văn bản khác',
    tomTatNoiDung: 'Lịch trực chi tiết cho giáo viên và nhân viên bảo vệ.',
    fileDinhKemUrl: '#'
  }
];

export const MOCK_USERS: UserAccount[] = [
  {
    id: 'u1',
    username: 'admin',
    email: 'admin@mgvanganh.edu.vn',
    fullName: 'Nguyễn Thị Hiệu Trưởng',
    role: 'admin',
    roleLabel: 'Hiệu Trưởng',
    group: 'Ban Giám Hiệu',
    accessScope: 'Toàn trường',
    status: 'active',
    permissions: ['all']
  },
  {
    id: 'u2',
    username: 'hieupho1',
    email: 'hieupho1@mgvanganh.edu.vn',
    fullName: 'Trần Thị Phó Hiệu',
    role: 'admin',
    roleLabel: 'Phó Hiệu Trưởng',
    group: 'Ban Giám Hiệu',
    accessScope: 'Toàn trường',
    status: 'active',
    permissions: ['manage_academic']
  },
  {
    id: 'u3',
    username: 'gv01',
    email: 'nguyenthilan@mgvanganh.edu.vn',
    fullName: 'Nguyễn Thị Lan',
    role: 'teacher',
    roleLabel: 'Giáo viên',
    group: 'Tổ Chuyên Môn',
    accessScope: 'la1',
    status: 'active',
    permissions: ['view_docs', 'create_plans']
  },
  {
    id: 'u4',
    username: 'ketoan',
    email: 'ketoan@mgvanganh.edu.vn',
    fullName: 'Phạm Thị Tính',
    role: 'staff',
    roleLabel: 'Kế toán',
    group: 'Tổ Văn Phòng',
    accessScope: 'Phòng Tài chính',
    status: 'active',
    permissions: ['view_finance']
  },
  {
    id: 'u5',
    username: 'gv02',
    email: 'lethimai@mgvanganh.edu.vn',
    fullName: 'Lê Thị Mai',
    role: 'teacher',
    roleLabel: 'Giáo viên',
    group: 'Tổ Chuyên Môn',
    accessScope: 'choi',
    status: 'inactive',
    permissions: ['view_docs']
  },
  {
    id: 'u6',
    username: 'yte',
    email: 'lethiyte@mgvanganh.edu.vn',
    fullName: 'Lê Thị Y Tế',
    role: 'staff',
    roleLabel: 'Nhân viên Y tế',
    group: 'Tổ Văn Phòng',
    accessScope: 'Phòng Y tế',
    status: 'active',
    permissions: ['manage_medical']
  }
];

export const MOCK_OFFICE_DOCS: OfficeDocument[] = [
  {
    id: 'od1',
    name: 'Kế hoạch thu chi tháng 11.xlsx',
    type: 'excel',
    category: 'finance',
    uploader: { name: 'Phạm Thị Tính', role: 'Kế toán' },
    uploadDate: '2024-10-28',
    fileUrl: '#',
    comments: [
      {
        id: 'c1',
        userId: 'u1',
        userName: 'Nguyễn Thị Hiệu Trưởng',
        userRole: 'Hiệu Trưởng',
        content: 'Cô Tính xem lại mục chi phí văn phòng phẩm, tháng này hơi cao so với dự toán.',
        timestamp: '2024-10-29T08:30:00Z'
      },
      {
        id: 'c2',
        userId: 'u4',
        userName: 'Phạm Thị Tính',
        userRole: 'Kế toán',
        content: 'Dạ, do tháng này nhập thêm giấy in cho kỳ thi giáo viên giỏi ạ. Em sẽ giải trình chi tiết trong file đính kèm bổ sung.',
        timestamp: '2024-10-29T09:15:00Z'
      },
      {
        id: 'c3',
        userId: 'u1',
        userName: 'Nguyễn Thị Hiệu Trưởng',
        userRole: 'Hiệu Trưởng',
        content: 'Ok cô, cô sửa lại dự trù kinh phí mục 2 nhé.',
        timestamp: '2024-10-29T10:00:00Z'
      }
    ]
  },
  {
    id: 'od2',
    name: 'Kế hoạch phun thuốc muỗi định kỳ.docx',
    type: 'word',
    category: 'medical',
    uploader: { name: 'Lê Thị Y Tế', role: 'Nhân viên Y tế' },
    uploadDate: '2024-10-30',
    fileUrl: '#',
    comments: []
  },
  {
    id: 'od3',
    name: 'Báo cáo tình hình cơ sở vật chất quý 3.pdf',
    type: 'pdf',
    category: 'general',
    uploader: { name: 'Nguyễn Văn Nam', role: 'Bảo vệ/Hậu cần' },
    uploadDate: '2024-10-25',
    fileUrl: '#',
    comments: [
      {
        id: 'c4',
        userId: 'u2',
        userName: 'Trần Thị Phó Hiệu',
        userRole: 'Phó Hiệu Trưởng',
        content: 'Chú Nam kiểm tra lại số lượng bàn ghế hỏng ở kho B nhé.',
        timestamp: '2024-10-26T14:00:00Z'
      }
    ]
  }
];

export const MOCK_BOARDING_DOCS: OfficeDocument[] = [
  {
    id: 'bd1',
    name: 'Thực đơn Tuần 1 - Tháng 11.xlsx',
    type: 'excel',
    category: 'menu',
    uploader: { name: 'Lê Thị Y Tế', role: 'Nhân viên Y tế' },
    uploadDate: '2024-11-20',
    fileUrl: '#',
    comments: [
      {
        id: 'bc1',
        userId: 'u1',
        userName: 'Nguyễn Thị Hiệu Trưởng',
        userRole: 'Hiệu Trưởng',
        content: 'Tuần này bớt món chiên lại nhé cô Y tế. Thay bằng món hấp cho các cháu dễ tiêu.',
        timestamp: '2024-11-21T08:00:00Z'
      },
      {
        id: 'bc2',
        userId: 'u6',
        userName: 'Lê Thị Y Tế',
        userRole: 'Nhân viên Y tế',
        content: 'Dạ em sẽ đổi món Gà rán sang Gà hấp lá chanh và điều chỉnh lại calo ạ.',
        timestamp: '2024-11-21T08:15:00Z'
      }
    ]
  },
  {
    id: 'bd2',
    name: 'Giấy phép Vệ sinh ATTP năm 2024.pdf',
    type: 'pdf',
    category: 'food_safety',
    uploader: { name: 'Phạm Thị Tính', role: 'Kế toán' },
    uploadDate: '2024-01-15',
    fileUrl: '#',
    comments: []
  },
  {
    id: 'bd3',
    name: 'Sổ kiểm thực 3 bước (Tuần 4).docx',
    type: 'word',
    category: 'food_safety',
    uploader: { name: 'Lê Thị Y Tế', role: 'Nhân viên Y tế' },
    uploadDate: '2024-11-25', // Just now conceptually
    fileUrl: '#',
    comments: []
  },
  {
    id: 'bd4',
    name: 'Báo cáo cân đo trẻ đợt 1.pdf',
    type: 'pdf',
    category: 'nutrition',
    uploader: { name: 'Lê Thị Y Tế', role: 'Nhân viên Y tế' },
    uploadDate: '2024-09-15',
    fileUrl: '#',
    comments: []
  }
];

export const MOCK_CLASSES = [
  { id: 'choi', name: 'LỚP CHỒI', teacher: 'Cô Lê Thị Mai', studentCount: 30, newFiles: 2 },
  { id: 'la1', name: 'LỚP LÁ 1', teacher: 'Cô Nguyễn Thị Lan', studentCount: 35, newFiles: 5 },
  { id: 'la2', name: 'LỚP LÁ 2', teacher: 'Cô Trần Thị Cúc', studentCount: 32, newFiles: 0 },
  { id: 'la3', name: 'LỚP LÁ 3', teacher: 'Cô Phạm Thị Trúc', studentCount: 34, newFiles: 1 },
  { id: 'la4', name: 'LỚP LÁ 4', teacher: 'Cô Hoàng Thị Đào', studentCount: 33, newFiles: 3 },
];

import { MonthFolder } from '../types';

export const MOCK_FOLDERS: MonthFolder[] = [
  {
    id: 'm9',
    name: 'Tháng 09/2025',
    fileCount: 4,
    files: [
      { id: 'f1', name: 'Kế hoạch tuần 1 - Ổn định nề nếp', type: 'word', date: '2025-09-05', uploader: 'Nguyễn Thị Lan', hasNewComments: false, commentCount: 0 },
      { id: 'f2', name: 'Kế hoạch tuần 2 - Trường mầm non', type: 'word', date: '2025-09-12', uploader: 'Nguyễn Thị Lan', hasNewComments: true, commentCount: 2 },
      { id: 'f3', name: 'Kế hoạch tuần 3 - Bé vui tết trung thu', type: 'word', date: '2025-09-19', uploader: 'Nguyễn Thị Lan', hasNewComments: false, commentCount: 0 },
      { id: 'f4', name: 'Kế hoạch tuần 4 - Bản thân bé', type: 'word', date: '2025-09-26', uploader: 'Nguyễn Thị Lan', hasNewComments: false, commentCount: 0 },
    ]
  },
  {
    id: 'm10',
    name: 'Tháng 10/2025',
    fileCount: 3,
    files: [
      { id: 'f5', name: 'Kế hoạch tuần 1 - Gia đình của bé', type: 'word', date: '2025-10-03', uploader: 'Nguyễn Thị Lan', hasNewComments: false, commentCount: 0 },
      { id: 'f6', name: 'Kế hoạch tuần 2 - Ngôi nhà thân yêu', type: 'word', date: '2025-10-10', uploader: 'Nguyễn Thị Lan', hasNewComments: true, commentCount: 1 },
      { id: 'f7', name: 'Kế hoạch chuyên đề - An toàn giao thông', type: 'pdf', date: '2025-10-15', uploader: 'Nguyễn Thị Lan', hasNewComments: true, commentCount: 3 },
    ]
  },
  {
    id: 'm11',
    name: 'Tháng 11/2025',
    fileCount: 2,
    files: [
      { id: 'f8', name: 'Kế hoạch tuần 1 - Cô giáo của em', type: 'word', date: '2025-11-04', uploader: 'Nguyễn Thị Lan', hasNewComments: false, commentCount: 0 },
      { id: 'f9', name: 'Kế hoạch văn nghệ chào mừng 20/11', type: 'excel', date: '2025-11-10', uploader: 'Nguyễn Thị Lan', hasNewComments: false, commentCount: 0 },
    ]
  }
];
