import { createProductGrid, initProductGrid } from "../product-grid/product-grid.js";

export function createFeaturedProductsSection(options = {}) {
  const {
    title = "Sản phẩm nổi bật",
    description = "Bộ sưu tập tinh tế của những món đồ cơ bản dành cho phong cách hiện đại.",
    actionText = "Xem tất cả",
    actionHref = "#products",
    items = [],
    loading = false,
    empty = false,
    page = 1,
    totalPages = 1,
    onPageChange = null
  } = options;

  return `
    <section class="featured-products-section" data-featured-products-section data-reveal>
      <div class="section-heading featured-products-heading">
        <div>
          <h2>${title}</h2>
          <p>${description}</p>
        </div>
        <a class="customer-button secondary" href="${actionHref}">${actionText}</a>
      </div>
      ${createProductGrid({ items, loading, empty, page, totalPages, onPageChange })}
    </section>
  `;
}

export function initFeaturedProductsSection(root = document) {
  initProductGrid(root);
}
