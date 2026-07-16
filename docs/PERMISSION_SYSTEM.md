# Permission System

Permission System hiện là cấu trúc frontend giả lập để chuẩn bị kết nối JWT sau này.

## Roles

- ADMIN
- STAFF
- CUSTOMER
- GUEST

## Flow

JWT payload sau này sẽ cung cấp `role` hoặc `permissions`.

Frontend flow:

1. `user-session.js` lấy user hiện tại.
2. `role-permissions.js` ánh xạ role sang permission.
3. `access-control.js` kiểm tra quyền.
4. `sidebar.js` lọc menu theo quyền.
5. `guards.js` chặn route không đủ quyền.
6. `routes.js` khai báo quyền cho từng trang.

Khi có Backend, chỉ cần thay `getCurrentUser()` trong `user-session.js` để đọc JWT thật.
