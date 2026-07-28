const PAYMENT_METHOD_LABELS = Object.freeze({
  cod: "Thanh to\u00e1n khi nh\u1eadn h\u00e0ng",
  bank_transfer: "Chuy\u1ec3n kho\u1ea3n ng\u00e2n h\u00e0ng",
  bank_personal_qr: "Chuy\u1ec3n kho\u1ea3n ng\u00e2n h\u00e0ng",
  momo: "Thanh to\u00e1n b\u1eb1ng MoMo",
  momo_personal_qr: "Thanh to\u00e1n b\u1eb1ng MoMo",
  credit_card: "Thanh to\u00e1n b\u1eb1ng th\u1ebb t\u00edn d\u1ee5ng",
  credit_card_demo: "Thanh to\u00e1n b\u1eb1ng th\u1ebb t\u00edn d\u1ee5ng"
});

const ORDER_STATUS_LABELS = Object.freeze({
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  processing: "Đang xử lý",
  shipping: "Đang giao hàng",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  canceled: "Đã hủy",
  refunded: "Đã hoàn tiền"
});

const PAYMENT_STATUS_LABELS = Object.freeze({
  pending: "Chờ thanh toán",
  unpaid: "Chờ thanh toán",
  customer_reported: "Khách đã báo thanh toán",
  waiting_confirmation: "Đang chờ xác nhận",
  processing: "Đang xử lý",
  paid: "Đã thanh toán",
  success: "Đã thanh toán",
  completed: "Đã thanh toán",
  failed: "Thanh toán thất bại",
  cancelled: "Đã hủy",
  canceled: "Đã hủy",
  expired: "Đã hết hạn",
  refunded: "Đã hoàn tiền",
  partial: "Thanh toán một phần"
});

const ROLE_LABELS = Object.freeze({
  admin: "Quản trị viên",
  staff: "Nhân viên",
  customer: "Khách hàng",
  user: "Người dùng"
});

const PRODUCT_STATUS_LABELS = Object.freeze({
  active: "Đang bán",
  inactive: "Tạm ngừng bán",
  draft: "Bản nháp",
  archived: "Đã lưu trữ",
  deleted: "Đã xóa",
  out_of_stock: "Hết hàng"
});

const VOUCHER_STATUS_LABELS = Object.freeze({
  active: "Đang hoạt động",
  inactive: "Tạm khóa",
  scheduled: "Chưa bắt đầu",
  expired: "Hết hạn",
  soldout: "Hết lượt",
  used_up: "Hết lượt"
});

export function formatOrderStatus(status = "") {
  const key = normalizeCode(status);
  return ORDER_STATUS_LABELS[key] || String(status || "-");
}

export function formatPaymentMethod(method = "") {
  const key = normalizeCode(method);
  return PAYMENT_METHOD_LABELS[key] || String(method || "-");
}

export function formatPaymentStatus(status = "") {
  const key = normalizeCode(status);
  return PAYMENT_STATUS_LABELS[key] || String(status || "-");
}

export function normalizePaymentStatus(status = "") {
  const key = normalizeCode(status);
  if (key === "success" || key === "completed") return "paid";
  if (key === "canceled") return "cancelled";
  if (key === "waiting_confirmation" || key === "customer_reported") return "processing";
  return key;
}

export function normalizeOrderStatus(status = "") {
  const key = normalizeCode(status);
  if (key === "canceled") return "cancelled";
  return key;
}

export function formatRole(role = "") {
  const key = normalizeCode(role);
  return ROLE_LABELS[key] || String(role || "-");
}

export function formatProductStatus(status = "") {
  const key = normalizeCode(status);
  return PRODUCT_STATUS_LABELS[key] || String(status || "-");
}

export function formatVariantStatus(status = "") {
  return formatProductStatus(status);
}

export function formatVoucherStatus(status = "") {
  const key = normalizeCode(status);
  return VOUCHER_STATUS_LABELS[key] || String(status || "-");
}

function normalizeCode(value = "") {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}
