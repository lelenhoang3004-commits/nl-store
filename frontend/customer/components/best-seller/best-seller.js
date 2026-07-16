import { createProductGrid, initProductGrid } from "../product-grid/product-grid.js";

export function createBestSellerSection(options = {}) {
  const {
    title = "Bán chạy",
    description = "Những sản phẩm được ưa chuộng vì sự thoải mái, chất lượng và phong cách bền vững.",
    actionText = "Mua hàng bán chạy",
    actionHref = "#products",
    items = [],
    loading = false,
    empty = false,
    page = 1,
    totalPages = 1,
    onPageChange = null
  } = options;

  const bestSellerItems = items.map((item) => ({
    ...item,
    badge: item.badge || "Bán chạy"
  }));

  return `
    <section class="best-seller-section" data-best-seller-section data-reveal>
      <div class="section-heading best-seller-heading">
        <div>
          <h2>${title}</h2>
          <p>${description}</p>
        </div>
        <a class="customer-button secondary" href="${actionHref}">${actionText}</a>
      </div>
      ${createProductGrid({ items: bestSellerItems, loading, empty, page, totalPages, onPageChange })}
    </section>
  `;
}

export function initBestSellerSection(root = document) {
  initProductGrid(root);
}
