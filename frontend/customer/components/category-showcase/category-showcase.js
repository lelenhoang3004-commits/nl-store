export function createCategoryShowcaseSection(options = {}) {
  const {
    title = "Kh\u00e1m ph\u00e1 theo danh m\u1ee5c",
    description = "B\u1ed9 s\u01b0u t\u1eadp \u0111\u01b0\u1ee3c tuy\u1ec3n ch\u1ecdn d\u00e0nh cho m\u1ecdi c\u1ea3m h\u1ee9ng, kho\u1ea3nh kh\u1eafc v\u00e0 trang ph\u1ee5c.",
    actionText = "Xem t\u1ea5t c\u1ea3",
    collapseText = "Thu g\u1ecdn",
    categories = [],
    initialVisible = 8
  } = options;

  const items = Array.isArray(categories) ? categories : [];
  const visibleLimit = Math.max(1, Number(initialVisible) || 8);
  const hasExtraItems = items.length > visibleLimit;

  return `
    <section class="category-showcase-section" data-category-showcase-section data-category-expanded="false" data-reveal>
      <div class="section-heading category-showcase-heading">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(description)}</p>
        </div>
        ${hasExtraItems ? `<button class="customer-button secondary" type="button" data-category-toggle data-expand-label="${escapeAttr(actionText)}" data-collapse-label="${escapeAttr(collapseText)}">${escapeHtml(actionText)}</button>` : ""}
      </div>
      <div class="category-showcase-grid">
        ${items.length ? items.map((category, index) => createCategoryCard(category, { hidden: index >= visibleLimit })).join("") : createEmptyState()}
      </div>
    </section>
  `;
}

function createCategoryCard(category, options = {}) {
  const image = category.image || "";
  const icon = category.icon || "fa-layer-group";
  const name = category.name || "Danh m\u1ee5c";
  const count = Number(category.productCount || category.count || 0);
  const href = category.href || "#products";
  const hiddenAttrs = options.hidden ? " data-category-extra hidden" : "";

  return `
    <a class="category-showcase-card" href="${escapeAttr(href)}" data-reveal${hiddenAttrs}>
      <div class="category-showcase-media ${image ? "has-image" : "has-icon"}">
        ${image ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(name)}" loading="lazy" decoding="async" onerror="this.closest('.category-showcase-media').classList.remove('has-image');this.closest('.category-showcase-media').classList.add('has-icon');this.replaceWith(Object.assign(document.createElement('span'),{className:'category-showcase-icon',innerHTML:'<i class=&quot;fa-solid ${escapeAttr(icon)}&quot; aria-hidden=&quot;true&quot;></i>'}));">` : `<span class="category-showcase-icon"><i class="fa-solid ${escapeAttr(icon)}" aria-hidden="true"></i></span>`}
      </div>
      <div class="category-showcase-body">
        <h3>${escapeHtml(name)}</h3>
        <p>${count} s\u1ea3n ph\u1ea9m</p>
      </div>
    </a>
  `;
}

function createEmptyState() {
  return `<div class="category-showcase-empty">Ch\u01b0a c\u00f3 danh m\u1ee5c active.</div>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
