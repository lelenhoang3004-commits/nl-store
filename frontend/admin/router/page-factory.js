import { adminTableColumns, createAdminMockRows, mountDataTable } from "../components/datatable/datatable.js";

export function createGenericAdminPage(route) {
  return `
    <section class="page-placeholder" aria-labelledby="${route.path}-title">
      <article class="page-placeholder-card">
        <p class="dashboard-eyebrow">Admin Module</p>
        <h1 id="${route.path}-title">${route.title}</h1>
        <p>
          Layout giữ nguyên Sidebar, Header và Footer. Router chỉ thay đổi vùng Content.
          Module này đang dùng dữ liệu giả và sẵn sàng thay bằng API ở bước sau.
        </p>
      </article>
      <div data-router-table></div>
    </section>
  `;
}

export function initGenericAdminPage(root, route) {
  const tableContainer = root.querySelector("[data-router-table]");

  if (!tableContainer) {
    return;
  }

  const table = mountDataTable(tableContainer, {
    moduleName: route.title,
    title: `Danh sách ${route.title}`,
    description: "Danh sách dữ liệu của mô-đun quản trị.",
    columns: adminTableColumns,
    rows: createAdminMockRows(route.title),
    onAction(action, row) {
      window.dispatchEvent(new CustomEvent("fashion-admin-page-action", {
        detail: { action, row, route }
      }));
    }
  });

  return () => {
    table.destroy();
  };
}

export function createNotFoundPage(route) {
  return `
    <section class="page-placeholder" aria-labelledby="not-found-title">
      <article class="page-placeholder-card">
        <p class="dashboard-eyebrow">404</p>
        <h1 id="not-found-title">Không tìm thấy trang</h1>
        <p>
          Route <strong>#${route.requestedPath ?? "unknown"}</strong> không tồn tại trong Admin Router.
          Vui lòng chọn một mục trong sidebar để tiếp tục.
        </p>
      </article>
    </section>
  `;
}
