import { createProductGrid, initProductGrid } from "../product-grid/product-grid.js";

export function createNewArrivalSection(options = {}) {
  const {
    title = "Hàng mới",
    description = "Những thiết kế mới được tuyển chọn cho mùa này.",
    actionText = "Khám phá",
    actionHref = "#products",
    items = [],
    loading = false,
    empty = false,
    page = 1,
    totalPages = 1,
    onPageChange = null
  } = options;

  return `
    <section class="new-arrival-section" data-new-arrival-section data-reveal>
      <div class="section-heading new-arrival-heading">
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

export function initNewArrivalSection(root = document) {
  initProductGrid(root);
}
