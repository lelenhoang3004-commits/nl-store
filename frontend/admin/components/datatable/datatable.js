import { confirmPresets } from "../confirm/confirm.js";
import { createSkeletonRows } from "../loading/loading.js";
import { openCrudModal } from "../modal/modal.js";
import { toast } from "../toast/toast.js";

const DEFAULT_PAGE_SIZE = 5;
const DEFAULT_ROW_ACTIONS = [
  { key: "view", title: "View", icon: "fa-regular fa-eye" },
  { key: "edit", title: "Edit", icon: "fa-regular fa-pen-to-square" },
  { key: "delete", title: "Delete", icon: "fa-regular fa-trash-can" }
];

export function mountDataTable(container, options) {
  const state = {
    search: "",
    filter: "all",
    sortKey: options.columns[0]?.key ?? "",
    sortDirection: "asc",
    page: 1,
    pageSize: options.pageSize ?? DEFAULT_PAGE_SIZE,
    selectedIds: new Set(),
    loading: true,
    destroyed: false
  };

  const table = {
    render() {
      if (state.destroyed || !container.isConnected) {
        return;
      }

      container.innerHTML = createTableShell(options, state);
      bindEvents(container, options, state, table);

      if (!state.loading) {
        renderTableBody(container, options, state);
      }
    },
    destroy() {
      state.destroyed = true;
      window.clearTimeout(loadingTimer);
      container.innerHTML = "";
    }
  };

  table.render();

  const loadingTimer = window.setTimeout(() => {
    if (state.destroyed || !container.isConnected) {
      return;
    }

    state.loading = false;
    table.render();
  }, options.loadingDelay ?? 450);

  return table;
}

export function createAdminMockRows(moduleName = "Module") {
  return [
    { id: 1, name: `${moduleName} Premium`, category: "Thời trang nữ", status: "Đang bán", total: "2.450.000đ", updatedAt: "Hôm nay" },
    { id: 2, name: `${moduleName} Classic`, category: "Thời trang nam", status: "Chờ duyệt", total: "1.180.000đ", updatedAt: "Hôm qua" },
    { id: 3, name: `${moduleName} Urban`, category: "Phụ kiện", status: "Tạm ẩn", total: "890.000đ", updatedAt: "2 ngày trước" },
    { id: 4, name: `${moduleName} Minimal`, category: "Bộ sưu tập", status: "Đang bán", total: "3.260.000đ", updatedAt: "3 ngày trước" },
    { id: 5, name: `${moduleName} Signature`, category: "Thời trang nữ", status: "Đang bán", total: "1.540.000đ", updatedAt: "4 ngày trước" },
    { id: 6, name: `${moduleName} Studio`, category: "Thời trang nam", status: "Chờ duyệt", total: "2.030.000đ", updatedAt: "5 ngày trước" },
    { id: 7, name: `${moduleName} Active`, category: "Phụ kiện", status: "Đang bán", total: "760.000đ", updatedAt: "6 ngày trước" }
  ];
}

export const adminTableColumns = [
  { key: "name", label: "Tên hiển thị", sortable: true },
  { key: "category", label: "Nhóm", sortable: true },
  { key: "status", label: "Trạng thái", sortable: true, type: "status" },
  { key: "total", label: "Giá trị", sortable: true },
  { key: "updatedAt", label: "Cập nhật", sortable: true }
];

function createTableShell(options, state) {
  const rows = getVisibleRows(options.rows, options.columns, state);
  const pageCount = getPageCount(rows.length, state.pageSize);
  const pagedRows = paginateRows(rows, state);
  const startItem = rows.length === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
  const endItem = Math.min(state.page * state.pageSize, rows.length);

  return `
    <section class="datatable" aria-label="${options.title}">
      <div class="datatable-header">
        <div>
          <p class="datatable-eyebrow">DataTable</p>
          <h2>${options.title}</h2>
          <span>${options.description ?? "Bảng dữ liệu dùng chung cho Admin."}</span>
        </div>
        <div class="datatable-header-actions">
          ${createHeaderActions(options)}
          <button class="datatable-primary-action" type="button" data-datatable-create>
            <i class="fa-solid fa-plus" aria-hidden="true"></i>
            <span>${options.createText ?? "Thêm mới"}</span>
          </button>
        </div>
      </div>

      <div class="datatable-toolbar">
        <label class="datatable-search">
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          <input type="search" placeholder="Tìm kiếm..." value="${escapeHtml(state.search)}" data-datatable-search>
        </label>

        <label class="datatable-filter">
          <i class="fa-solid fa-filter" aria-hidden="true"></i>
          <select data-datatable-filter>
            ${createFilterOptions(options.filterOptions ?? getStatusOptions(options.rows), state.filter)}
          </select>
        </label>
      </div>

      <div class="datatable-surface">
        ${state.loading ? createSkeletonRows({ rows: 5, columns: options.columns.length + 2 }) : createTable(options, state, pagedRows)}
      </div>

      <div class="datatable-footer">
        <span>Hiển thị ${startItem}-${endItem} trong ${rows.length} dòng</span>
        <div class="datatable-pagination">
          <button type="button" data-datatable-prev ${state.page === 1 ? "disabled" : ""} aria-label="Trang trước">
            <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
          </button>
          <span>Trang ${state.page} / ${pageCount}</span>
          <button type="button" data-datatable-next ${state.page >= pageCount ? "disabled" : ""} aria-label="Trang sau">
            <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </section>
  `;
}

