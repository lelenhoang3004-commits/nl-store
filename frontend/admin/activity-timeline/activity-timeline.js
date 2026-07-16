import { loadTemplate } from "../router/template-cache.js";

const activities = [
  {
    id: "ACT-1001",
    type: "admin",
    actor: "Admin",
    title: "Đăng nhập phiên quản trị",
    description: "Admin đăng nhập từ thiết bị Windows và mở Dashboard.",
    target: "Admin Panel",
    time: "2026-07-06T09:55:00+07:00",
    icon: "fa-user-shield",
    tone: "primary"
  },
  {
    id: "ACT-1002",
    type: "order",
    actor: "Staff",
    title: "Cập nhật đơn hàng",
    description: "Đơn #FS1024 chuyển sang trạng thái Đang xử lý.",
    target: "#FS1024",
    time: "2026-07-06T09:35:00+07:00",
    icon: "fa-box-open",
    tone: "warning"
  },
  {
    id: "ACT-1003",
    type: "product",
    actor: "Store Manager",
    title: "Thêm sản phẩm mới",
    description: "Tạo sản phẩm Linen Blazer nữ dáng rộng với SKU FS-BLZ-001.",
    target: "FS-BLZ-001",
    time: "2026-07-06T09:20:00+07:00",
    icon: "fa-shirt",
    tone: "success"
  },
  {
    id: "ACT-1004",
    type: "user",
    actor: "System",
    title: "Khách hàng mới",
    description: "Mai Ngọc Trâm đăng ký tài khoản khách hàng mới.",
    target: "MT",
    time: "2026-07-06T08:48:00+07:00",
    icon: "fa-user-plus",
    tone: "primary"
  },
  {
    id: "ACT-1005",
    type: "product",
    actor: "Admin",
    title: "Đổi trạng thái sản phẩm",
    description: "Đầm midi satin chuyển từ Chờ duyệt sang Đang bán.",
    target: "FS-DRS-027",
    time: "2026-07-05T16:10:00+07:00",
    icon: "fa-toggle-on",
    tone: "warning"
  },
  {
    id: "ACT-1006",
    type: "order",
    actor: "System",
    title: "Thanh toán được ghi nhận",
    description: "Giao dịch COD cho đơn #FS1019 đã được tạo.",
    target: "#FS1019",
    time: "2026-07-04T13:25:00+07:00",
    icon: "fa-credit-card",
    tone: "success"
  },
  {
    id: "ACT-1007",
    type: "admin",
    actor: "Admin",
    title: "Cập nhật cài đặt",
    description: "Bật chế độ tự động lưu trạng thái sidebar.",
    target: "Settings",
    time: "2026-07-02T11:15:00+07:00",
    icon: "fa-gear",
    tone: "primary"
  },
  {
    id: "ACT-1008",
    type: "user",
    actor: "Staff",
    title: "Khóa tài khoản",
    description: "Khóa tạm thời tài khoản nghi ngờ spam đơn hàng.",
    target: "user-4821",
    time: "2026-06-29T17:05:00+07:00",
    icon: "fa-user-lock",
    tone: "danger"
  },
  {
    id: "ACT-1009",
    type: "product",
    actor: "Store Manager",
    title: "Cập nhật tồn kho",
    description: "Nhập bổ sung 60 túi tote canvas premium.",
    target: "FS-BAG-009",
    time: "2026-06-24T10:40:00+07:00",
    icon: "fa-warehouse",
    tone: "success"
  },
  {
    id: "ACT-1010",
    type: "order",
    actor: "Staff",
    title: "Hủy đơn hàng",
    description: "Đơn #FS1002 bị hủy do khách yêu cầu đổi phương thức thanh toán.",
    target: "#FS1002",
    time: "2026-06-12T14:50:00+07:00",
    icon: "fa-ban",
    tone: "danger"
  }
];

const state = {
  range: "today",
  type: "all"
};

export async function createActivityTimelinePage() {
  const templateUrl = new URL("./index.html", import.meta.url);
  return loadTemplate(templateUrl);
}

export function initActivityTimelinePage(root = document) {
  bindActivityTimelineEvents(root);
  renderStats(root);
  renderActivityTimeline(root);
}

