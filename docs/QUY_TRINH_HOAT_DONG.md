# Quy Trình Hoạt Động & Phân Quyền Hệ Thống

Tài liệu này mô tả chi tiết quy trình vận hành, luồng dữ liệu và cơ chế phân quyền người dùng trong Hệ thống Quản lý Dữ liệu Số của Trường Mẫu giáo Vàng Anh.

## 1. Cơ Cấu Tổ Chức & Phân Quyền (Roles)

Hệ thống được thiết kế dựa trên cơ cấu tổ chức thực tế của nhà trường, với các nhóm quyền hạn (Roles) cụ thể như sau:

| Mã Quyền (Role ID) | Tên Hiển Thị | Đối Tượng Sử Dụng | Quyền Hạn Chính |
| :--- | :--- | :--- | :--- |
| `admin` | Quản trị hệ thống | Bộ phận kỹ thuật / Admin | Toàn quyền kiểm soát hệ thống, quản lý tài khoản người dùng, cấu hình. |
| `vice_principal` | Ban Giám Hiệu (Hiệu Phó) | Hiệu trưởng / Hiệu phó | Xem toàn bộ báo cáo, duyệt kế hoạch, kiểm tra hồ sơ giáo viên, đăng tải văn bản chỉ đạo. |
| `office_head` | Tổ Trưởng Văn Phòng | Kế toán, Y tế, Văn thư | Quản lý hồ sơ văn phòng, thực đơn bán trú, công khai tài chính. |
| `head_teacher` | Tổ Trưởng Chuyên Môn | Tổ trưởng các khối/lớp | Quản lý kế hoạch tổ, duyệt hồ sơ giáo viên trong tổ, tổng hợp báo cáo tổ. |
| `vice_head_teacher` | Tổ Phó Chuyên Môn | Tổ phó các khối/lớp | Hỗ trợ tổ trưởng, thực hiện các báo cáo được phân công (quyền hạn hạn chế hơn Tổ trưởng). |
| `teacher` | Giáo viên | Giáo viên đứng lớp | Tải lên hồ sơ lớp học, xem văn bản chỉ đạo, xem thực đơn, cập nhật thông tin học sinh. |
| `staff` | Nhân viên | Bảo vệ, Cấp dưỡng... | Xem thông báo chung, lịch công tác (quyền hạn hạn chế). |

---

## 2. Quy Trình Hoạt Động Chi Tiết (Workflows)

### 2.1. Module Quản lý Hồ Sơ & Giáo Án Lớp Học

Đây là tính năng cốt lõi giúp giáo viên số hóa hồ sơ lớp học thay vì lưu trữ sổ sách giấy.

*   **Bước 1: Giáo viên tải lên (Upload)**
    *   Giáo viên đăng nhập, vào mục **Hồ sơ Lớp học**.
    *   Chọn đúng phân loại hồ sơ (Kế hoạch năm/tháng/tuần, Sổ theo dõi trẻ, v.v...).
    *   Tải lên file (Word/PDF/Excel/Ảnh).
    *   Hệ thống ghi nhận thời gian upload để đánh giá nề nếp.

*   **Bước 2: Tổ trưởng/BGH Kiểm tra (Review)**
    *   Tổ trưởng Chuyên môn hoặc Ban Giám Hiệu nhận thông báo có hồ sơ mới.
    *   Truy cập vào lớp tương ứng để xem nội dung file.
    *   Sử dụng tính năng **Bình luận (Comment)** để góp ý trực tiếp trên file (nếu có sai sót hoặc cần chỉnh sửa).

*   **Bước 3: Giáo viên Phản hồi/Cập nhật**
    *   Giáo viên nhận thông báo phản hồi.
    *   Thực hiện chỉnh sửa và tải lên phiên bản mới (nếu cần).
    *   Trạng thái hồ sơ chuyển thành "Đã duyệt" hoặc "Hoàn thành".

### 2.2. Module Văn Bản & Chỉ Đạo

Giúp triển khai văn bản từ cấp trên xuống toàn thể giáo viên nhanh chóng.

*   **Bước 1: Tiếp nhận & Xử lý văn bản**
    *   Văn thư hoặc BGH nhận văn bản từ Sở/Phòng GD&ĐT (bản cứng hoặc email).
    *   Scan hoặc tải file PDF văn bản.

*   **Bước 2: Phát hành trên hệ thống**
    *   Người có quyền (`vice_principal`, `office_head`) vào mục **Văn bản Chỉ đạo**.
    *   Nhập số hiệu, trích yếu, ngày ban hành và đính kèm file.
    *   Chọn đối tượng áp dụng (Toàn trường hoặc Tổ chuyên môn cụ thể).

*   **Bước 3: Giáo viên Tra cứu**
    *   Giáo viên nhận thông báo văn bản mới trên Dashboard.
    *   Truy cập xem chi tiết, tải về nếu cần.
    *   Hệ thống có thể ghi nhận ai đã xem văn bản (tùy chọn).

### 2.3. Module Thực Đơn Bán Trú & Dinh Dưỡng

Quy trình đảm bảo công khai, minh bạch khẩu phần ăn của trẻ.

*   **Bước 1: Xây dựng thực đơn**
    *   Bộ phận Y tế/Cấp dưỡng (`staff` hoặc `office_head`) lập thực đơn cân đối dinh dưỡng trên file Excel/Phần mềm dinh dưỡng.

*   **Bước 2: Duyệt & Công khai**
    *   BGH xem xét và phê duyệt thực đơn.
    *   Tải file thực đơn lên mục **Bán trú - Thực đơn**.
    *   Thông tin được hiển thị công khai cho Giáo viên và có thể tích hợp xuất ra Website trường cho Phụ huynh xem.

### 2.4. Module Kế Hoạch Tổ Chuyên Môn

*   **Bước 1: Lập kế hoạch**
    *   Tổ trưởng chuyên môn (`head_teacher`) soạn thảo kế hoạch hoạt động tuần/tháng của tổ.

*   **Bước 2: Phê duyệt**
    *   BGH (`vice_principal`) truy cập mục **Kế hoạch Tổ**.
    *   Xem xét các đề xuất, kế hoạch dự giờ, thao giảng.
    *   Duyệt online ngay trên hệ thống.

---

## 3. Luồng Tương Tác Giữa Các Bộ Phận

Dưới đây là tóm tắt luồng báo cáo và tương tác:

1.  **Chiều Dọc (Báo cáo & Chỉ đạo):**
    *   **BGH -> Giáo viên/Nhân viên:** Triển khai Văn bản, Kế hoạch năm học, Lịch công tác.
    *   **Giáo viên -> Tổ Trưởng -> BGH:** Nộp Giáo án, Sổ sách, Báo cáo tình hình lớp.

2.  **Chiều Ngang (Phối hợp):**
    *   **Y tế/Văn phòng <-> Giáo viên:** Phối hợp trong Sổ theo dõi sức khỏe, Báo ăn hàng ngày.
    *   **Tổ trưởng <-> Tổ viên:** Trao đổi chuyên môn, góp ý bài giảng qua Comment.

## 4. Bảo Mật & Lưu Trữ

*   Dữ liệu được lưu trữ an toàn trên hạ tầng **Google Firebase**.
*   Phân quyền chặt chẽ: Giáo viên lớp nào chỉ có quyền chỉnh sửa hồ sơ lớp đó (trừ khi được cấp quyền xem chéo).
*   Tất cả hành động quan trọng (Thêm/Xóa/Sửa) đều được hệ thống ghi log để tra cứu khi cần thiết.