function createTable(options, state, rows) {
  if (rows.length === 0) {
    return `
      <div class="datatable-empty">
        <i class="fa-regular fa-folder-open" aria-hidden="true"></i>
        <strong>Không có dữ liệu phù hợp</strong>
        <span>Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc.</span>
      </div>
    `;
  }

  return `
    <div class="datatable-scroll">
      <table>
        <thead>
          <tr>
            <th class="checkbox-column">
              <input type="checkbox" aria-label="Chọn tất cả" data-datatable-select-all>
            </th>
            <th class="index-column">STT</th>
            ${options.columns.map((column) => createHeaderCell(column, state)).join("")}
            <th class="action-column">Action</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, index) => createRow(row, index, options, state)).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function createHeaderActions(options) {
  return (options.headerActions ?? []).map((action) => `
    <button class="datatable-secondary-action" type="button" data-table-header-action="${action.key}" title="${action.title ?? action.label}">
      <i class="${action.icon}" aria-hidden="true"></i>
      <span>${action.label}</span>
    </button>
  `).join("");
}

function createHeaderCell(column, state) {
  const sortIcon = state.sortKey === column.key
    ? state.sortDirection === "asc" ? "fa-arrow-up-short-wide" : "fa-arrow-down-wide-short"
    : "fa-sort";
  const sortable = column.sortable ? "data-datatable-sort" : "";

  return `
    <th>
      <button class="datatable-sort" type="button" ${sortable} data-sort-key="${column.key}" ${column.sortable ? "" : "disabled"}>
        <span>${column.label}</span>
        <i class="fa-solid ${sortIcon}" aria-hidden="true"></i>
      </button>
    </th>
  `;
}

function createRow(row, index, options, state) {
  const rowNumber = (state.page - 1) * state.pageSize + index + 1;

  return `
    <tr class="datatable-row">
      <td class="checkbox-column">
        <input type="checkbox" aria-label="Chọn dòng ${rowNumber}" data-row-id="${row.id}" ${state.selectedIds.has(row.id) ? "checked" : ""}>
      </td>
      <td class="index-column">${rowNumber}</td>
      ${options.columns.map((column) => `<td>${formatCell(row[column.key], column, row)}</td>`).join("")}
      <td class="action-column">
        <div class="row-actions" aria-label="Hành động">
          ${createRowActions(row, options)}
        </div>
      </td>
    </tr>
  `;
}

function createRowActions(row, options) {
  return (options.rowActions ?? DEFAULT_ROW_ACTIONS).map((action) => `
    <button type="button" title="${action.title}" data-action="${action.key}" data-row-id="${row.id}">
      <i class="${action.icon}" aria-hidden="true"></i>
    </button>
  `).join("");
}

function bindEvents(container, options, state, table) {
  container.querySelector("[data-datatable-create]")?.addEventListener("click", () => {
    if (options.onCreate) {
      options.onCreate();
      return;
    }

    openCrudModal("create", {}, options.moduleName ?? options.title);
    toast.info("Đang mở biểu mẫu thêm mới.");
  });

  container.querySelectorAll("[data-table-header-action]").forEach((button) => {
    button.addEventListener("click", () => {
      options.onHeaderAction?.(button.dataset.tableHeaderAction, {
        selectedIds: Array.from(state.selectedIds),
        visibleRows: getVisibleRows(options.rows, options.columns, state)
      });
    });
  });

  container.querySelector("[data-datatable-search]")?.addEventListener("input", (event) => {
    state.search = event.target.value;
    state.page = 1;
    table.render();
  });

  container.querySelector("[data-datatable-filter]")?.addEventListener("change", (event) => {
    state.filter = event.target.value;
    state.page = 1;
    table.render();
  });

  container.querySelectorAll("[data-datatable-sort]").forEach((button) => {
    button.addEventListener("click", () => {
      const sortKey = button.dataset.sortKey;
      state.sortDirection = state.sortKey === sortKey && state.sortDirection === "asc" ? "desc" : "asc";
      state.sortKey = sortKey;
      table.render();
    });
  });

  container.querySelector("[data-datatable-prev]")?.addEventListener("click", () => {
    state.page = Math.max(1, state.page - 1);
    table.render();
  });

  container.querySelector("[data-datatable-next]")?.addEventListener("click", () => {
    const rows = getVisibleRows(options.rows, options.columns, state);
    state.page = Math.min(getPageCount(rows.length, state.pageSize), state.page + 1);
    table.render();
  });

  container.querySelector("[data-datatable-select-all]")?.addEventListener("change", (event) => {
    const rows = paginateRows(getVisibleRows(options.rows, options.columns, state), state);
    rows.forEach((row) => {
      if (event.target.checked) {
        state.selectedIds.add(row.id);
      } else {
        state.selectedIds.delete(row.id);
      }
    });
    table.render();
  });

  container.querySelectorAll("[data-row-id]").forEach((element) => {
    element.addEventListener("change", (event) => {
      const id = Number(event.target.dataset.rowId);
      event.target.checked ? state.selectedIds.add(id) : state.selectedIds.delete(id);
    });
  });

  container.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = Number(button.dataset.rowId);
      const action = button.dataset.action;
      const row = options.rows.find((item) => item.id === id);
      await handleRowAction(action, row, options);
    });
  });
}

async function handleRowAction(action, row, options) {
  const moduleName = options.moduleName ?? options.title;
  const handledByPage = await options.onActionOverride?.(action, row);

  if (handledByPage === true) {
    return;
  }

  if (action === "delete") {
    const confirmed = await confirmPresets.delete(row?.name ?? "dòng dữ liệu này");

    if (confirmed) {
      toast.success(`Đã xác nhận xóa ${row?.name ?? "dòng dữ liệu"} trên giao diện mẫu.`);
      options.onAction?.(action, row);
    }

    return;
  }

  openCrudModal(action, row, moduleName);
  showActionToast(action, row);
  options.onAction?.(action, row);
}

function showActionToast(action, row) {
  const name = row?.name ?? "dòng dữ liệu";

  if (action === "view") {
    toast.info(`Đang xem chi tiết ${name}.`);
    return;
  }

  if (action === "edit") {
    toast.warning(`Đang chỉnh sửa ${name}.`);
  }
}

function renderTableBody(container, options, state) {
  const surface = container.querySelector(".datatable-surface");

  if (!surface) {
    return;
  }

  const rows = paginateRows(getVisibleRows(options.rows, options.columns, state), state);
  surface.innerHTML = createTable(options, state, rows);
}

function getVisibleRows(rows, columns, state) {
  const keyword = state.search.trim().toLowerCase();

  return rows
    .filter((row) => state.filter === "all" || row.status === state.filter)
    .filter((row) => {
      if (!keyword) {
        return true;
      }

      return columns.some((column) => String(row[column.key] ?? "").toLowerCase().includes(keyword));
    })
    .sort((first, second) => {
      const firstValue = String(first[state.sortKey] ?? "");
      const secondValue = String(second[state.sortKey] ?? "");
      const result = firstValue.localeCompare(secondValue, "vi", { numeric: true });
      return state.sortDirection === "asc" ? result : -result;
    });
}

function paginateRows(rows, state) {
  const start = (state.page - 1) * state.pageSize;
  return rows.slice(start, start + state.pageSize);
}

function getPageCount(totalRows, pageSize) {
  return Math.max(1, Math.ceil(totalRows / pageSize));
}

function getStatusOptions(rows) {
  return ["all", ...new Set(rows.map((row) => row.status))];
}

function createFilterOptions(options, selectedValue) {
  return options.map((option) => {
    const value = typeof option === "string" ? option : option.value;
    const label = typeof option === "string" ? option : option.label;
    const text = value === "all" ? "Tất cả trạng thái" : label;
    return `<option value="${value}" ${value === selectedValue ? "selected" : ""}>${text}</option>`;
  }).join("");
}

function formatCell(value, column, row) {
  if (column.render) {
    return column.render(value, row, column);
  }

  if (column.type === "status") {
    return `<span class="datatable-status ${getStatusClass(value)}">${value}</span>`;
  }

  return escapeHtml(String(value ?? ""));
}

function getStatusClass(value) {
  const status = String(value).toLowerCase();

  if (status.includes("đang")) {
    return "is-success";
  }

  if (status.includes("chờ")) {
    return "is-warning";
  }

  return "is-muted";
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
