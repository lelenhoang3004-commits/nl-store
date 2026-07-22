import { openModal } from "../components/modal/modal.js";
import { showPageLoading, hidePageLoading } from "../components/loading/loading.js";
import { toast } from "../components/toast/toast.js";
import { loadTemplate } from "../router/template-cache.js";
import { categoryService } from "../services/category.service.js";
import { hasPermission } from "../permissions/access-control.js";
import { PERMISSIONS } from "../permissions/permissions.js";

const DEFAULT_QUERY = Object.freeze({ page: 1, limit: 10, sortBy: "updatedAt", sortOrder: "desc" });
let state = { items: [], pagination: null, query: { ...DEFAULT_QUERY }, busy: false, error: null };
let searchDebounceTimer = null;

export async function createCategoriesPage() {
  showPageLoading("Đang tải danh mục...");

  try {
    await wait(180);
    return await loadTemplate(new URL("./index.html", import.meta.url));
  } finally {
    hidePageLoading();
  }
}

export async function initCategoriesPage(root = document) {
  await loadCategories();
  renderCategorySummary(root);
  renderTable(root);
  bindEvents(root);
  return () => {};
}

async function loadCategories() {
  state.busy = true;
  try {
    const response = await categoryService.getAll({ ...state.query, search: state.query.search, status: state.query.status, sortBy: state.query.sortBy, sortOrder: state.query.sortOrder }, silent());
    state.items = response.data?.categories || [];
    state.pagination = response.meta?.pagination || null;
    state.error = null;
  } catch (error) {
    state.error = error;
    toast.error(message(error));
    state.items = [];
  } finally {
    state.busy = false;
  }
}

function renderCategorySummary(root) {
  const total = state.items.length;
  const active = state.items.filter((category) => category.status === "active").length;
  const hidden = state.items.filter((category) => category.status === "inactive").length;

  setSummaryValue(root, "total", total);
  setSummaryValue(root, "active", active);
  setSummaryValue(root, "hidden", hidden);
}

