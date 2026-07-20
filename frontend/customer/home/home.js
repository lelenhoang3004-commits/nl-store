import { createProductGrid, initProductGrid } from "../components/product-grid/product-grid.js";
import { createHeroComponent, initHeroComponent } from "../components/hero/hero.js";
import { createFlashSaleSection, initFlashSaleSection } from "../components/flash-sale/flash-sale.js";
import { createFeaturedProductsSection, initFeaturedProductsSection } from "../components/featured-products/featured-products.js";
import { createNewArrivalSection, initNewArrivalSection } from "../components/new-arrival/new-arrival.js";
import { createBestSellerSection, initBestSellerSection } from "../components/best-seller/best-seller.js";
import { createCategoryShowcaseSection } from "../components/category-showcase/category-showcase.js";
import { createBrandShowcaseSection, initBrandShowcaseSection } from "../components/brand-showcase/brand-showcase.js";
import { createCustomerReviewsSection, initCustomerReviewsSection } from "../components/customer-reviews/customer-reviews.js";

const API_BASE_URL = globalThis.FASHION_API_BASE_URL ?? (
  ["localhost", "127.0.0.1"].includes(globalThis.location?.hostname)
    ? "http://localhost:5000/api/v1"
    : "https://nl-store.onrender.com/api/v1"
);
const API_ORIGIN = globalThis.FASHION_API_ORIGIN ?? API_BASE_URL.replace(/\/api\/v1\/?$/, "");

const contentShape = {
  hero: {
    eyebrow: "Bá»™ sÆ°u táº­p 2026",
    title: "Thá»i trang hiá»‡n Ä‘áº¡i cho phong cÃ¡ch má»—i ngÃ y.",
    description: "Tráº£i nghiá»‡m mua sáº¯m thá»i trang cao cáº¥p, tinh táº¿ vÃ  dá»… sá»­ dá»¥ng.",
    primaryCta: "Mua sáº¯m ngay",
    secondaryCta: "KhÃ¡m phÃ¡ thÃªm"
  },
  flashSale: {
    eyebrow: "Khuyáº¿n mÃ£i giá»›i háº¡n",
    title: "Khuyáº¿n mÃ£i giá»›i háº¡n",
    subtitle: "Nhá»¯ng lá»±a chá»n ná»•i báº­t vá»›i má»©c giÃ¡ tá»‘t trong thá»i gian cÃ³ háº¡n."
  },
  categories: [
    { title: "Nam", subtitle: "Nhá»¯ng mÃ³n Ä‘á»“ may Ä‘o cÆ¡ báº£n", icon: "fa-shirt" },
    { title: "Ná»¯", subtitle: "Phom dÃ¡ng má»m máº¡i", icon: "fa-person-dress" },
    { title: "Phá»¥ kiá»‡n", subtitle: "Phong cÃ¡ch sang trá»ng nháº¹ nhÃ ng", icon: "fa-glasses" },
    { title: "Bá»™ sÆ°u táº­p", subtitle: "Lá»›p phá»‘i tá»‘i giáº£n", icon: "fa-layer-group" }
  ],
  reviews: [
    { quote: "Tráº£i nghiá»‡m mÆ°á»£t mÃ , tinh táº¿ vÃ  phÃ¹ há»£p vá»›i phong cÃ¡ch sá»‘ng hiá»‡n Ä‘áº¡i.", author: "Mina, London" },
    { quote: "Nhanh chÃ³ng, tinh táº¿ vÃ  bá»‘ cá»¥c Ä‘áº¹p máº¯t tá»« Ä‘áº§u Ä‘áº¿n cuá»‘i.", author: "Noah, Sydney" },
    { quote: "Má»—i pháº§n Ä‘á»u Ä‘Æ°á»£c chÄƒm chÃºt ká»¹ lÆ°á»¡ng vÃ  ráº¥t Ä‘Ã¡ng tin cáº­y.", author: "Alicia, Toronto" }
  ]
};

