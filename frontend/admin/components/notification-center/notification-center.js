import { eventBus, stateActions, stateSelectors } from "../../state/index.js";
import { apiClient } from "../../services/api/api-client.js";
import { tokenService } from "../../services/api/token.service.js";

export const NOTIFICATION_EVENTS = Object.freeze({
  incoming: "notification:incoming",
  read: "notification:read",
  unread: "notification:unread",
  cleared: "notification:cleared"
});

const PAGE_SIZE = 4;
const POLLING_MS = 45000;
const ADMIN_NOTIFICATION_ENDPOINT = "/admin/notifications";
const FILTERS = Object.freeze({ all: "all", unread: "unread", read: "read" });

let localState = { page: 1, query: "", filter: FILTERS.all, loading: false, error: "" };
let realtimeUnsubscribe = null;
let pollingTimer = null;
let fetchPromise = null;

export function createNotificationCenterTemplate() {
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
  bindNotificationEvents(root);
  bindRealtimePreparation();
  fetchNotifications({ root, silent: true });
  startNotificationPolling(root);
  renderNotificationCenter(root);
}

function bindNotificationEvents(root) {
  const center = root.querySelector("[data-notification-center]");
  if (!center || center.dataset.notificationBound === "true") return;
  center.dataset.notificationBound = "true";

  center.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  center.addEventListener("input", (event) => {
    const searchInput = event.target.closest("[data-notification-search]");
    if (!searchInput) return;
    localState = { ...localState, page: 1, query: searchInput.value };
    renderNotificationCenter(root, { preserveSearchFocus: true });
  });

  center.addEventListener("click", async (event) => {
    const filterButton = event.target.closest("[data-notification-filter]");
    const pageButton = event.target.closest("[data-notification-page]");
    const readButton = event.target.closest("[data-notification-read]");
    const markAllButton = event.target.closest("[data-notification-mark-all]");
    const item = event.target.closest("[data-notification-id]");

    if (filterButton) {
      localState = { ...localState, page: 1, filter: filterButton.dataset.notificationFilter };
      renderNotificationCenter(root);
      return;
    }

    if (pageButton) {
      localState = { ...localState, page: Number(pageButton.dataset.notificationPage) };
      renderNotificationCenter(root);
      return;
    }

    if (readButton) {
      event.stopPropagation();
      await markNotificationRead(readButton.dataset.notificationRead, root);
      return;
    }

    if (markAllButton) {
      await markAllAsRead(root);
      return;
    }

    if (item) {
      const id = item.dataset.notificationId;
      await markNotificationRead(id, root, { navigate: false });
      const link = item.dataset.notificationLink;
      if (link) window.location.hash = link.replace(/^#?/, "#");
    }
  });
}

function bindRealtimePreparation() {
  if (realtimeUnsubscribe) return;
  realtimeUnsubscribe = eventBus.on(NOTIFICATION_EVENTS.incoming, (notification) => {
    stateActions.addNotification({ type: "system", ...notification });
    localState = { ...localState, page: 1, filter: FILTERS.all };
    renderNotificationCenter(document);
  });
}

function startNotificationPolling(root) {
  if (pollingTimer) return;
  pollingTimer = window.setInterval(() => fetchNotifications({ root, silent: true }), POLLING_MS);
}

async function fetchNotifications({ root = document, silent = false } = {}) {
  if (fetchPromise) return fetchPromise;
  if (!tokenService.getAccessToken()) {
    stateActions.setNotifications({ items: [], unreadCount: 0 });
    localState = { ...localState, loading: false, error: "" };
    renderNotificationCenter(root);
    return null;
  }
  localState = { ...localState, loading: !silent, error: "" };
  renderNotificationCenter(root);
  fetchPromise = apiClient.get(ADMIN_NOTIFICATION_ENDPOINT, { showLoading: false, showErrorToast: false })
    .then((response) => {
      const data = response?.data || response || {};
      const notifications = Array.isArray(data.notifications) ? data.notifications : [];
      stateActions.setNotifications({
        items: notifications.map(normalizeNotification),
        unreadCount: Number(data.unreadCount || 0)
      });
      localState = { ...localState, loading: false, error: "" };
      renderNotificationCenter(root);
    })
    .catch((error) => {
      localState = { ...localState, loading: false, error: error?.status === 401 ? "" : "Không thể tải thông báo." };
      renderNotificationCenter(root);
    })
    .finally(() => { fetchPromise = null; });
  return fetchPromise;
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
  const visibleItems = notifications.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  localState = { ...localState, page };

  return `
    <div class="notification-header">
      <div><strong>Thông báo</strong><span>${stateSelectors.unreadNotifications()} chưa đọc</span></div>
      <button type="button" data-notification-mark-all ${stateSelectors.unreadNotifications() === 0 ? "disabled" : ""}>Đánh dấu đã đọc</button>
    </div>
    <label class="notification-search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input type="search" value="${escapeHtml(localState.query)}" placeholder="Tìm thông báo" data-notification-search></label>
    <div class="notification-filters" role="tablist" aria-label="Lọc thông báo">
      ${createFilterButton(FILTERS.all, "Tất cả")}${createFilterButton(FILTERS.unread, "Chưa đọc")}${createFilterButton(FILTERS.read, "Đã đọc")}
    </div>
    <div class="notification-list">
      ${localState.loading ? createLoadingState() : localState.error ? createErrorState() : visibleItems.length > 0 ? visibleItems.map(createNotificationItem).join("") : createEmptyState()}
    </div>
    <div class="notification-pagination" aria-label="Phân trang thông báo">
      ${Array.from({ length: totalPages }).map((_, index) => `<button type="button" class="${index + 1 === page ? "is-active" : ""}" data-notification-page="${index + 1}">${index + 1}</button>`).join("")}
    </div>
    <div class="notification-realtime-note"><i class="fa-solid fa-rotate" aria-hidden="true"></i><span>Đang tự động cập nhật mỗi 45 giây.</span></div>
  `;
}

function createFilterButton(value, label) {
  return `<button type="button" class="${localState.filter === value ? "is-active" : ""}" data-notification-filter="${value}">${label}</button>`;
}

function createNotificationItem(notification) {
  return `
    <article class="notification-item ${notification.read ? "is-read" : "is-unread"}" data-notification-id="${escapeHtml(notification.id)}" data-notification-link="${escapeHtml(notification.link || "")}" tabindex="0">
      <span class="notification-icon notification-${escapeHtml(notification.type)}"><i class="fa-solid ${getNotificationIcon(notification.type)}" aria-hidden="true"></i></span>
      <div class="notification-copy"><strong>${escapeHtml(notification.title)}</strong><p>${escapeHtml(notification.message)}</p><time datetime="${escapeHtml(notification.createdAt)}">${formatTime(notification.createdAt)}</time></div>
      ${notification.read ? "" : `<button type="button" aria-label="Đánh dấu đã đọc" data-notification-read="${escapeHtml(notification.id)}"><i class="fa-solid fa-check" aria-hidden="true"></i></button>`}
    </article>`;
}

async function markNotificationRead(id, root, options = {}) {
  if (!id) return;
  stateActions.markNotificationRead(Number(id));
  renderNotificationCenter(root);
  try {
    await apiClient.patch(`${ADMIN_NOTIFICATION_ENDPOINT}/${encodeURIComponent(id)}/read`, {}, { showLoading: false, showErrorToast: false });
    eventBus.emit(NOTIFICATION_EVENTS.read, { id });
    if (options.navigate) await fetchNotifications({ root, silent: true });
  } catch {
    await fetchNotifications({ root, silent: true });
  }
}

async function markAllAsRead(root) {
  stateActions.setNotifications({ items: stateSelectors.notifications().items.map((item) => ({ ...item, read: true, isRead: true })), unreadCount: 0 });
  renderNotificationCenter(root);
  try {
    await apiClient.patch(`${ADMIN_NOTIFICATION_ENDPOINT}/read-all`, {}, { showLoading: false, showErrorToast: false });
    eventBus.emit(NOTIFICATION_EVENTS.cleared);
  } catch {
    await fetchNotifications({ root, silent: true });
  }
}

function getFilteredNotifications() {
  const query = localState.query.trim().toLowerCase();
  return stateSelectors.notifications().items
    .filter((item) => localState.filter === FILTERS.read ? item.read : localState.filter === FILTERS.unread ? !item.read : true)
    .filter((item) => !query || `${item.title} ${item.message} ${item.type}`.toLowerCase().includes(query));
}

function normalizeNotification(item = {}) {
  return { ...item, id: Number(item.id), read: Boolean(item.read ?? item.isRead), createdAt: item.createdAt || item.created_at || new Date().toISOString() };
}

function updateNotificationBadge(root) {
  const badge = root.querySelector("[data-notification-badge]");
  const unreadCount = stateSelectors.unreadNotifications();
  if (!badge) return;
  badge.textContent = unreadCount;
  badge.classList.toggle("is-empty", unreadCount === 0);
}

function createLoadingState() { return `<div class="notification-empty"><i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i><strong>Đang tải thông báo</strong></div>`; }
function createErrorState() { return `<div class="notification-empty"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><strong>${escapeHtml(localState.error)}</strong></div>`; }
function createEmptyState() { return `<div class="notification-empty"><i class="fa-regular fa-bell-slash" aria-hidden="true"></i><strong>Không có thông báo</strong><span>Thông báo mới sẽ xuất hiện tại đây.</span></div>`; }
function getNotificationIcon(type) { return ({ order: "fa-box-open", payment: "fa-credit-card", inventory: "fa-warehouse", user: "fa-user-plus", voucher: "fa-ticket", system: "fa-bell" })[type] || "fa-bell"; }
function formatTime(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(date); }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
