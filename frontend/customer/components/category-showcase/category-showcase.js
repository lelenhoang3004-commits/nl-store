export function createCategoryShowcaseSection(options = {}) {
  const {
    title = "Khám phá theo danh mục",
    description = "Bộ sưu tập được tuyển chọn dành cho mọi cảm hứng, khoảnh khắc và trang phục.",
    actionText = "Xem tất cả",
    actionHref = "#products",
    categories = []
  } = options;

  const items = categories.length ? categories : getDefaultCategories();

  return `
    <section class="category-showcase-section" data-category-showcase-section data-reveal>
      <div class="section-heading category-showcase-heading">
        <div>
          <h2>${title}</h2>
          <p>${description}</p>
        </div>
        <a class="customer-button secondary" href="${actionHref}">${actionText}</a>
      </div>
      <div class="category-showcase-grid">
        ${items.map(createCategoryCard).join("")}
      </div>
    </section>
  `;
}

function createCategoryCard(category) {
  const image = category.image || "";
  const icon = category.icon || "fa-layer-group";
  const name = category.name || "Danh mục";
  const count = Number(category.productCount || category.count || 0);
  const href = category.href || "#products";

  return `
    <a class="category-showcase-card" href="${escapeAttr(href)}" data-reveal>
      <div class="category-showcase-media ${image ? "has-image" : "has-icon"}">
        ${image ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(name)}" loading="lazy" decoding="async">` : `<span class="category-showcase-icon"><i class="fa-solid ${escapeAttr(icon)}" aria-hidden="true"></i></span>`}
      </div>
      <div class="category-showcase-body">
        <h3>${escapeHtml(name)}</h3>
        <p>${count} sản phẩm</p>
      </div>
    </a>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function getDefaultCategories() {
  return [
    { name: "Áo khoác", productCount: 24, image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80" },
    { name: "Cơ bản", productCount: 18, image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80" },
    { name: "Phụ kiện", productCount: 12, image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80" },
    { name: "Bộ sưu tập", productCount: 9, image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80" }
  ];
}