function renderTable(root) {
  const tableContainer = root.querySelector("[data-categories-table]");

  if (!tableContainer) {
    return;
  }

  const rows = state.items.map((item) => ({
    id: item.id,
    name: item.name,
    slug: item.slug,
    description: item.description || "-",
    productCount: item.productCount ?? item.product_count ?? 0,
    rawStatus: item.status,
    status: statusLabel(item.status),
    updatedAt: formatDate(item.updatedAt)
  }));

  tableContainer.innerHTML = `
    <section class="admin-category-table" aria-label="Danh sách danh mục">
      <header class="admin-category-table-header">
        <div>
          <p class="admin-category-table-eyebrow">Danh mục sản phẩm</p>
          <h2>Danh sách danh mục</h2>
          <p class="admin-category-table-copy">Quản lý danh mục, trạng thái và số lượng sản phẩm trong mỗi nhóm.</p>
        </div>
        <div class="admin-category-table-meta">
          <span><strong>${rows.length}</strong> kết quả</span>
        </div>
      </header>
      <div class="admin-category-toolbar">
        <label class="admin-category-search">
          <span>Tìm kiếm</span>
          <span class="admin-category-control">
            <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
            <input type="search" placeholder="Tên hoặc slug" value="${escapeHtml(state.query.search || "")}" data-category-search>
          </span>
        </label>
        <label class="admin-category-filter">
          <span>Trạng thái</span>
          <span class="admin-category-control">
            <i class="fa-solid fa-filter" aria-hidden="true"></i>
            <select data-category-status-filter>
              <option value="" ${!state.query.status ? "selected" : ""}>Tất cả</option>
              <option value="active" ${state.query.status === "active" ? "selected" : ""}>Đang hiển thị</option>
              <option value="inactive" ${state.query.status === "inactive" ? "selected" : ""}>Tạm ẩn</option>
            </select>
          </span>
        </label>
        <button type="button" class="admin-category-refresh" data-category-refresh>
          <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
          <span>Làm mới</span>
        </button>
      </div>
      <div class="admin-category-table-card">
        <div class="admin-category-table-scroll">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Tên danh mục</th>
                <th>Slug</th>
                <th>Mô tả</th>
                <th>Số sản phẩm</th>
                <th>Trạng thái</th>
                <th>Ngày cập nhật</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length ? rows.map((row) => `
                <tr>
                  <td class="admin-category-id">${escapeHtml(row.id)}</td>
                  <td class="admin-category-name">${escapeHtml(row.name)}</td>
                  <td><code class="admin-category-slug">${escapeHtml(row.slug)}</code></td>
                  <td><span class="admin-category-description" title="${escapeHtml(row.description)}">${escapeHtml(row.description)}</span></td>
                  <td>${escapeHtml(row.productCount)}</td>
                  <td><span class="admin-category-status is-${escapeHtml(row.rawStatus === "active" ? "active" : "inactive")}">${escapeHtml(row.status)}</span></td>
                  <td>${escapeHtml(row.updatedAt)}</td>
                  <td>
                    <div class="admin-category-actions">
                      <button type="button" class="is-edit" data-category-edit="${row.id}" title="Sửa" aria-label="Sửa danh mục ${escapeHtml(row.name)}"><i class="fa-solid fa-pen-to-square"></i></button>
                      <button type="button" class="is-toggle" data-category-toggle="${row.id}" title="${row.rawStatus === "active" ? "Ẩn" : "Hiện"}" aria-label="${row.rawStatus === "active" ? "Ẩn" : "Hiện"} danh mục ${escapeHtml(row.name)}"><i class="fa-solid ${row.rawStatus === "active" ? "fa-eye-slash" : "fa-eye"}"></i></button>
                      <button type="button" class="is-delete" data-category-delete="${row.id}" title="Xóa" aria-label="Xóa danh mục ${escapeHtml(row.name)}"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                  </td>
                </tr>
              `).join("") : `<tr><td colspan="8" class="admin-category-empty"><div class="admin-category-empty-card"><i class="fa-solid fa-folder-open" aria-hidden="true"></i><span>Chưa có danh mục nào.</span></div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function bindEvents(root) {
  root.addEventListener("input", (event) => {
    const searchInput = event.target.closest("[data-category-search]");
    if (!searchInput) return;

    state.query = { ...state.query, search: searchInput.value.trim(), page: 1 };

    if (searchDebounceTimer) {
      window.clearTimeout(searchDebounceTimer);
    }

    searchDebounceTimer = window.setTimeout(() => {
      reload(root).catch(() => {});
    }, 220);
  });

  root.addEventListener("change", async (event) => {
    const statusFilter = event.target.closest("[data-category-status-filter]");
    if (!statusFilter) return;
    state.query = { ...state.query, status: statusFilter.value || "", page: 1 };
    await reload(root);
  });

  root.addEventListener("click", async (event) => {
    const createButton = event.target.closest("[data-category-create]");
    if (createButton) {
      await openCategoryModal(root);
      return;
    }

    const refreshButton = event.target.closest("[data-category-refresh]");
    if (refreshButton) {
      await reload(root);
      return;
    }

    const editButton = event.target.closest("[data-category-edit]");
    if (editButton) {
      const categoryId = editButton.dataset.categoryEdit;
      const category = state.items.find((item) => String(item.id) === String(categoryId));
      if (category) await openCategoryModal(root, category);
      return;
    }

    const toggleButton = event.target.closest("[data-category-toggle]");
    if (toggleButton) {
      const categoryId = toggleButton.dataset.categoryToggle;
      const category = state.items.find((item) => String(item.id) === String(categoryId));
      if (category) await toggleCategoryStatus(root, category);
      return;
    }

    const deleteButton = event.target.closest("[data-category-delete]");
    if (deleteButton) {
      const categoryId = deleteButton.dataset.categoryDelete;
      const category = state.items.find((item) => String(item.id) === String(categoryId));
      if (category) await deleteCategory(root, category);
    }
  });
}

async function reload(root) {
  await loadCategories();
  renderCategorySummary(root);
  renderTable(root);
}

function setSummaryValue(root, key, value) {
  const element = root.querySelector(`[data-category-summary="${key}"]`);
  if (element) {
    element.textContent = value;
  }
}

function createSlug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function openCategoryModal(root, category = null) {
  const editing = Boolean(category);
  const parentCategories = await loadParentCategoryOptions();
  const modal = openModal({
    eyebrow: "Category",
    title: editing ? "Sửa danh mục" : "Thêm danh mục",
    body: `
      <form class="admin-category-form" data-category-form>
        <div class="admin-category-form-grid">
          <label>
            <span>Tên danh mục</span>
            <input type="text" name="name" value="${escapeHtml(category?.name || "")}" placeholder="Nhập tên danh mục" required>
          </label>
          <label>
            <span>Slug</span>
            <input type="text" name="slug" value="${escapeHtml(category?.slug || "")}" placeholder="Slug sẽ tự tạo nếu để trống">
          </label>
          <label>
            <span>Mô tả</span>
            <textarea name="description" rows="4" placeholder="Nhập mô tả">${escapeHtml(category?.description || "")}</textarea>
          </label>
          <label>
            <span>Danh muc cha</span>
            <select name="parentId">
              <option value="">Khong co danh muc cha</option>
              ${parentCategories.filter((item) => String(item.id) !== String(category?.id || "")).map((item) => `<option value="${escapeHtml(item.id)}" ${String(category?.parentId || category?.parent_id || "") === String(item.id) ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Trang thai</span>
            <select name="status">
              <option value="active" ${category?.status === "active" ? "selected" : ""}>Đang hiển thị</option>
              <option value="inactive" ${category?.status === "inactive" ? "selected" : ""}>Tạm ẩn</option>
            </select>
          </label>
        </div>
        <div class="admin-category-form-error" data-category-form-error></div>
      </form>
    `,
    saveText: editing ? "Lưu thay đổi" : "Tạo danh mục",
    onSave: async () => {
      const form = document.querySelector("[data-category-form]");
      const formData = new FormData(form);
      const payload = {
        name: String(formData.get("name") || "").trim(),
        slug: String(formData.get("slug") || "").trim(),
        description: String(formData.get("description") || "").trim(),
        parentId: String(formData.get("parentId") || "").trim() || null,
        status: String(formData.get("status") || "active").trim().toLowerCase()
      };
      try {
        if (editing) await categoryService.patch(category.id, payload, silent());
        else await categoryService.create(payload, silent());
        toast.success(editing ? "Đã cập nhật danh mục." : "Đã thêm danh mục.");
        await reload(root);
      } catch (error) {
        const errorTarget = document.querySelector("[data-category-form-error]");
        const errorMessage = message(error);
        if (errorTarget) errorTarget.textContent = errorMessage;
        throw new Error(errorMessage);
      }
    }
  });

  const form = document.querySelector("[data-category-form]");
  if (form) {
    const nameInput = form.querySelector("input[name='name']");
    const slugInput = form.querySelector("input[name='slug']");
    nameInput?.addEventListener("input", () => {
      if (!editing && !slugInput?.value.trim()) {
        slugInput.value = createSlug(nameInput.value);
      }
    });
  }
}

async function loadParentCategoryOptions() {
  try {
    const response = await categoryService.getAll({ limit: 100, sortBy: "name", sortOrder: "asc" }, silent());
    return response.data?.categories || state.items;
  } catch {
    return state.items;
  }
}

async function toggleCategoryStatus(root, category) {
  if (!hasPermission(PERMISSIONS.CATEGORY_UPDATE) && !hasPermission(PERMISSIONS.CATEGORY_MANAGE)) {
    toast.error("Bạn không có quyền đổi trạng thái danh mục.");
    return;
  }

  const nextStatus = category.status === "active" ? "inactive" : "active";
  try {
    await categoryService.patch(`${category.id}/status`, { status: nextStatus }, silent());
    toast.success("Đã cập nhật trạng thái danh mục.");
    await reload(root);
  } catch (error) {
    toast.error(message(error));
  }
}

async function deleteCategory(root, category) {
  if (!hasPermission(PERMISSIONS.CATEGORY_DELETE) && !hasPermission(PERMISSIONS.CATEGORY_MANAGE)) {
    toast.error("Bạn không có quyền xóa danh mục.");
    return;
  }

  if (!window.confirm(`Xóa danh mục "${category.name}"?`)) {
    return;
  }

  try {
    await categoryService.remove(category.id, silent());
    toast.success("Đã xóa danh mục.");
    await reload(root);
  } catch (error) {
    toast.error(message(error));
  }
}

function statusLabel(status) {
  return status === "active" ? "Đang hiển thị" : status === "inactive" ? "Tạm ẩn" : status;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("vi-VN");
}

function message(error) {
  if (error?.status === 401) return "Phiên đăng nhập hết hạn.";
  if (error?.status === 403) return "Bạn không có quyền quản lý danh mục.";
  if (error?.status === 422) return error?.message || "Dữ liệu không hợp lệ.";
  if (error?.status === 409) return error?.message || "Không thể thực hiện thao tác.";
  if (error?.status >= 500) return "Lỗi hệ thống.";
  return error?.message || "Không thể xử lý yêu cầu.";
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

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
