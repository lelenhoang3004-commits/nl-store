const API_BASE_URL = globalThis.FASHION_API_BASE_URL ?? (
  ["localhost", "127.0.0.1"].includes(globalThis.location?.hostname)
    ? "http://localhost:5000/api/v1"
    : "https://nl-store.onrender.com/api/v1"
);
const CATEGORY_CACHE_TTL = 5 * 60 * 1000;

const navigationItems = [
  { label: "Trang chủ", href: "#home" },
  { label: "Hàng mới", href: "#new-arrival" },
  { label: "Bán chạy", href: "#best-seller" },
  { label: "Thương hiệu", href: "#brands" }
];

const promoHighlights = [
  { label: "Khuyến mãi", text: "Giảm đến 30% cho bộ sưu tập mới.", href: "#promotion" },
  { label: "Bộ sưu tập", text: "Lớp phối tối giản cho phong cách hiện đại.", href: "#collections" },
  { label: "Thương hiệu", text: "Cùng các đối tác thời trang hàng đầu.", href: "#brands" }
];

let categoryCache = {
  items: [],
  loadedAt: 0,
  promise: null
};

export function createCustomerNavigation() {
  return `
    <nav class="customer-nav" aria-label="Điều hướng chính" data-customer-nav>
      ${navigationItems.map((item) => `<a href="${item.href}">${escapeHtml(item.label)}</a>`).join("")}
      <div class="nav-mega-wrapper">
        <button type="button" aria-expanded="false" data-mega-toggle>
          Danh mục <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
        </button>
        <div class="mega-menu" data-mega-menu>
          <div class="mega-menu-columns" data-mega-category-columns>
            ${createMegaMenuLoading()}
          </div>
          <aside class="mega-menu-sidebar">
            <div class="mega-menu-highlight">
              <span>Khuyến mãi nổi bật</span>
              <strong>Thời trang cao cấp cho mọi khoảnh khắc.</strong>
              <a href="#promotion">Khám phá ngay</a>
            </div>
            <div class="mega-menu-stack">
              ${promoHighlights.map((item) => `<a href="${item.href}"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.text)}</span></a>`).join("")}
            </div>
          </aside>
        </div>
      </div>
    </nav>
  `;
}

export function initCustomerNavigation(root = document) {
  const nav = root.querySelector("[data-customer-nav]");
  const megaToggle = root.querySelector("[data-mega-toggle]");
  const megaMenu = root.querySelector("[data-mega-menu]");
  const currentHref = (window.location.hash || "#home").toLowerCase();
  nav?.querySelectorAll("a").forEach((link) => {
    link.classList.toggle("is-active", link.getAttribute("href")?.toLowerCase() === currentHref);
  });

  loadMegaMenuCategories(root, { staleOk: true });

  megaToggle?.addEventListener("click", () => {
    const isOpen = megaMenu?.classList.toggle("is-open") ?? false;
    megaToggle.setAttribute("aria-expanded", String(isOpen));

    if (isOpen) {
      loadMegaMenuCategories(root);
    }
  });

  megaToggle?.addEventListener("mouseenter", () => {
    loadMegaMenuCategories(root, { staleOk: true });
  });

  nav?.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (link) {
      megaMenu?.classList.remove("is-open");
      megaToggle?.setAttribute("aria-expanded", "false");
      nav.querySelectorAll("a").forEach((item) => item.classList.toggle("is-active", item === link));
    }
  });

  document.addEventListener("click", (event) => {
    if (!nav?.contains(event.target) && !megaToggle?.contains(event.target)) {
      megaMenu?.classList.remove("is-open");
      megaToggle?.setAttribute("aria-expanded", "false");
    }
  });
}

async function loadMegaMenuCategories(root = document, options = {}) {
  const container = root.querySelector("[data-mega-category-columns]");
  if (!container) return;

  try {
    const categories = await getActiveCategories(options);
    container.innerHTML = createMegaMenuColumns(groupCategories(categories));
  } catch (error) {
    console.error("Không tải được danh mục mega menu:", error);
    container.innerHTML = createMegaMenuError();
  }
}

