import { loadTemplate } from "../router/template-cache.js";

const auditLogs = [
  {
    id: "AUD-1001",
    type: "login",
    module: "auth",
    severity: "info",
    actor: "Admin",
    action: "Đăng nhập",
    target: "Admin Panel",
    detail: "Đăng nhập thành công từ thiết bị Windows.",
    ip: "192.168.1.24",
    time: "2026-07-06T09:42:00+07:00"
  },
  {
    id: "AUD-1002",
    type: "product_create",
    module: "product",
    severity: "success",
    actor: "Store Manager",
    action: "Thêm sản phẩm",
    target: "Linen Blazer nữ dáng rộng",
    detail: "Tạo sản phẩm mới SKU FS-BLZ-001.",
    ip: "192.168.1.24",
    time: "2026-07-06T09:30:00+07:00"
  },
  {
    id: "AUD-1003",
    type: "payment",
    module: "payment",
    severity: "success",
    actor: "System",
    action: "Thanh toán",
    target: "Đơn hàng #FS1024",
    detail: "Ghi nhận giao dịch COD chờ xác nhận.",
    ip: "system",
    time: "2026-07-06T09:12:00+07:00"
  },
  {
    id: "AUD-1004",
    type: "order",
    module: "order",
    severity: "warning",
    actor: "Staff",
    action: "Đổi trạng thái",
    target: "Đơn hàng #FS1023",
    detail: "Chuyển trạng thái từ Chờ xác nhận sang Đang xử lý.",
    ip: "192.168.1.33",
    time: "2026-07-06T08:55:00+07:00"
  },
  {
    id: "AUD-1005",
    type: "product_update",
    module: "product",
    severity: "info",
    actor: "Admin",
    action: "Sửa",
    target: "Áo sơ mi Oxford nam",
    detail: "Cập nhật giá khuyến mãi và mô tả ngắn.",
    ip: "192.168.1.24",
    time: "2026-07-05T17:22:00+07:00"
  },
  {
    id: "AUD-1006",
    type: "product_delete",
    module: "product",
    severity: "danger",
    actor: "Admin",
    action: "Xóa",
    target: "Sản phẩm nháp FS-DRAFT-022",
    detail: "Xóa sản phẩm nháp khỏi danh sách quản trị.",
    ip: "192.168.1.24",
    time: "2026-07-05T16:08:00+07:00"
  },
  {
    id: "AUD-1007",
    type: "logout",
    module: "auth",
    severity: "info",
    actor: "Admin",
    action: "Đăng xuất",
    target: "Admin Panel",
    detail: "Đăng xuất chủ động khỏi giao diện quản trị.",
    ip: "192.168.1.24",
    time: "2026-07-05T12:14:00+07:00"
  },
  {
    id: "AUD-1008",
    type: "status_change",
    module: "product",
    severity: "warning",
    actor: "Store Manager",
    action: "Đổi trạng thái",
    target: "Đầm midi satin",
    detail: "Chuyển trạng thái từ Chờ duyệt sang Đang bán.",
    ip: "192.168.1.28",
    time: "2026-07-04T15:40:00+07:00"
  },
  {
    id: "AUD-1009",
    type: "order",
    module: "order",
    severity: "success",
    actor: "Staff",
    action: "Đơn hàng",
    target: "Đơn hàng #FS1019",
    detail: "Xác nhận đóng gói và bàn giao vận chuyển.",
    ip: "192.168.1.33",
    time: "2026-07-04T10:18:00+07:00"
  }
];

const filters = {
  type: "all",
  module: "all",
  severity: "all",
  query: ""
};

const filterOptions = {
  type: [
    ["all", "Tất cả hành động"],
    ["login", "Đăng nhập"],
    ["logout", "Đăng xuất"],
    ["product_create", "Thêm sản phẩm"],
    ["product_update", "Sửa"],
    ["product_delete", "Xóa"],
    ["status_change", "Đổi trạng thái"],
    ["payment", "Thanh toán"],
    ["order", "Đơn hàng"]
  ],
  module: [
    ["all", "Tất cả module"],
    ["auth", "Auth"],
    ["product", "Product"],
    ["order", "Order"],
    ["payment", "Payment"]
  ],
  severity: [
    ["all", "Tất cả mức độ"],
    ["success", "Success"],
    ["info", "Info"],
    ["warning", "Warning"],
    ["danger", "Danger"]
  ]
};

export async function createAuditLogPage() {
  const templateUrl = new URL("./index.html", import.meta.url);
  return loadTemplate(templateUrl);
}

