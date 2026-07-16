import { eventBus, stateActions, stateSelectors } from "../../state/index.js";

export const NOTIFICATION_EVENTS = Object.freeze({
  incoming: "notification:incoming",
  read: "notification:read",
  unread: "notification:unread",
  cleared: "notification:cleared"
});

const PAGE_SIZE = 4;
const FILTERS = Object.freeze({
  all: "all",
  unread: "unread",
  read: "read"
});

const mockNotifications = [
  {
    id: "noti-1001",
    title: "Đơn hàng mới #FS1024",
    message: "Khách hàng Minh Anh vừa đặt 3 sản phẩm.",
    type: "order",
    read: false,
    createdAt: "2026-07-06T09:30:00+07:00"
  },
  {
    id: "noti-1002",
    title: "Thanh toán COD cần xác nhận",
    message: "Đơn #FS1018 đang chờ nhân viên xác nhận.",
    type: "payment",
    read: false,
    createdAt: "2026-07-06T08:45:00+07:00"
  },
  {
    id: "noti-1003",
    title: "Sản phẩm sắp hết hàng",
    message: "Quần jeans straight fit chỉ còn 7 sản phẩm.",
    type: "inventory",
    read: false,
    createdAt: "2026-07-05T18:20:00+07:00"
  },
  {
    id: "noti-1004",
    title: "Khách hàng mới đăng ký",
    message: "Tài khoản Lan Hương vừa tạo hồ sơ khách hàng.",
    type: "user",
    read: true,
    createdAt: "2026-07-05T15:10:00+07:00"
  },
  {
    id: "noti-1005",
    title: "Voucher gần hết lượt dùng",
    message: "SUMMER26 còn 12 lượt sử dụng.",
    type: "voucher",
    read: true,
    createdAt: "2026-07-04T11:25:00+07:00"
  },
  {
    id: "noti-1006",
    title: "Upload ảnh hoàn tất",
    message: "Gallery sản phẩm đã xử lý xong ảnh preview.",
    type: "upload",
    read: true,
    createdAt: "2026-07-04T10:05:00+07:00"
  }
];

let localState = {
  page: 1,
  query: "",
  filter: FILTERS.all
};

let realtimeUnsubscribe = null;

// Header template uses this component instead of static notification markup.
export function createNotificationCenterTemplate() {
  hydrateNotificationState();
  const unreadCount = stateSelectors.unreadNotifications();

  return `
    <button class="icon-button has-badge" type="button" aria-label="Thông báo" data-dropdown-toggle="notifications" data-notification-trigger>
      <i class="fa-regular fa-bell" aria-hidden="true"></i>
      <span class="header-badge ${unreadCount === 0 ? "is-empty" : ""}" data-notification-badge>${unreadCount}</span>
    </button>
    <div class="dropdown-panel notification-panel notification-center" data-dropdown="notifications" data-notification-center>
      ${createNotificationContent()}
    </div>
  `;
}

export function initNotificationCenter(root = document) {
  hydrateNotificationState();
  bindNotificationEvents(root);
  bindRealtimePreparation();
  renderNotificationCenter(root);
}

function hydrateNotificationState() {
  const current = stateSelectors.notifications();

  if (current.items.length > 0) {
    return;
  }

  const unreadCount = mockNotifications.filter((item) => !item.read).length;
  stateActions.setNotifications({
    items: mockNotifications.map((item) => ({ ...item })),
    unreadCount
  });
}

function bindNotificationEvents(root) {
  const center = root.querySelector("[data-notification-center]");

  if (!center || center.dataset.notificationBound === "true") {
    return;
  }

  center.dataset.notificationBound = "true";

  center.addEventListener("input", (event) => {
    const searchInput = event.target.closest("[data-notification-search]");

    if (!searchInput) {
      return;
    }

    localState = {
      ...localState,
      page: 1,
      query: searchInput.value
    };
    renderNotificationCenter(root, { preserveSearchFocus: true });
  });

  center.addEventListener("click", (event) => {
    const filterButton = event.target.closest("[data-notification-filter]");
    const pageButton = event.target.closest("[data-notification-page]");
    const readButton = event.target.closest("[data-notification-read]");
    const markAllButton = event.target.closest("[data-notification-mark-all]");

    if (filterButton) {
      localState = {
        ...localState,
        page: 1,
        filter: filterButton.dataset.notificationFilter
      };
      renderNotificationCenter(root);
      return;
    }

    if (pageButton) {
      localState = {
        ...localState,
        page: Number(pageButton.dataset.notificationPage)
      };
      renderNotificationCenter(root);
      return;
    }

    if (readButton) {
      stateActions.markNotificationRead(readButton.dataset.notificationRead);
      eventBus.emit(NOTIFICATION_EVENTS.read, { id: readButton.dataset.notificationRead });
      renderNotificationCenter(root);
      return;
    }

    if (markAllButton) {
      markAllAsRead();
      eventBus.emit(NOTIFICATION_EVENTS.cleared);
      renderNotificationCenter(root);
    }
  });
}

function bindRealtimePreparation() {
  if (realtimeUnsubscribe) {
    return;
  }

  realtimeUnsubscribe = eventBus.on(NOTIFICATION_EVENTS.incoming, (notification) => {
    stateActions.addNotification({
      type: "system",
      ...notification
    });
    localState = {
      ...localState,
      page: 1,
      filter: FILTERS.all
    };
    renderNotificationCenter(document);
  });
}