const productCatalog = [
  { id: "s1", name: "Ão khoÃ¡c linen nháº¹", category: "Ão khoÃ¡c", image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80", hoverImage: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80", price: 1290000, comparePrice: 1590000, discount: 19, rating: 4.8, sold: 184, badge: "Má»šI", inStock: true },
  { id: "s2", name: "Ão len dÃ¡ng Ã´m", category: "Lá»›p phá»‘i", image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80", hoverImage: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80", price: 890000, comparePrice: 1190000, discount: 25, rating: 4.7, sold: 142, badge: "HOT", inStock: true },
  { id: "s3", name: "Ão khoÃ¡c trench má»m", category: "CÆ¡ báº£n", image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80", hoverImage: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80", price: 1090000, comparePrice: 1390000, discount: 21, rating: 4.9, sold: 267, badge: "GIáº¢M GIÃ", inStock: true },
  { id: "s4", name: "TÃºi tote tá»‘i giáº£n", category: "Phá»¥ kiá»‡n", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80", hoverImage: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80", price: 760000, comparePrice: 920000, discount: 17, rating: 4.6, sold: 92, badge: "Má»šI", inStock: true },
  { id: "s5", name: "Ão khoÃ¡c tiá»‡n dá»¥ng Ä‘Ã´ thá»‹", category: "Ão khoÃ¡c", image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80", hoverImage: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80", price: 1490000, comparePrice: 1790000, discount: 16, rating: 4.8, sold: 221, badge: "HOT", inStock: true },
  { id: "s6", name: "TÃºi xÃ¡ch sang trá»ng", category: "Phá»¥ kiá»‡n", image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80", hoverImage: "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=900&q=80", price: 1160000, comparePrice: 1380000, discount: 15, rating: 4.7, sold: 111, badge: "GIáº¢M GIÃ", inStock: true },
  { id: "s7", name: "Ão sÆ¡ mi hiá»‡n Ä‘áº¡i", category: "Nam", image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80", hoverImage: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80", price: 940000, comparePrice: 1120000, discount: 16, rating: 4.5, sold: 88, badge: "Má»šI", inStock: false },
  { id: "s8", name: "Bá»™ knit studio", category: "Bá»™ sÆ°u táº­p", image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80", hoverImage: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80", price: 1360000, comparePrice: 1640000, discount: 17, rating: 4.9, sold: 154, badge: "Má»šI", inStock: true }
];


const FALLBACK_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80";

function getListFromApiPayload(payload, key = "items") {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.[key])) return payload.data[key];
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data?.products)) return payload.data.products;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.products)) return payload.products;
  return [];
}

function resolveAssetUrl(value) {
  if (!value) return FALLBACK_PRODUCT_IMAGE;
  return globalThis.normalizeImageUrl?.(value) ?? value;
}

function getPreferredProductImage(product = {}) {
  const galleryUrls = Array.isArray(product.galleryUrls)
    ? product.galleryUrls
    : Array.isArray(product.gallery_urls)
      ? product.gallery_urls
      : [];
  const candidates = [product.thumbnailUrl, product.thumbnail_url, product.imageUrl, product.image_url, ...galleryUrls]
    .filter(Boolean)
    .map(resolveAssetUrl);
  const uniqueCandidates = [...new Set(candidates)].sort((left, right) => Number(isAbsoluteHttpUrl(right)) - Number(isAbsoluteHttpUrl(left)));
  return uniqueCandidates[0] || FALLBACK_PRODUCT_IMAGE;
}

function isAbsoluteHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function mapApiProduct(product = {}) {
  const price = Number(product.price || 0);
  const salePrice = product.salePrice ? Number(product.salePrice) : null;
  const finalPrice = salePrice || price;

  return {
    id: product.id,
    name: product.name,
    category: product.categoryName || "Sáº£n pháº©m",
    image: getPreferredProductImage(product),
    hoverImage: "",
    thumbnailUrl: getPreferredProductImage(product),
    imageUrl: getPreferredProductImage(product),
    selectedImageUrl: getPreferredProductImage(product),
    price: finalPrice,
    salePrice,
    finalPrice,
    comparePrice: salePrice ? price : null,
    discount: salePrice && price > salePrice
      ? Math.round(((price - salePrice) / price) * 100)
      : 0,
    rating: Number(product.ratingAverage ?? product.rating_average ?? product.rating ?? 4.8),
    sold: Number(product.sold || 0),
    badge: salePrice ? "GIáº¢M GIÃ" : "Má»šI",
    inStock: Number(product.stock || 0) > 0,
    stock: Number(product.stock || 0),
    variantCount: Number(product.variantCount ?? product.variant_count ?? (Array.isArray(product.variants) ? product.variants.length : 0)),
    hasVariants: Number(product.variantCount ?? product.variant_count ?? (Array.isArray(product.variants) ? product.variants.length : 0)) > 0,
    variants: Array.isArray(product.variants) ? product.variants : []
  };
}

async function loadProductsFromApi() {
  try {
    const response = await fetch(`${API_BASE_URL}/products`);
    const payload = await response.json();

    const products = getListFromApiPayload(payload, "products").map(mapApiProduct);

    return products.length ? products : productCatalog;
  } catch (error) {
    console.error("KhÃ´ng táº£i Ä‘Æ°á»£c sáº£n pháº©m tá»« API:", error);
    return productCatalog;
  }
}

async function loadHomepageData() {
  const [products, categories] = await Promise.all([
    loadProductsFromApi(),
    loadCategoriesFromApi()
  ]);

  return {
    products,
    categories
  };
}

async function loadCategoriesFromApi() {
  try {
    const firstPayload = await fetchCategoryPage(1);
    const categories = getListFromApiPayload(firstPayload, "categories");
    const pagination = firstPayload?.data?.pagination || firstPayload?.meta?.pagination || firstPayload?.pagination || {};
    const totalPages = Math.max(1, Number(pagination.totalPages || pagination.total_pages || 1));

    if (totalPages > 1) {
      const rest = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) => fetchCategoryPage(index + 2))
      );

      rest.forEach((payload) => {
        categories.push(...getListFromApiPayload(payload, "categories"));
      });
    }

    return categories.map(normalizeHomeCategory);
  } catch (error) {
    console.error("Kh??ng t???i ???????c danh m???c t??? API:", error);
    return [];
  }
}

async function fetchCategoryPage(page = 1) {
  const query = new URLSearchParams({ page: String(page), limit: "100", sortBy: "sortOrder", sortOrder: "asc", _: String(Date.now()) });
  const response = await fetch(`${API_BASE_URL}/categories?${query.toString()}`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Category API failed with status ${response.status}`);
  }

  return response.json();
}

function normalizeHomeCategory(category = {}) {
  const name = category.name || "Danh má»¥c";
  const slug = category.slug || category.code || slugifyCategoryName(name);
  const productCount = Number(category.productCount ?? category.product_count ?? category.productsCount ?? category.totalProducts ?? category.total_products ?? 0);
  const image = category.imageUrl || category.image_url || category.thumbnailUrl || category.thumbnail_url || category.coverImage || category.cover_image || getCategoryImageByName(name);

  return {
    id: category.id,
    name,
    slug,
    productCount,
    image,
    icon: category.icon || getCategoryIconByName(name),
    href: `#products?category=${encodeURIComponent(slug)}`
  };
}