function bindActivityTimelineEvents(root) {
  root.querySelectorAll("[data-activity-range]").forEach((button) => {
    button.addEventListener("click", () => {
      state.range = button.dataset.activityRange;
      updateActiveButtons(root, "[data-activity-range]", state.range);
      renderActivityTimeline(root);
    });
  });

  root.querySelectorAll("[data-activity-type]").forEach((button) => {
    button.addEventListener("click", () => {
      state.type = button.dataset.activityType;
      updateActiveButtons(root, "[data-activity-type]", state.type);
      renderActivityTimeline(root);
    });
  });
}

function renderStats(root) {
  const todayCount = filterByRange(activities, "today").length;
  const adminCount = activities.filter((item) => item.type === "admin").length;
  const orderCount = activities.filter((item) => item.type === "order").length;
  const productCount = activities.filter((item) => item.type === "product").length;

  const stats = {
    today: { label: "Hoạt động hôm nay", value: todayCount, icon: "fa-calendar-day" },
    admin: { label: "Admin", value: adminCount, icon: "fa-user-shield" },
    order: { label: "Order", value: orderCount, icon: "fa-box-open" },
    product: { label: "Product", value: productCount, icon: "fa-shirt" }
  };

  Object.entries(stats).forEach(([key, item]) => {
    const card = root.querySelector(`[data-activity-stat="${key}"]`);

    if (!card) {
      return;
    }

    card.innerHTML = `
      <span>
        <i class="fa-solid ${item.icon}" aria-hidden="true"></i>
      </span>
      <div>
        <strong>${item.value}</strong>
        <small>${item.label}</small>
      </div>
    `;
  });
}

function renderActivityTimeline(root) {
  const list = root.querySelector("[data-activity-list]");
  const empty = root.querySelector("[data-activity-empty]");
  const summary = root.querySelector("[data-activity-summary]");
  const visibleActivities = getVisibleActivities();
  const groupedActivities = groupByDate(visibleActivities);

  summary.textContent = `${visibleActivities.length} hoạt động trong ${getRangeLabel(state.range)}.`;
  list.innerHTML = Object.entries(groupedActivities)
    .map(([date, items]) => createDateGroup(date, items))
    .join("");
  empty.classList.toggle("is-visible", visibleActivities.length === 0);
}

function getVisibleActivities() {
  return filterByRange(activities, state.range)
    .filter((item) => state.type === "all" || item.type === state.type);
}

function filterByRange(items, range) {
  const now = new Date("2026-07-06T23:59:59+07:00");
  const days = range === "today" ? 1 : Number(range);
  const start = new Date(now);
  start.setDate(now.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  return items.filter((item) => new Date(item.time) >= start);
}

function groupByDate(items) {
  return items.reduce((groups, item) => {
    const date = new Intl.DateTimeFormat("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(new Date(item.time));

    return {
      ...groups,
      [date]: [...(groups[date] ?? []), item]
    };
  }, {});
}

function createDateGroup(date, items) {
  return `
    <section class="activity-date-group">
      <h2>${date}</h2>
      <div class="activity-date-list">
        ${items.map(createTimelineItem).join("")}
      </div>
    </section>
  `;
}

function createTimelineItem(item) {
  return `
    <article class="activity-item activity-${item.tone}">
      <div class="activity-marker">
        <i class="fa-solid ${item.icon}" aria-hidden="true"></i>
      </div>
      <div class="activity-card">
        <header>
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.target)}</span>
          </div>
          <time datetime="${item.time}">${formatTime(item.time)}</time>
        </header>
        <p>${escapeHtml(item.description)}</p>
        <footer>
          <span><i class="fa-regular fa-user" aria-hidden="true"></i>${escapeHtml(item.actor)}</span>
          <span><i class="fa-solid fa-layer-group" aria-hidden="true"></i>${escapeHtml(item.type)}</span>
        </footer>
      </div>
    </article>
  `;
}

function updateActiveButtons(root, selector, activeValue) {
  root.querySelectorAll(selector).forEach((button) => {
    const value = button.dataset.activityRange ?? button.dataset.activityType;
    button.classList.toggle("is-active", value === activeValue);
  });
}

function getRangeLabel(range) {
  if (range === "today") {
    return "hôm nay";
  }

  return `${range} ngày gần nhất`;
}

function formatTime(value) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit"
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