function renderNotificationCenter(root, options = {}) {
  const center = root.querySelector("[data-notification-center]");

  if (center) {
    center.innerHTML = createNotificationContent();

    if (options.preserveSearchFocus) {
      const searchInput = center.querySelector("[data-notification-search]");
      searchInput?.focus({ preventScroll: true });
      searchInput?.setSelectionRange(searchInput.value.length, searchInput.value.length);
    }
  }

  updateNotificationBadge(root);
}

function createNotificationContent() {
  const notifications = getFilteredNotifications();
  const totalPages = Math.max(1, Math.ceil(notifications.length / PAGE_SIZE));
  const page = Math.min(localState.page, totalPages);
  const start = (page - 1) * PAGE_SIZE;
  const visibleItems = notifications.slice(start, start + PAGE_SIZE);
  localState = { ...localState, page };

  return `
    <div class="notification-header">
      <div>
        <strong>Thông báo</strong>
        <span>${stateSelectors.unreadNotifications()} chưa đọc</span>
      </div>
      <button type="button" data-notification-mark-all>Đánh dấu đã đọc</button>
    </div>

    <label class="notification-search">
      <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
      <input type="search" value="${escapeHtml(localState.query)}" placeholder="Tìm thông báo" data-notification-search>
    </label>

    <div class="notification-filters" role="tablist" aria-label="Lọc thông báo">
      ${createFilterButton(FILTERS.all, "Tất cả")}
      ${createFilterButton(FILTERS.unread, "Chưa đọc")}
      ${createFilterButton(FILTERS.read, "Đã đọc")}
    </div>

    <div class="notification-list">
      ${visibleItems.length > 0 ? visibleItems.map(createNotificationItem).join("") : createEmptyState()}
    </div>

    <div class="notification-pagination" aria-label="Phân trang thông báo">
      ${Array.from({ length: totalPages }).map((_, index) => {
        const pageNumber = index + 1;
        return `
          <button type="button" class="${pageNumber === page ? "is-active" : ""}" data-notification-page="${pageNumber}">
            ${pageNumber}
          </button>
        `;
      }).join("")}
    </div>

    <div class="notification-realtime-note">
      <i class="fa-solid fa-signal" aria-hidden="true"></i>
      <span>Realtime đã sẵn sàng qua Event Bus, chưa kết nối Socket.</span>
    </div>
  `;
}

function createFilterButton(value, label) {
  return `
    <button type="button" class="${localState.filter === value ? "is-active" : ""}" data-notification-filter="${value}">
      ${label}
    </button>
  `;
}

function createNotificationItem(notification) {
  return `
    <article class="notification-item ${notification.read ? "is-read" : "is-unread"}">
      <span class="notification-icon notification-${notification.type}">
        <i class="fa-solid ${getNotificationIcon(notification.type)}" aria-hidden="true"></i>
      </span>
      <div class="notification-copy">
        <strong>${escapeHtml(notification.title)}</strong>
        <p>${escapeHtml(notification.message)}</p>
        <time datetime="${escapeHtml(notification.createdAt)}">${formatTime(notification.createdAt)}</time>
      </div>
      ${notification.read ? "" : `
        <button type="button" aria-label="Đánh dấu đã đọc" data-notification-read="${notification.id}">
          <i class="fa-solid fa-check" aria-hidden="true"></i>
        </button>
      `}
    </article>
  `;
}

function createEmptyState() {
  return `
    <div class="notification-empty">
      <i class="fa-regular fa-bell-slash" aria-hidden="true"></i>
      <strong>Không có thông báo</strong>
      <span>Thử đổi bộ lọc hoặc từ khóa tìm kiếm.</span>
    </div>
  `;
}

function getFilteredNotifications() {
  const query = localState.query.trim().toLowerCase();

  return stateSelectors.notifications().items
    .filter((item) => {
      if (localState.filter === FILTERS.read) {
        return item.read;
      }

      if (localState.filter === FILTERS.unread) {
        return !item.read;
      }

      return true;
    })
    .filter((item) => {
      if (!query) {
        return true;
      }

      return `${item.title} ${item.message} ${item.type}`.toLowerCase().includes(query);
    });
}

function markAllAsRead() {
  const notifications = stateSelectors.notifications().items.map((item) => ({
    ...item,
    read: true
  }));

  stateActions.setNotifications({
    items: notifications,
    unreadCount: 0
  });
}

function updateNotificationBadge(root) {
  const badge = root.querySelector("[data-notification-badge]");
  const unreadCount = stateSelectors.unreadNotifications();

  if (!badge) {
    return;
  }

  badge.textContent = unreadCount;
  badge.classList.toggle("is-empty", unreadCount === 0);
}

function getNotificationIcon(type) {
  const icons = {
    order: "fa-box-open",
    payment: "fa-credit-card",
    inventory: "fa-warehouse",
    user: "fa-user-plus",
    voucher: "fa-ticket",
    upload: "fa-cloud-arrow-up",
    system: "fa-bell"
  };

  return icons[type] ?? icons.system;
}

function formatTime(value) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
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