function getHomeCategories(categories = []) {
  const source = Array.isArray(categories) ? categories : [];
  const seen = new Set();

  return source.filter((category) => {
    const key = String(category.slug || category.id || category.name || "").trim().toLowerCase();

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function slugifyCategoryName(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/Ä‘/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "products";
}

function getCategoryImageByName(name = "") {
  const key = slugifyCategoryName(name);
  const images = {
    "ao-khoac": "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=600&q=80",
    "ao-len": "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=600&q=80",
    "chan-vay": "https://images.unsplash.com/photo-1583496661160-fb5886a13d27?auto=format&fit=crop&w=600&q=80",
    "giay": "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80",
    "mu-non": "https://images.unsplash.com/photo-1521369909029-2afed882baee?auto=format&fit=crop&w=600&q=80",
    "tui-xach": "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80",
    "dong-ho": "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=600&q=80",
    "trang-suc": "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=600&q=80",
    "kinh-mat": "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=600&q=80"
  };
  return images[key] || "";
}

function getCategoryIconByName(name = "") {
  const key = slugifyCategoryName(name);
  if (key.includes("giay")) return "fa-shoe-prints";
  if (key.includes("mu")) return "fa-hat-cowboy";
  if (key.includes("day") || key.includes("trang-suc")) return "fa-gem";
  if (key.includes("kinh")) return "fa-glasses";
  if (key.includes("dong-ho")) return "fa-clock";
  if (key.includes("tui")) return "fa-bag-shopping";
  if (key.includes("vay") || key.includes("dam")) return "fa-person-dress";
  return "fa-shirt";
}

export function createHomePage() {
  return `
    <div class="customer-container customer-page-shell" data-home-content>
      ${createSkeletonShell()}
    </div>
  `;
}

let homePageDataCache = null;
let homePageLoadPromise = null;

async function loadHomePage(target) {
  if (!target || target.dataset.loaded === "true" || target.dataset.loaded === "loading") {
    return;
  }

  target.dataset.loaded = "loading";

  try {
    const data = await getHomePageData();
    renderHomeContent(target, data.products, data.categories);
  } catch (error) {
    console.error("Lá»—i táº£i trang chá»§:", error);
    target.dataset.loaded = "error";
    target.innerHTML = createHomeErrorState();
  }
}

function getHomePageData() {
  if (!homePageLoadPromise) {
    homePageLoadPromise = loadHomepageData().finally(() => {
      homePageLoadPromise = null;
    });
  }

  return homePageLoadPromise;
}

function renderHomeContent(target, products, categories) {
  window.__homepageProducts = products;
  target.innerHTML = createPremiumHomepageMarkup(products, categories);
  target.dataset.loaded = "true";

  setupRevealAnimation(target);
  initHeroComponent(target);
  initProductGrid(target);
  initFlashSaleSection(target);
  initFeaturedProductsSection(target);
  initNewArrivalSection(target);
  initBestSellerSection(target);
  initBrandShowcaseSection(target);
  initCustomerReviewsSection(target);
  initCategoryShowcaseToggle(target);
}

function initCategoryShowcaseToggle(root = document) {
  root.querySelectorAll("[data-category-showcase-section]").forEach((section) => {
    if (section.dataset.categoryToggleBound === "true") {
      return;
    }

    const button = section.querySelector("[data-category-toggle]");
    const extraItems = Array.from(section.querySelectorAll("[data-category-extra]"));

    if (!button || !extraItems.length) {
      return;
    }

    section.dataset.categoryToggleBound = "true";
    const expandLabel = button.dataset.expandLabel || "Xem t\u1ea5t c\u1ea3";
    const collapseLabel = button.dataset.collapseLabel || "Thu g\u1ecdn";

    const syncExpandedState = (expanded) => {
      section.dataset.categoryExpanded = String(expanded);
      extraItems.forEach((item) => {
        item.hidden = !expanded;
      });
      button.textContent = expanded ? collapseLabel : expandLabel;
    };

    syncExpandedState(false);

    button.addEventListener("click", () => {
      syncExpandedState(section.dataset.categoryExpanded !== "true");
    });
  });
}

function createHomeErrorState() {
  return `
    <section class="customer-empty-state" data-reveal>
      <h2>KhÃ´ng thá»ƒ táº£i trang chá»§</h2>
      <p>ÄÃ£ xáº£y ra lá»—i khi táº£i sáº£n pháº©m. Vui lÃ²ng thá»­ láº¡i sau.</p>
      <a class="customer-button" href="#home">Thá»­ láº¡i</a>
    </section>
  `;
}

export function initHomePage(root = document) {
  const target = root.querySelector("[data-home-content]");

  if (!target) {
    return;
  }

  return loadHomePage(target);
}
function createPremiumHomepageMarkup(products = productCatalog, categories = []) {
  const jewelryProducts = products.filter(isJewelryProduct);
  return `
    ${createHeroComponent()}

    <section id="flash-sale" class="premium-section" data-reveal>
      ${createFlashSaleSection({
    title: contentShape.flashSale.eyebrow,
    subtitle: contentShape.flashSale.subtitle,
    items: products.slice(0, 4),
    page: 1,
    totalPages: 1
  })}
    </section>

    <section id="featured-product" class="premium-section" data-reveal>
      ${createFeaturedProductsSection({
    title: "Sáº£n pháº©m ná»•i báº­t",
    description: "Lá»±a chá»n Ä‘áº·c sáº¯c Ä‘á»ƒ nÃ¢ng táº§m tá»§ Ä‘á»“ vá»›i phong thÃ¡i tá»± tin vÃ  tinh táº¿.",
    actionText: "Xem chi tiáº¿t",
    actionHref: "#story",
    items: products.slice(0, 8),
    page: 1,
    totalPages: 1
  })}
    </section>

    <section id="new-arrival" class="premium-section" data-reveal>
      ${createNewArrivalSection({
    title: "HÃ ng má»›i",
    description: "Nhá»¯ng thiáº¿t káº¿ má»›i tÆ°Æ¡i táº¯n cho phong cÃ¡ch chuyá»ƒn Ä‘á»™ng hiá»‡n Ä‘áº¡i vÃ  trang phá»¥c hÃ ng ngÃ y nÃ¢ng táº§m.",
    actionText: "KhÃ¡m phÃ¡",
    actionHref: "#products",
    items: products.slice(0, 4),
    page: 1,
    totalPages: 1
  })}
    </section>

    <section id="best-seller" class="premium-section" data-reveal>
      ${createBestSellerSection({
    title: "BÃ¡n cháº¡y",
    description: "CÃ¡c bá»™ sÆ°u táº­p cÃ¢n báº±ng giá»¯a sá»± thoáº£i mÃ¡i, phom dÃ¡ng vÃ  tÃ­nh linh hoáº¡t.",
    actionText: "Mua hÃ ng bÃ¡n cháº¡y",
    actionHref: "#products",
    items: products.slice(0, 4),
    page: 1,
    totalPages: 2,
    onPageChange: "handleProductGridPage"
  })}
    </section>

    <section id="categories" class="premium-section" data-reveal>
      ${createCategoryShowcaseSection({
    title: "Danh m\u1ee5c",
    description: "Duy\u1ec7t theo phong c\u00e1ch, ch\u1ee9c n\u0103ng v\u00e0 m\u00f9a m\u1ed9t c\u00e1ch thu\u1eadn ti\u1ec7n.",
    actionText: "Xem t\u1ea5t c\u1ea3",
    collapseText: "Thu g\u1ecdn",
    categories: getHomeCategories(categories),
    initialVisible: 8
  })}
    </section>

    <section id="jewelry" class="premium-section" data-reveal>
      <div class="section-heading">
        <div>
          <h2>Trang sá»©c</h2>
          <p>KhÃ¡m phÃ¡ cÃ¡c máº«u dÃ¢y chuyá»n Ä‘Æ°á»£c láº¥y trá»±c tiáº¿p tá»« danh má»¥c sáº£n pháº©m.</p>
        </div>
      </div>
      ${createProductGrid({
        items: jewelryProducts,
        empty: jewelryProducts.length === 0,
        page: 1,
        totalPages: Math.max(1, Math.ceil(jewelryProducts.length / 8))
      })}
    </section>

    <section id="brands" class="premium-section" data-reveal>
      ${createBrandShowcaseSection({
    title: "ThÆ°Æ¡ng hiá»‡u",
    description: "Nhá»¯ng nhÃ£n hÃ ng uy tÃ­n vÃ  dáº¥u áº¥n riÃªng táº¡o nÃªn phong cÃ¡ch.",
    brands: [
      { name: "AURELIA" },
      { name: "ATLAS" },
      { name: "NOVA" },
      { name: "LINO" },
      { name: "MERCER" },
      { name: "ORION" }
    ]
  })}
    </section>

    <section id="reviews" class="premium-section" data-reveal>
      ${createCustomerReviewsSection({
    title: "ÄÃ¡nh giÃ¡",
    description: "Tráº£i nghiá»‡m Ä‘Æ°á»£c thiáº¿t káº¿ Ä‘á»ƒ cáº£m giÃ¡c trá»±c quan, tinh táº¿ vÃ  Ä‘Ã¡ng tin cáº­y.",
    reviews: [
      { name: "Mina Lee", role: "BiÃªn táº­p phong cÃ¡ch", content: "Tráº£i nghiá»‡m tháº­t sá»± Ä‘Æ°á»£c chÄƒm chÃºt nhÆ° chÃ­nh nhá»¯ng sáº£n pháº©m mÃ¬nh Ä‘ang mua.", rating: 5 },
      { name: "Noah Kim", role: "KhÃ¡ch hÃ ng thÆ°á»ng xuyÃªn", content: "Má»i thá»© dá»… duyá»‡t vÃ  cáº£m giÃ¡c sang trá»ng váº«n Ä‘Æ°á»£c giá»¯ nguyÃªn tá»« Ä‘áº§u Ä‘áº¿n cuá»‘i.", rating: 5 },
      { name: "Alicia Tran", role: "GiÃ¡m Ä‘á»‘c sÃ¡ng táº¡o", content: "Má»™t cá»­a hÃ ng Ä‘Æ°á»£c thiáº¿t káº¿ vá»«a thÆ° thÃ¡i vá»«a giÃºp chá»n lá»±a sáº£n pháº©m trá»Ÿ nÃªn dá»… dÃ ng.", rating: 5 },
      { name: "Jules Carter", role: "NgÆ°á»i mua cao cáº¥p", content: "CÃ¡ch ká»ƒ chuyá»‡n vá» sáº£n pháº©m vÃ  bá»‘ cá»¥c Ä‘á»u Ä‘áº¹p, trá»±c quan vÃ  dá»… hiá»ƒu.", rating: 5 }
    ]
  })}
    </section>

  `;
}

function isJewelryProduct(product = {}) {
  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const searchable = `${normalize(product.name)} ${normalize(product.category)} ${normalize(product.categoryName)}`;
  return searchable.includes("day chuyen") || searchable.includes("trang suc");
}

function createSkeletonShell() {
  return `
    <section class="premium-hero skeleton-shell" data-reveal>
      <div class="skeleton-block skeleton-title"></div>
      <div class="skeleton-block skeleton-copy"></div>
      <div class="skeleton-block skeleton-copy short"></div>
      <div class="skeleton-row">
        <div class="skeleton-pill"></div>
        <div class="skeleton-pill"></div>
      </div>
    </section>
    <section class="premium-section skeleton-section" data-reveal>
      <div class="skeleton-block skeleton-title"></div>
      <div class="product-grid">
        ${createSkeletonCards(4)}
      </div>
    </section>
  `;
}

function createSkeletonCards(count) {
  return Array.from({ length: count }, () => `
    <div class="skeleton-card">
      <div class="skeleton-media"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line short"></div>
    </div>
  `).join("");
}

window.handleProductGridPage = function handleProductGridPage(page) {
  const target = document.querySelector("[data-home-content]");
  if (!target) {
    return;
  }

  const current = target.querySelector("[data-product-grid-shell]");
  if (!current) {
    return;
  }

  const products = window.__homepageProducts || productCatalog;
  current.outerHTML = createProductGrid({
    items: products,
    page,
    totalPages: Math.ceil(products.length / 8),
    onPageChange: "handleProductGridPage"
  });
  initProductGrid(target);
};

function setupRevealAnimation(root) {
  const revealItems = root.querySelectorAll("[data-reveal]");

  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealItems.forEach((item) => observer.observe(item));
}

