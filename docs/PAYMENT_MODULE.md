# Payment Module

Tài liệu này mô tả Payment Module của backend. Module xử lý Payment Method, COD, Transaction, History, Status, Validation, Service, Repository và RESTful convention.

## Base Path

```text
/api/v1/payments
```

## Endpoint

Payment methods:

- `GET /methods`: Lấy danh sách phương thức thanh toán.
- `POST /methods`: Tạo phương thức thanh toán.
- `GET /methods/:id`: Lấy chi tiết phương thức thanh toán.
- `PUT /methods/:id`: Cập nhật phương thức thanh toán.
- `DELETE /methods/:id`: Soft delete phương thức thanh toán.

Transactions:

- `GET /transactions`: Lấy danh sách transaction.
- `POST /transactions`: Tạo payment transaction.
- `GET /transactions/:id`: Lấy chi tiết transaction.
- `PATCH /transactions/:id/status`: Cập nhật trạng thái transaction.
- `GET /transactions/:id/history`: Lấy lịch sử transaction.

Tất cả endpoint đều yêu cầu:

```text
Authorization: Bearer <accessToken>
```

## Permission

- Xem thanh toán: `payment:view`.
- Quản lý phương thức, transaction, status: `payment:manage`.

## Payment Method

Type hợp lệ:

- `cod`
- `online`
- `bank_transfer`

Provider hợp lệ:

- `cod`
- `manual`
- `bank`
- `momo`
- `vnpay`
- `paypal`
- `stripe`

COD là một payment method chuẩn:

```json
{
  "code": "cod",
  "name": "Cash on Delivery",
  "provider": "cod",
  "type": "cod",
  "description": "Thanh toán khi nhận hàng",
  "isActive": true,
  "config": {
    "requiresOnlineGateway": false
  }
}
```

## Transaction Status

- `pending`
- `success`
- `failed`
- `cancelled`
- `refunded`

Khi transaction `success`, service cộng `paidAmount` cho order và cập nhật `paymentStatus`.

Khi transaction `refunded`, service trừ `paidAmount` của order và cập nhật `paymentStatus`.

## Create Transaction Body

```json
{
  "orderId": 1,
  "paymentMethodId": 1,
  "transactionCode": "PAY-001",
  "provider": "cod",
  "method": "cod",
  "amount": 1028000,
  "currency": "VND",
  "status": "success",
  "paidAt": "2026-07-06T10:00:00.000Z",
  "metadata": {
    "note": "Thu tiền khi giao hàng"
  }
}
```

Nếu không truyền `transactionCode`, service tự tạo mã `PAY-*`.

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
Payment Controller
↓
Payment Service
↓
Payment Repository
↓
MySQL
↓
Response
```

## Database Contract

`payment_methods`:

- `id`
- `code`
- `name`
- `provider`
- `type`
- `description`
- `is_active`
- `config`
- `created_at`
- `updated_at`
- `deleted_at`

`payment_transactions`:

- `id`
- `order_id`
- `payment_method_id`
- `transaction_code`
- `provider`
- `method`
- `amount`
- `currency`
- `status`
- `paid_at`
- `metadata`
- `created_at`
- `updated_at`

`payment_histories`:

- `id`
- `transaction_id`
- `status`
- `note`
- `changed_by`
- `created_at`

Module cũng cập nhật payment summary trong bảng `orders`:

- `payment_status`
- `payment_method`
- `paid_amount`

## File chính

- `backend/models/payment.model.js`
- `backend/repositories/payment.repository.js`
- `backend/services/payment.service.js`
- `backend/controllers/payment.controller.js`
- `backend/routes/payment.routes.js`
- `backend/validators/payment.validator.js`

## Quy ước

- SQL chỉ nằm trong repository.
- Business rule nằm trong service.
- Controller chỉ xử lý HTTP request/response.
- Validator kiểm tra input trước controller.
- Transaction và history dùng transaction boundary.
- Không xử lý Dashboard logic.
- Không tích hợp cổng thanh toán thật trong bước này.
