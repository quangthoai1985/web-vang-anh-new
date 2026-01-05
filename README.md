# Hệ thống Quản lý Dữ liệu Số - Trường Mẫu giáo Vàng Anh

<div align="center">
  <img src="https://via.placeholder.com/1200x400?text=TRUONG+MAU+GIAO+VANG+ANH" alt="Banner Trường Mẫu giáo Vàng Anh" width="100%" />
</div>

## 📖 Giới thiệu
Đây là **Hệ thống Quản lý Dữ liệu và Hồ sơ Số hóa** được xây dựng và phát triển dành riêng cho **Trường Mẫu giáo Vàng Anh**. Hệ thống giúp chuyển đổi số toàn diện các quy trình quản lý hồ sơ, sổ sách, thực đơn bán trú và các văn bản hành chính trong nhà trường, giúp Ban giám hiệu và Giáo viên dễ dàng lưu trữ, tra cứu và quản lý thông tin một cách khoa học, hiệu quả.

👉 **[Xem chi tiết Quy trình Hoạt động & Phân quyền tại đây](docs/QUY_TRINH_HOAT_DONG.md)**

## 🚀 Tính năng chính

### 1. Quản lý Hồ sơ & Văn bản
- 📂 **Hồ sơ Trường học:** Lưu trữ và quản lý tập trung các văn bản, hồ sơ, quyết định cấp trường.
- 📝 **Hồ sơ Lớp học:** Số hóa việc quản lý sổ sách, hồ sơ theo dõi của từng lớp học.
- 🏢 **Hồ sơ Văn phòng:** Quản lý luân chuyển và lưu trữ các văn bản hành chính, văn phòng phẩm.
- 📜 **Văn bản Chỉ đạo:** Cập nhật nhanh chóng và lưu trữ hệ thống các văn bản chỉ đạo từ Phòng/Sở GD&ĐT.

### 2. Quản lý Chuyên môn & Bán trú
- 🍽️ **Thực đơn Bán trú:** Công cụ lập và quản lý thực đơn dinh dưỡng hàng ngày cho học sinh, đảm bảo cân đối khẩu phần ăn.
- 📅 **Kế hoạch Tổ chuyên môn:** Theo dõi, phê duyệt và lưu trữ kế hoạch hoạt động của các tổ chuyên môn theo tuần/tháng.

### 3. Quản trị Hệ thống
- 📊 **Dashboard Tổng quan:** Bảng tin hiển thị trực quan các thông báo mới, thống kê số liệu và tình hình hoạt động của nhà trường.
- 🔐 **Phân quyền người dùng:** Hệ thống phân quyền chi tiết, bảo mật cho các nhóm người dùng: Ban giám hiệu, Giáo viên, Nhân viên văn phòng và Quản trị viên.

## 🛠️ Công nghệ sử dụng

Dự án được xây dựng trên nền tảng công nghệ web hiện đại, đảm bảo tốc độ, bảo mật và trải nghiệm người dùng tốt nhất:

- **Frontend:** [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- **Backend & Database:** [Firebase](https://firebase.google.com/) (Firestore, Authentication, Storage, Functions)
- **UI/UX:** Tailwind CSS (Design System), Lucide React (Icons)

## 📦 Hướng dẫn Cài đặt & Sử dụng

### Yêu cầu tiên quyết
- [Node.js](https://nodejs.org/) (Khuyến nghị phiên bản LTS mới nhất)
- Tài khoản Google/Firebase có quyền truy cập vào dự án.

### Các bước cài đặt

**1. Clone dự án về máy:**
```bash
git clone https://github.com/quangthoai1985/web-vang-anh-new.git
cd web-vang-anh-new
```

**2. Cài đặt các thư viện phụ thuộc:**
```bash
npm install
```

**3. Cấu hình biến môi trường:**
Tạo file `.env` tại thư mục gốc của dự án và điền các thông tin cấu hình Firebase của bạn (Lấy từ Firebase Console):

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

**4. Chạy dự án (Môi trường Development):**
```bash
npm run dev
```
Ứng dụng sẽ chạy tại địa chỉ: `http://localhost:3000` (hoặc port được hiển thị trên terminal).

## 🤝 Đóng góp & Phát triển
Dự án được phát triển nội bộ. Mọi ý kiến đóng góp, báo lỗi hoặc yêu cầu tính năng mới, vui lòng liên hệ trực tiếp với bộ phận kỹ thuật hoặc tạo Issue trên kho lưu trữ này.

---
<div align="center">
  <i>Bản quyền © 2025 Trường Mẫu giáo Vàng Anh. All rights reserved.</i>
</div>