async function getActiveCategories(options = {}) {
  const now = Date.now();
  const cacheFresh = categoryCache.items.length && now - categoryCache.loadedAt < CATEGORY_CACHE_TTL;

  if (cacheFresh || (options.staleOk && categoryCache.items.length)) {
    return categoryCache.items;
  }

  if (!categoryCache.promise) {
    categoryCache.promise = fetchAllCategoryPages()
      .then((items) => {
        categoryCache.items = uniqueCategories(items.map(normalizeCategory));
        categoryCache.loadedAt = Date.now();
        return categoryCache.items;
      })
      .finally(() => {
        categoryCache.promise = null;
      });
  }

  return categoryCache.promise;
}

async function fetchAllCategoryPages() {
  const firstPayload = await fetchCategoryPage(1);
  const categories = getListFromApiPayload(firstPayload, "categories");
  const pagination = firstPayload?.data?.pagination || firstPayload?.meta?.pagination || firstPayload?.pagination || {};
  const totalPages = Math.max(1, Number(pagination.totalPages || pagination.total_pages || 1));

  if (totalPages > 1) {
    const rest = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => fetchCategoryPage(index + 2)));
    rest.forEach((payload) => categories.push(...getListFromApiPayload(payload, "categories")));
  }

  return categories;
}

async function fetchCategoryPage(page = 1) {
  const query = new URLSearchParams({ page: String(page), limit: "100", sortBy: "sortOrder", sortOrder: "asc", _: String(Date.now()) });
  const response = await fetch(`${API_BASE_URL}/categories?${query.toString()}`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Category API failed with status ${response.status}`);
  }

  return response.json();
}

function getListFromApiPayload(payload, key) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.[key])) return payload.data[key];
  return [];
}

function normalizeCategory(category = {}) {
  const name = category.name || "Danh mục";
  const slug = category.slug || category.code || slugify(name);

  return {
    id: category.id,
    name,
    slug
  };
}

function uniqueCategories(categories = []) {
  const seen = new Set();
  return categories.filter((category) => {
    const key = String(category.slug || category.id || category.name || "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function groupCategories(categories = []) {
  const groups = {
    nam: { title: "Nam", links: [] },
    nu: { title: "Nữ", links: [] },
    phuKien: { title: "Phụ kiện", links: [] },
    khac: { title: "Khác", links: [] }
  };

  categories.forEach((category) => {
    groups[getCategoryGroupKey(category)].links.push(category);
  });

  return Object.values(groups).filter((group) => group.links.length);
}

function getCategoryGroupKey(category = {}) {
  const searchable = `${slugify(category.slug)} ${slugify(category.name)}`;

  if (/kinh|dong-ho|trang-suc|day-chuyen|mu|non|tui|phu-kien/.test(searchable)) return "phuKien";
  if (/nu|chan-vay|dam|vay|cao-got/.test(searchable)) return "nu";
  if (/nam|quan-nam|ao-nam|giay-nam/.test(searchable)) return "nam";
  if (/ao-khoac|ao-len|ao-blazer|quan-jeans/.test(searchable)) return "nam";
  if (/giay/.test(searchable)) return "nam";
  return "khac";
}

function createMegaMenuColumns(groups = []) {
  if (!groups.length) {
    return createMegaMenuEmpty();
  }

  return groups.map(createMegaMenuColumn).join("");
}

function createMegaMenuColumn(column) {
  return `
    <details class="mega-menu-group" open>
      <summary>${escapeHtml(column.title)}</summary>
      <div class="mega-menu-links">
        ${column.links.map((item) => {
          const href = `#products?category=${encodeURIComponent(item.slug)}`;
          return `<a href="${href}" data-mega-category="${escapeAttr(item.slug)}">${escapeHtml(item.name)}</a>`;
        }).join("")}
      </div>
    </details>
  `;
}

function createMegaMenuLoading() {
  return `<section class="mega-menu-group mega-menu-status"><h2>Danh mục</h2><p>Đang tải danh mục...</p></section>`;
}

function createMegaMenuEmpty() {
  return `<section class="mega-menu-group mega-menu-status"><h2>Danh mục</h2><p>Chưa có danh mục active.</p></section>`;
}

function createMegaMenuError() {
  return `<section class="mega-menu-group mega-menu-status"><h2>Danh mục</h2><p>Không thể tải danh mục.</p></section>`;
}

function slugify(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
