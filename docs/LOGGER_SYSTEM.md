# Logger System

Tài liệu này mô tả logger dùng chung cho backend. Hệ thống logger không tạo API, không CRUD và không phụ thuộc package ngoài.

## Mục tiêu

- Ghi log request, error, SQL, warning, debug và application.
- Ghi file theo ngày trong `backend/logs`.
- Hỗ trợ development và production bằng environment variable.
- Che dữ liệu nhạy cảm như password, token, cookie, secret.
- Giữ log có cấu trúc JSON để dễ đọc bằng công cụ phân tích log sau này.

## File chính

- `backend/utils/logger.util.js`: Logger dùng chung toàn backend.
- `backend/middleware/request-logger.middleware.js`: Request log dùng Morgan và chuyển output vào logger.
- `backend/config/app.config.js`: Cấu hình logger từ environment variable.
- `backend/logs/`: Nơi sinh log runtime, mỗi loại log tách file theo ngày.

## Log Levels

Thứ tự level:

```text
error < warn < info < debug
```

Quy ước:

- `error`: Lỗi hệ thống hoặc lỗi nghiệp vụ cần điều tra.
- `warn`: Cảnh báo không làm hệ thống dừng ngay.
- `info`: Thông tin vận hành bình thường.
- `debug`: Thông tin chi tiết chỉ nên bật khi phát triển hoặc điều tra lỗi.

## Log Channels

- `request`: HTTP access log.
- `error`: Global error log.
- `sql`: Log phục vụ repository/database layer sau này.
- `warning`: Log cảnh báo.
- `debug`: Log kỹ thuật khi phát triển.
- `application`: Log vận hành chung.

## Daily Rotate

Logger ghi file theo mẫu:

```text
backend/logs/request-2026-07-06.log
backend/logs/error-2026-07-06.log
backend/logs/sql-2026-07-06.log
backend/logs/warning-2026-07-06.log
backend/logs/debug-2026-07-06.log
backend/logs/application-2026-07-06.log
```

Mỗi ngày sẽ tự ghi sang file mới dựa trên ngày hiện tại. Log cũ được dọn theo `LOG_RETENTION_DAYS`.

## Environment Variables

```env
LOG_LEVEL=debug
LOG_TO_FILE=true
LOG_TO_CONSOLE=true
LOG_RETENTION_DAYS=14
```

Gợi ý:

- Development: `LOG_LEVEL=debug`, `LOG_TO_CONSOLE=true`.
- Production: `LOG_LEVEL=info`, `LOG_TO_FILE=true`.

## Format

Mỗi dòng log là một JSON object:

```json
{
  "timestamp": "2026-07-06T11:00:00.000Z",
  "environment": "development",
  "level": "info",
  "channel": "request",
  "message": "GET /health 200",
  "meta": null
}
```

## Cách sử dụng

Application log:

```js
logger.info("Backend server started.", { port: 5000 });
```

Warning log:

```js
logger.warn("Rate limit threshold is close.", { ip: "127.0.0.1" });
```

Error log:

```js
logger.error("Unexpected application error.", error);
```

SQL log chuẩn bị cho repository sau này:

```js
logger.sql("Repository query executed.", {
  repository: "ProductRepository",
  durationMs: 12
});
```

Không log trực tiếp password, token, cookie hoặc secret. Logger có cơ chế redact nhưng developer vẫn phải tránh đưa dữ liệu nhạy cảm vào log.

## Convention

- Middleware request chỉ ghi request metadata, không ghi body.
- Global error handler là nơi chuẩn để ghi lỗi request.
- Repository sau này có thể dùng `logger.sql`, nhưng không được log raw SQL chứa dữ liệu nhạy cảm.
- Debug log không nên bật trong production trừ khi cần điều tra sự cố có kiểm soát.
