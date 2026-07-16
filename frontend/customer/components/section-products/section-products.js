import { createProductGrid, initProductGrid } from "../product-grid/product-grid.js";
import { createButton, initButtons } from "../button/button.js";
import { createBadge, initBadges } from "../badge/badge.js";
import { createSkeletonGrid, createSkeleton, initSkeletons } from "../skeleton/skeleton.js";
import { createEmptyState, initEmptyStates } from "../empty-state/empty-state.js";
import { createSpinner } from "../loading/loading.js";
import { createBanner, initBanners } from "../banner/banner.js";
import { initCarousel } from "../carousel/carousel.js";
import { createProductCard, initProductCard } from "../product-card/product-card.js";

// Helper to register a global page handler (product-grid uses string handler names)
export function registerSectionPageHandler(name, fn) {
  if (!name || typeof name !== "string") return;
  window[name] = fn;
}

export function createSectionProducts(config = {}) {
  const cfg = {
    id: config.id || "section-products",
    title: config.title || "Sản phẩm",
    subtitle: config.subtitle || "",
    description: config.description || "",
    badge: config.badge || "",
    viewAllHref: config.viewAllHref || "#products",
    items: Array.isArray(config.items) ? config.items : [],
    loading: Boolean(config.loading),
    empty: Boolean(config.empty),
    page: config.page || 1,
    totalPages: config.totalPages || 1,
    onPageChangeHandlerName: config.onPageChangeHandlerName || "",

    // toggles
    showTitle: config.showTitle !== false,
    showSubtitle: config.showSubtitle !== false,
    showDescription: config.showDescription !== false,
    showBadge: Boolean(config.showBadge),
    showToolbar: config.showToolbar === true,
    showPagination: config.showPagination !== false,
    showViewAll: config.showViewAll !== false,
    showLoading: config.showLoading === true,
    showEmptyState: config.showEmptyState !== false,
    showTabs: config.showTabs === true,
    showSearch: config.showSearch === true,

    // callbacks (optional runtime wiring)
    onFilter: config.onFilter || null,
    onSort: config.onSort || null,
    onTabChange: config.onTabChange || null,
    onSearch: config.onSearch || null
  };

  // header
  const header = [];
  header.push(`<div class="section-products-header">`);
  if (cfg.showBadge && cfg.badge) header.push(`<span class="section-badge">${createBadge({ text: cfg.badge, size: 'sm' })}</span>`);
  if (cfg.showTitle) header.push(`<div class="section-products-title"><h2>${cfg.title}</h2>${cfg.showSubtitle && cfg.subtitle ? `<p class="section-subtitle">${cfg.subtitle}</p>` : ""}${cfg.showDescription && cfg.description ? `<p class="section-description">${cfg.description}</p>` : ""}</div>`);
  if (cfg.showViewAll) header.push(`<div class="section-products-cta">${createButton({ label: 'Xem tất cả', variant: 'secondary', size: 'md', attrs: { href: cfg.viewAllHref, role: 'link' } })}</div>`);
  header.push(`</div>`);

  // toolbar
  let toolbar = "";
  if (cfg.showToolbar) {
    toolbar = `
      <div class="section-products-toolbar" role="toolbar">
        <div class="toolbar-left">
          <div class="toolbar-filters">
            <button type="button" class="toolbar-filter-btn" data-filter-btn>Lọc</button>
          </div>
          ${cfg.showTabs ? `<div class="toolbar-tabs" data-section-tabs>${(config.tabs || []).map((t, i) => `<button type="button" class="tab-btn ${i===0? 'is-active':''}" data-tab-index="${i}">${t}</button>`).join("")}</div>` : ""}
        </div>
        <div class="toolbar-right">
          <label class="toolbar-search ${cfg.showSearch ? '' : 'is-hidden'}">
            <input type="search" placeholder="Tìm kiếm sản phẩm" data-section-search />
          </label>
          <select class="toolbar-sort" data-section-sort>
            ${(config.sortOptions || ["Phù hợp","Mới nhất","Giá: Tăng dần","Giá: Giảm dần"]).map(opt => `<option value="${opt}">${opt}</option>`).join("")}
          </select>
        </div>
      </div>
    `;
  }

  // optional banner (uses existing banner component)
  let bannerMarkup = "";
  if (config.banner) {
    // config.banner can be raw HTML or options for createBanner
    bannerMarkup = typeof config.banner === 'string' ? config.banner : createBanner(config.banner);
  }

  // optional carousel (expects config.carousel.items as array of items)
  let carouselMarkup = "";
  if (config.carousel && Array.isArray(config.carousel.items)) {
    const slides = config.carousel.items.map(item => {
      // item can be product (object) or html string
      if (typeof item === 'string') return `<div class="carousel-slide">${item}</div>`;
      // if product-like, render product card inside slide
      return `<div class="carousel-slide">${createProductCard(item)}</div>`;
    }).join("\n");
    carouselMarkup = `
      <div class="section-products-carousel">
        <div class="carousel">
          <div class="carousel-track">
            ${slides}
          </div>
        </div>
      </div>
    `;
  }

  // loading/skeleton/empty handling
  let preGridMarkup = "";
  if (cfg.showLoading && cfg.loading) {
    if (config.useSkeleton) {
      preGridMarkup = `<div class="section-products-skeleton">${createSkeletonGrid(config.skeletonCount || 6, config.skeletonCols || 3)}</div>`;
    } else {
      preGridMarkup = `<div class="section-products-loading">${createSpinner({ size: 40 })}</div>`;
    }
  }

  // empty state
  let emptyMarkup = "";
  if (cfg.showEmptyState && cfg.empty) {
    if (config.emptyHtml && typeof config.emptyHtml === 'string') emptyMarkup = config.emptyHtml;
    else emptyMarkup = createEmptyState({ type: config.emptyType || 'no-search', title: config.emptyTitle, message: config.emptyMessage, actions: config.emptyActions || [] });
  }

  // product grid (delegate to existing component)
  const grid = createProductGrid({
    items: cfg.items,
    loading: cfg.loading,
    empty: cfg.empty,
    page: cfg.page,
    totalPages: cfg.totalPages,
    onPageChange: cfg.onPageChangeHandlerName
  });

  // combine
  return `
    <section id="${cfg.id}" class="section-products" data-section-products>
      <div class="section-products-shell customer-container">
        ${bannerMarkup}
        ${header.join("\n")}
        ${toolbar}
        ${carouselMarkup}
        ${preGridMarkup}
        <div class="section-products-grid">
          ${grid}
        </div>
        ${emptyMarkup}
      </div>
    </section>
  `;
}