export function initAuditLogPage(root = document) {
  renderStats(root);
  renderFilterOptions(root);
  bindAuditEvents(root);
  renderAuditTimeline(root);
}

function bindAuditEvents(root) {
  root.querySelector("[data-audit-search]")?.addEventListener("input", (event) => {
    filters.query = event.target.value;
    renderAuditTimeline(root);
  });

  root.querySelectorAll("[data-audit-filter]").forEach((select) => {
    select.addEventListener("change", () => {
      filters[select.dataset.auditFilter] = select.value;
      renderAuditTimeline(root);
    });
  });
}

function renderFilterOptions(root) {
  root.querySelectorAll("[data-audit-filter]").forEach((select) => {
    const key = select.dataset.auditFilter;
    select.innerHTML = filterOptions[key]
      .map(([value, label]) => `<option value="${value}">${label}</option>`)
      .join("");
  });
}

function renderStats(root) {
  const total = auditLogs.length;
  const security = auditLogs.filter((log) => log.module === "auth").length;
  const commerce = auditLogs.filter((log) => ["order", "payment"].includes(log.module)).length;
  const danger = auditLogs.filter((log) => log.severity === "danger").length;

  const stats = {
    total: { label: "Tổng log", value: total, icon: "fa-list-check" },
    security: { label: "Bảo mật", value: security, icon: "fa-shield-halved" },
    commerce: { label: "Giao dịch", value: commerce, icon: "fa-receipt" },
    danger: { label: "Cảnh báo đỏ", value: danger, icon: "fa-triangle-exclamation" }
  };

  Object.entries(stats).forEach(([key, stat]) => {
    const card = root.querySelector(`[data-audit-stat="${key}"]`);

    if (!card) {
      return;
    }

    card.innerHTML = `
      <span>
        <i class="fa-solid ${stat.icon}" aria-hidden="true"></i>
      </span>
      <div>
        <strong>${stat.value}</strong>
        <small>${stat.label}</small>
      </div>
    `;
  });
}

function renderAuditTimeline(root) {
  const logs = getFilteredLogs();
  const timeline = root.querySelector("[data-audit-timeline]");
  const empty = root.querySelector("[data-audit-empty]");
  const summary = root.querySelector("[data-audit-summary]");

  summary.textContent = `${logs.length} kết quả phù hợp trên ${auditLogs.length} audit log.`;
  timeline.innerHTML = logs.map(createTimelineItem).join("");
  empty.classList.toggle("is-visible", logs.length === 0);
}

function getFilteredLogs() {
  const query = filters.query.trim().toLowerCase();

  return auditLogs.filter((log) => {
    const matchesType = filters.type === "all" || log.type === filters.type;
    const matchesModule = filters.module === "all" || log.module === filters.module;
    const matchesSeverity = filters.severity === "all" || log.severity === filters.severity;
    const matchesQuery = !query || `${log.actor} ${log.action} ${log.target} ${log.detail} ${log.ip}`.toLowerCase().includes(query);

    return matchesType && matchesModule && matchesSeverity && matchesQuery;
  });
}

function createTimelineItem(log) {
  return `
    <article class="audit-timeline-item audit-${log.severity}">
      <div class="audit-timeline-marker">
        <i class="fa-solid ${getAuditIcon(log.type)}" aria-hidden="true"></i>
      </div>
      <div class="audit-timeline-card">
        <header>
          <div>
            <strong>${escapeHtml(log.action)}</strong>
            <span>${escapeHtml(log.target)}</span>
          </div>
          <time datetime="${log.time}">${formatDateTime(log.time)}</time>
        </header>
        <p>${escapeHtml(log.detail)}</p>
        <footer>
          <span><i class="fa-regular fa-user" aria-hidden="true"></i>${escapeHtml(log.actor)}</span>
          <span><i class="fa-solid fa-cube" aria-hidden="true"></i>${escapeHtml(log.module)}</span>
          <span><i class="fa-solid fa-network-wired" aria-hidden="true"></i>${escapeHtml(log.ip)}</span>
          <span class="audit-severity">${escapeHtml(log.severity)}</span>
        </footer>
      </div>
    </article>
  `;
}

function getAuditIcon(type) {
  const icons = {
    login: "fa-right-to-bracket",
    logout: "fa-right-from-bracket",
    product_create: "fa-plus",
    product_update: "fa-pen",
    product_delete: "fa-trash",
    status_change: "fa-toggle-on",
    payment: "fa-credit-card",
    order: "fa-box-open"
  };

  return icons[type] ?? "fa-clock-rotate-left";
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
