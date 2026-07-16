# Dashboard API

Tài liệu này mô tả Dashboard API của backend. Module cung cấp thống kê, tổng sản phẩm, tổng khách hàng, tổng đơn hàng, doanh thu, biểu đồ, top sản phẩm, top khách hàng và thống kê theo tháng.

## Base Path

```text
/api/v1/dashboard
```

Tất cả endpoint yêu cầu:

```text
Authorization: Bearer <accessToken>
```

Permission:

```text
dashboard:view
```

## Endpoint

- `GET /overview`: Tổng sản phẩm, tổng khách hàng, tổng đơn hàng, tổng doanh thu.
- `GET /charts/revenue`: Biểu đồ doanh thu theo tháng.
- `GET /top-products`: Top sản phẩm bán chạy.
- `GET /top-customers`: Top khách hàng theo chi tiêu.
- `GET /monthly`: Thống kê theo tháng gồm orders, revenue, customers.

## Query

Revenue chart:

```text
GET /api/v1/dashboard/charts/revenue?months=12
```

Monthly stats:

```text
GET /api/v1/dashboard/monthly?months=12
```

Top products/customers:

```text
GET /api/v1/dashboard/top-products?limit=5
GET /api/v1/dashboard/top-customers?limit=5
```

Rules:

- `months`: từ `1` đến `24`, mặc định `12`.
- `limit`: từ `1` đến `50`, mặc định `5`.

## Response Shape

Overview:

```json
{
  "overview": {
    "totalProducts": 120,
    "totalCustomers": 300,
    "totalOrders": 850,
    "totalRevenue": 250000000
  }
}
```

Revenue chart:

```json
{
  "chart": [
    {
      "label": "2026-07",
      "revenue": 10000000,
      "orders": 42
    }
  ]
}
```

Monthly stats:

```json
{
  "stats": [
    {
      "label": "2026-07",
      "orders": 42,
      "revenue": 10000000,
      "customers": 12
    }
  ]
}
```

## Request Flow

```text
Request
↓
Route
↓
Authentication Middleware
↓
Permission Middleware
↓
Validation Middleware
↓
Dashboard Controller
↓
Dashboard Service
↓
Dashboard Repository
↓
MySQL
↓
Response
```

## Database Contract

Repository đọc aggregate từ các bảng đã có contract:

- `products`
- `users`
- `orders`
- `order_details`

Dashboard API không tạo dữ liệu mới và không cập nhật dữ liệu.

## File chính

- `backend/models/dashboard.model.js`
- `backend/repositories/dashboard.repository.js`
- `backend/services/dashboard.service.js`
- `backend/controllers/dashboard.controller.js`
- `backend/routes/dashboard.routes.js`
- `backend/validators/dashboard.validator.js`

## Quy ước

- SQL aggregate chỉ nằm trong repository.
- Service chuẩn hóa dữ liệu biểu đồ và lấp tháng thiếu.
- Controller chỉ xử lý HTTP response.
- Route chỉ đọc dữ liệu, không có CRUD.
- Không thay đổi frontend Dashboard trong bước này.