export function initSectionProducts(root = document, config = {}) {
  // init product grid behaviours
  initProductGrid(root);
  // init product card interactions (hover, actions)
  initProductCard(root);

  // init buttons and badges inside section
  initButtons(root);
  initBadges(root);
  initSkeletons && initSkeletons(root);
  initEmptyStates(root);
  initBanners(root);

  // toolbar interactions
  const section = root.querySelector("[data-section-products]");
  if (!section) return;

  // initialize carousel instances inside this section
  try { initCarousel(section, config.carousel || {}); } catch (e) { /* ignore if none */ }

  const search = section.querySelector("[data-section-search]");
  const sort = section.querySelector("[data-section-sort]");
  const tabs = section.querySelectorAll("[data-section-tabs] .tab-btn");

  if (search) {
    search.addEventListener('input', (e) => {
      const handler = config.onSearch;
      if (typeof handler === 'function') handler(e.target.value);
    });
  }

  if (sort) {
    sort.addEventListener('change', (e) => {
      const handler = config.onSort;
      if (typeof handler === 'function') handler(e.target.value);
    });
  }

  if (tabs && tabs.length) {
    tabs.forEach((btn) => btn.addEventListener('click', (e) => {
      tabs.forEach(b => b.classList.remove('is-active'));
      e.currentTarget.classList.add('is-active');
      const idx = Number(e.currentTarget.dataset.tabIndex);
      const handler = config.onTabChange;
      if (typeof handler === 'function') handler(idx);
    }));
  }
}
