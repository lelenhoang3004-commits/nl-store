import { hidePageLoading, showPageLoading } from "../components/loading/loading.js";
import { toast } from "../components/toast/toast.js";
import { adminUserService } from "../services/admin-user.service.js";
import { loadTemplate } from "../router/template-cache.js";

const DEFAULT_QUERY = Object.freeze({ page: 1, limit: 10, sortBy: "createdAt", sortOrder: "desc" });
const ROLES = ["ADMIN", "STAFF", "CUSTOMER"];
const STATUSES = ["active", "inactive", "locked"];
const PERMISSIONS = [
  "dashboard:view",
  "product:view",
  "product:create",
  "product:update",
  "product:delete",
  "product:manage",
  "category:view",
  "category:create",
  "category:update",
  "category:delete",
  "category:manage",
  "order:view",
  "order:update",
  "order:manage",
  "payment:view",
  "payment:update",
  "payment:manage",
  "user:view",
  "user:update",
  "user:manage"
];

let state = { users: [], pagination: null, query: { ...DEFAULT_QUERY }, busy: false, error: null };
let filterTimer = null;

export async function createUsersPage() {
  showPageLoading("Đang tải người dùng...");
  try {
    return await loadTemplate(new URL("./index.html", import.meta.url));
  } finally {
    hidePageLoading();
  }
}

export async function initUsersPage(root = document) {
  bindEvents(root);
  await reload(root);
  return () => window.clearTimeout(filterTimer);
}

function bindEvents(root) {
  root.querySelector("[data-user-filters]")?.addEventListener("input", () => scheduleFilter(root));
  root.querySelector("[data-user-filters]")?.addEventListener("change", () => applyFilters(root));
  root.querySelector("[data-user-refresh]")?.addEventListener("click", () => reload(root));

  root.addEventListener("click", async (event) => {
    const refreshButton = event.target.closest("[data-user-refresh]");
    if (refreshButton) {
      await reload(root);
      return;
    }

    const pageButton = event.target.closest("[data-users-page]");
    if (pageButton) {
      state.query = { ...state.query, page: Number(pageButton.dataset.usersPage) || 1 };
      await reload(root);
      return;
    }

    const action = event.target.closest("[data-user-action]");
    if (!action) return;

    const user = state.users.find((item) => String(item.id) === String(action.dataset.userId));
    if (!user) return;

    if (action.dataset.userAction === "view") openDetailModal(user);
    if (action.dataset.userAction === "edit") openEditModal(root, user);
    if (action.dataset.userAction === "toggle") await toggleUserLock(root, user);
    if (action.dataset.userAction === "role") openRoleModal(root, user);
    if (action.dataset.userAction === "permissions") openPermissionsModal(root, user);
  });
}

function scheduleFilter(root) {
  window.clearTimeout(filterTimer);
  filterTimer = window.setTimeout(() => applyFilters(root), 260);
}

async function applyFilters(root) {
  const form = root.querySelector("[data-user-filters]");
  const formData = new FormData(form);
  state.query = {
    ...state.query,
    search: String(formData.get("search") || "").trim(),
    role: String(formData.get("role") || ""),
    status: String(formData.get("status") || ""),
    page: 1
  };
  await reload(root);
}

async function reload(root) {
  state.busy = true;
  renderTable(root);

  try {
    const response = await adminUserService.getAll(state.query, silent());
    state.users = (response.data?.items || response.data?.users || []).map(normalizeUser);
    state.pagination = normalizePagination(response.data?.pagination || response.meta?.pagination);
    state.error = null;
  } catch (error) {
    state.users = [];
    state.error = error;
    toast.error(message(error));
  } finally {
    state.busy = false;
    renderTable(root);
    renderPagination(root);
  }
}

