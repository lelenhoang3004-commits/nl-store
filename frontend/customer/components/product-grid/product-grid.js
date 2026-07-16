import { createProductCard, createProductCardSkeleton, initProductCard } from "../product-card/product-card.js";

export function createProductGrid(options = {}) {
  const {
    items = [],
    loading = false,
    empty = false,
    page = 1,
    totalPages = 1,
    onPageChange = null
  } = options;

  if (loading) {
    return `
      <section class="product-grid-shell" data-product-grid-shell>
        <div class="product-grid product-grid-loading" aria-live="polite">
          ${createProductCardSkeleton(8)}
        </div>
      </section>
    `;
  }

  if (empty) {
    return `
      <section class="product-grid-shell" data-product-grid-shell>
        <div class="product-grid-empty" role="status">
          <div class="empty-icon"><i class="fa-solid fa-box-open" aria-hidden="true"></i></div>
          <h3>Chưa có sản phẩm</h3>
          <p>Sản phẩm mới sẽ xuất hiện khi danh mục được kết nối.</p>
        </div>
      </section>
    `;
  }

  const visibleItems = Array.isArray(items) ? items : [];
  const pageItems = visibleItems.slice((page - 1) * 8, page * 8);

  return `
    <section class="product-grid-shell" data-product-grid-shell>
      <div class="product-grid" data-product-grid>
        ${pageItems.map((item) => createProductCard(item)).join("")}
      </div>
      ${renderPagination(page, totalPages, onPageChange)}
    </section>
  `;
}

export function initProductGrid(root = document) {
  initProductCard(root);

  root.querySelectorAll("[data-page-btn]").forEach((button) => {
    button.addEventListener("click", () => {
      const page = Number(button.dataset.pageBtn);
      const handler = button.dataset.pageHandler;
      if (handler && typeof window[handler] === "function") {
        window[handler](page);
      }
    });
  });
}

function renderPagination(page, totalPages, onPageChange) {
  if (totalPages <= 1) {
    return "";
  }

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return `
    <nav class="product-pagination" aria-label="Phân trang sản phẩm">
      <button class="product-page-btn" type="button" ${page <= 1 ? "disabled" : ""} data-page-btn="${Math.max(1, page - 1)}" data-page-handler="${onPageChange || ""}">
        <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
      </button>
      ${pages.map((value) => `
        <button class="product-page-btn ${value === page ? "is-active" : ""}" type="button" data-page-btn="${value}" data-page-handler="${onPageChange || ""}">
          ${value}
        </button>
      `).join("")}
      <button class="product-page-btn" type="button" ${page >= totalPages ? "disabled" : ""} data-page-btn="${Math.max(1, Math.min(totalPages, page + 1))}" data-page-handler="${onPageChange || ""}">
        <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
      </button>
    </nav>
  `;
}
