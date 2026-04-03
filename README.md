# 🚗 HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE PHÂN TÁN (Hybrid Cloud Architecture)

Dự án ứng dụng mô hình **Message Queue**, **Event-Driven** và **Polyglot Persistence** (Đa cơ sở dữ liệu) vào bài toán quản lý bãi đỗ xe thông minh. Hệ thống kết hợp sức mạnh xử lý luồng dữ liệu tốc độ cao của NoSQL (Firebase) và khả năng truy vấn, lưu trữ bền vững của Relational Database (MySQL).

## 🌟 Tính Năng Nổi Bật

- **⚙️ Auto-Consumer (Background Worker):** Backend Node.js hoạt động ngầm, tự động lắng nghe sự kiện (`child_added`) từ Hàng đợi (Queue) trên Firebase và xử lý logic ngay lập tức mà không cần can thiệp thủ công.
- **⚡ Giám Sát Realtime 2 Chiều:** - Cập nhật trạng thái ô đỗ (Trống/Có xe) theo thời gian thực.
  - Gửi thông báo (Broadcast) kết quả xử lý hoặc cảnh báo lỗi từ Backend ngược về giao diện trạm gác cổng ngay lập tức.
- **🗄️ Polyglot Persistence:** - Dùng **Firebase (NoSQL)** làm Message Queue và lưu trạng thái chớp nhoáng (High Throughput).
  - Dùng **MySQL (SQL)** làm kho lưu trữ lịch sử lâu dài, phục vụ thống kê báo cáo (Complex Querying).
- **🔍 Trạm Quản Trị Trung Tâm (Admin Dashboard):** Tích hợp công cụ tìm kiếm và lọc dữ liệu đa chiều (theo thời gian, hành động, vị trí đỗ) trực tiếp từ MySQL.

## 🛠️ Công Nghệ Sử Dụng

- **Frontend:** HTML5, CSS3, JavaScript (ES6 Modules)
- **Backend:** Node.js, Express.js, Firebase Admin SDK
- **Database:** Firebase Realtime Database (NoSQL) & MySQL (SQL)
- **Architecture:** Distributed System, Event-Driven, Client-Server

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Chuẩn bị cơ sở dữ liệu
- Bật **XAMPP/WAMP** và khởi động dịch vụ **MySQL**.
- Import file `baidoxe.sql` vào phpMyAdmin để tạo bảng `lich_su_xu_ly`.
- Tải file Service Account Key của dự án Firebase (đổi tên thành `firebase-key.json`) và đặt vào thư mục gốc của project.

### 2. Cài đặt thư viện Node.js
Mở Terminal tại thư mục dự án và chạy lệnh:
```bash
npm install express cors mysql2 firebase-admin
3. Khởi chạy Backend Server (Worker)
Bash
node server.js
Server sẽ chạy tại http://localhost:3000 và chuyển sang trạng thái tự động lắng nghe Hàng đợi (Queue).

4. Khởi chạy Frontend
Hệ thống gồm 2 màn hình hoạt động độc lập:

Mở file index.html: Giao diện dành cho nhân viên gác cổng (Gửi yêu cầu VÀO/RA, Tra cứu trạng thái).

Mở file he_thong.html: Giao diện Trung tâm quản lý (Giám sát Realtime, Xem log xử lý tự động, Trích xuất báo cáo MySQL).

🧠 Luồng Dữ Liệu (Data Flow)
[Client] Nhân viên bấm lệnh ở Cổng (index.html).

[NoSQL] Yêu cầu được đẩy lên Hàng đợi (Queue) của Firebase.

[Worker] Node.js phát hiện sự kiện, bốc thông điệp ra khỏi Queue để xử lý logic (tìm chỗ trống, kiểm tra hợp lệ).

[SQL] Nếu thành công, Node.js lưu vết giao dịch vào MySQL. Đồng thời xóa thông điệp khỏi Queue.

[Broadcast] Node.js đẩy thông báo kết quả lên Firebase để các màn hình Client tự động cập nhật log giám sát.

Dự án thực hiện nhằm mục đích nghiên cứu và áp dụng Kiến trúc Hệ thống Phân tán.