function renderTable(root) {
  const body = root.querySelector("[data-users-body]");
  if (!body) return;

  if (state.busy) {
    body.innerHTML = `<tr><td colspan="9" class="admin-users-empty">Đang tải người dùng...</td></tr>`;
    return;
  }

  if (state.error) {
    body.innerHTML = `<tr><td colspan="9"><div class="admin-users-error"><span>${escapeHtml(message(state.error))}</span><button type="button" data-user-refresh>Thử lại</button></div></td></tr>`;
    return;
  }

  body.innerHTML = state.users.length
    ? state.users.map(renderUserRow).join("")
    : `<tr><td colspan="9" class="admin-users-empty">Chưa có người dùng nào.</td></tr>`;
}

function normalizeUser(user = {}) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName ?? user.full_name ?? "",
    phone: user.phone ?? "",
    role: user.role,
    status: user.status,
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    createdAt: user.createdAt ?? user.created_at ?? null,
    updatedAt: user.updatedAt ?? user.updated_at ?? null
  };
}

function normalizePagination(pagination = null) {
  if (!pagination) return null;
  const totalItems = pagination.totalItems ?? pagination.total ?? 0;
  const page = pagination.page ?? 1;
  const limit = pagination.limit ?? 10;
  const totalPages = pagination.totalPages ?? (Math.ceil(totalItems / limit) || 1);
  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasPreviousPage: pagination.hasPreviousPage ?? page > 1,
    hasNextPage: pagination.hasNextPage ?? page < totalPages
  };
}

function renderUserRow(user) {
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  return `
    <tr>
      <td class="admin-users-id">#${escapeHtml(user.id)}</td>
      <td><strong>${escapeHtml(user.fullName || "-")}</strong></td>
      <td>${escapeHtml(user.email || "-")}</td>
      <td>${escapeHtml(user.phone || "-")}</td>
      <td><span class="admin-users-role is-${escapeHtml(String(user.role || "").toLowerCase())}">${escapeHtml(user.role || "-")}</span></td>
      <td><span class="admin-users-status is-${escapeHtml(user.status || "unknown")}">${escapeHtml(user.status || "-")}</span></td>
      <td><button type="button" class="admin-users-permission-chip" data-user-action="permissions" data-user-id="${escapeHtml(user.id)}">${permissions.length} quyền</button></td>
      <td>${escapeHtml(formatDate(user.createdAt))}</td>
      <td>
        <div class="admin-users-actions">
          <button type="button" data-user-action="view" data-user-id="${escapeHtml(user.id)}" title="Xem chi tiết"><i class="fa-solid fa-eye"></i></button>
          <button type="button" data-user-action="edit" data-user-id="${escapeHtml(user.id)}" title="Sửa"><i class="fa-solid fa-pen-to-square"></i></button>
          <button type="button" data-user-action="toggle" data-user-id="${escapeHtml(user.id)}" title="${user.status === "locked" ? "Mở khóa" : "Khóa"}"><i class="fa-solid ${user.status === "locked" ? "fa-lock-open" : "fa-lock"}"></i></button>
          <button type="button" data-user-action="role" data-user-id="${escapeHtml(user.id)}" title="Đổi role"><i class="fa-solid fa-user-gear"></i></button>
          <button type="button" data-user-action="permissions" data-user-id="${escapeHtml(user.id)}" title="Cập nhật quyền"><i class="fa-solid fa-key"></i></button>
        </div>
      </td>
    </tr>
  `;
}

function renderPagination(root) {
  const target = root.querySelector("[data-users-pagination]");
  if (!target || !state.pagination) {
    if (target) target.innerHTML = "";
    return;
  }

  const { page, totalPages, totalItems, hasPreviousPage, hasNextPage } = state.pagination;
  target.innerHTML = `
    <span>Hiển thị ${escapeHtml(state.users.length)} / ${escapeHtml(totalItems)} người dùng</span>
    <div>
      <button type="button" data-users-page="${page - 1}" ${hasPreviousPage ? "" : "disabled"}>Trước</button>
      <strong>Trang ${escapeHtml(page)} / ${escapeHtml(totalPages || 1)}</strong>
      <button type="button" data-users-page="${page + 1}" ${hasNextPage ? "" : "disabled"}>Sau</button>
    </div>
  `;
}

function openDetailModal(user) {
  openUserModal({
    title: "Chi tiết người dùng",
    body: `
      <div class="admin-users-detail-grid">
        ${detailItem("ID", `#${user.id}`)}
        ${detailItem("Họ tên", user.fullName)}
        ${detailItem("Email", user.email)}
        ${detailItem("Số điện thoại", user.phone || "-")}
        ${detailItem("Role", user.role)}
        ${detailItem("Status", user.status)}
        ${detailItem("Permissions", (user.permissions || []).join(", ") || "-")}
        ${detailItem("Ngày tạo", formatDate(user.createdAt))}
        ${detailItem("Cập nhật", formatDate(user.updatedAt))}
      </div>
    `,
    showSave: false
  });
}

function openEditModal(root, user) {
  openUserModal({
    title: "Sửa người dùng",
    body: userForm(user),
    saveText: "Lưu thay đổi",
    onSave: async (modal) => {
      const form = modal.querySelector("[data-admin-user-form]");
      const payload = readUserForm(form);
      await adminUserService.patch(user.id, payload, silent());
      toast.success("Đã cập nhật người dùng.");
      closeUserModal(modal);
      await reload(root);
    }
  });
}

function openRoleModal(root, user) {
  openUserModal({
    title: "Đổi role",
    body: `
      <form class="admin-users-form" data-admin-user-form>
        <label><span>Role</span><select name="role">${ROLES.map((role) => `<option value="${role}" ${user.role === role ? "selected" : ""}>${role}</option>`).join("")}</select></label>
        <div class="admin-users-form-error" data-user-form-error></div>
      </form>
    `,
    saveText: "Cập nhật role",
    onSave: async (modal) => {
      const role = modal.querySelector("select[name='role']")?.value;
      await adminUserService.updateRole(user.id, role, silent());
      toast.success("Đã cập nhật role.");
      closeUserModal(modal);
      await reload(root);
    }
  });
}

function openPermissionsModal(root, user) {
  openUserModal({
    title: "Cập nhật quyền",
    body: `
      <form class="admin-users-form" data-admin-user-form>
        <div class="admin-users-permission-list">
          ${PERMISSIONS.map((permission) => `
            <label>
              <input type="checkbox" name="permissions" value="${escapeHtml(permission)}" ${(user.permissions || []).includes(permission) ? "checked" : ""}>
              <span>${escapeHtml(permission)}</span>
            </label>
          `).join("")}
        </div>
        <div class="admin-users-form-error" data-user-form-error></div>
      </form>
    `,
    saveText: "Lưu quyền",
    onSave: async (modal) => {
      const permissions = [...modal.querySelectorAll("input[name='permissions']:checked")].map((input) => input.value);
      await adminUserService.updatePermissions(user.id, permissions, silent());
      toast.success("Đã cập nhật quyền.");
      closeUserModal(modal);
      await reload(root);
    }
  });
}

async function toggleUserLock(root, user) {
  const nextStatus = user.status === "locked" ? "active" : "locked";
  try {
    await adminUserService.updateStatus(user.id, nextStatus, silent());
    toast.success(nextStatus === "locked" ? "Đã khóa người dùng." : "Đã mở khóa người dùng.");
    await reload(root);
  } catch (error) {
    toast.error(message(error));
  }
}

function userForm(user) {
  return `
    <form class="admin-users-form" data-admin-user-form>
      <label><span>Họ tên</span><input type="text" name="fullName" value="${escapeHtml(user.fullName || "")}" required></label>
      <label><span>Email</span><input type="email" name="email" value="${escapeHtml(user.email || "")}" readonly></label>
      <label><span>Số điện thoại</span><input type="tel" name="phone" value="${escapeHtml(user.phone || "")}" placeholder="Nhập số điện thoại"></label>
      <label><span>Role</span><select name="role">${ROLES.map((role) => `<option value="${role}" ${user.role === role ? "selected" : ""}>${role}</option>`).join("")}</select></label>
      <label><span>Status</span><select name="status">${STATUSES.map((status) => `<option value="${status}" ${user.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></label>
      <div>
        <span class="admin-users-label">Permissions</span>
        <div class="admin-users-permission-list">
          ${PERMISSIONS.map((permission) => `
            <label>
              <input type="checkbox" name="permissions" value="${escapeHtml(permission)}" ${(user.permissions || []).includes(permission) ? "checked" : ""}>
              <span>${escapeHtml(permission)}</span>
            </label>
          `).join("")}
        </div>
      </div>
      <div class="admin-users-form-error" data-user-form-error></div>
    </form>
  `;
}

function readUserForm(form) {
  return {
    fullName: form.fullName.value.trim(),
    email: form.email.value.trim(),
    phone: form.phone.value.trim(),
    role: form.role.value,
    status: form.status.value,
    permissions: [...form.querySelectorAll("input[name='permissions']:checked")].map((input) => input.value)
  };
}

function openUserModal({ title, body, saveText = "Lưu", showSave = true, onSave }) {
  const overlay = document.createElement("div");
  overlay.className = "admin-users-modal";
  overlay.innerHTML = `
    <section class="admin-users-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-users-modal-title">
      <header><div><p>Admin Users</p><h2 id="admin-users-modal-title">${escapeHtml(title)}</h2></div><button type="button" data-user-modal-close aria-label="Đóng"><i class="fa-solid fa-xmark"></i></button></header>
      <div class="admin-users-modal-body">${body}</div>
      <footer>
        <button type="button" class="is-secondary" data-user-modal-close>Hủy</button>
        ${showSave ? `<button type="button" class="is-primary" data-user-modal-save>${escapeHtml(saveText)}</button>` : ""}
      </footer>
    </section>
  `;
  document.body.appendChild(overlay);
  document.body.classList.add("modal-open");
  requestAnimationFrame(() => overlay.classList.add("is-open"));

  overlay.addEventListener("click", async (event) => {
    if (event.target === overlay || event.target.closest("[data-user-modal-close]")) {
      closeUserModal(overlay);
      return;
    }

    const saveButton = event.target.closest("[data-user-modal-save]");
    if (!saveButton) return;

    const errorTarget = overlay.querySelector("[data-user-form-error]");
    if (errorTarget) errorTarget.textContent = "";

    try {
      saveButton.disabled = true;
      await onSave?.(overlay);
    } catch (error) {
      if (errorTarget) errorTarget.textContent = message(error);
      toast.error(message(error));
    } finally {
      saveButton.disabled = false;
    }
  });
}

function closeUserModal(overlay) {
  overlay.classList.remove("is-open");
  window.setTimeout(() => {
    overlay.remove();
    if (!document.querySelector(".admin-users-modal")) document.body.classList.remove("modal-open");
  }, 160);
}

function detailItem(label, value) {
  return `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? "-")}</strong>`;
}

function message(error) {
  if (error?.status === 401) return "Phiên đăng nhập hết hạn.";
  if (error?.status === 403) return "Không có quyền quản lý người dùng.";
  if (error?.status === 404) return "Không tìm thấy người dùng.";
  if (error?.status === 422) return formatValidationError(error) || "Dữ liệu không hợp lệ.";
  if (error?.code === "USER_SELF_LOCK_NOT_ALLOWED" || String(error?.message || "").includes("tự khóa")) return "Không thể tự khóa tài khoản đang đăng nhập.";
  if (error?.status === 500) return "Lỗi hệ thống.";
  return error?.message || "Không thể xử lý yêu cầu.";
}

function formatValidationError(error) {
  const details = Array.isArray(error?.details) ? error.details : error?.details?.details;
  if (!Array.isArray(details) || !details.length) return "";
  return details.map((item) => item.message).filter(Boolean).join(" ");
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("vi-VN");
}

function silent() { return { showErrorToast: false }; }

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
