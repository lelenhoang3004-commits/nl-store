import { createProductGrid, initProductGrid } from "../product-grid/product-grid.js";
import { showCustomerToast } from "../../assets/js/customer-cart.js";

const API_BASE_URL = globalThis.FASHION_API_BASE_URL ?? "http://localhost:5000/api/v1";
const FALLBACK_PRODUCT_IMAGE = "https://placehold.co/900x1125/f1f5f9/334155?text=Fashion+Store";

export function createProductDetailPage() {
  return `
    <div class="customer-container customer-page-shell" data-product-detail-page>
      <section class="premium-section product-detail-loading">
        <div class="skeleton-media"></div>
        <div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
          <div class="skeleton-line"></div>
        </div>
      </section>
    </div>
  `;
}

export async function initProductDetailPage(root = document, productId = "", options = {}) {
  const target = root.querySelector("[data-product-detail-page]");

  if (!target) {
    return;
  }

  if (!productId) {
    renderError(target, "Không tìm thấy mã sản phẩm.");
    return;
  }

  try {
    const product = await loadProduct(productId);
    const relatedProducts = await loadRelatedProducts(product);

    target.innerHTML = createProductDetailMarkup(product, relatedProducts);
    initProductDetailInteractions(target, product, options);
    initProductGrid(target);
  } catch (error) {
    renderError(target, error.message || "Không tải được chi tiết sản phẩm.");
  }
}

function createProductDetailMarkup(product, relatedProducts = []) {
  const images = getProductImages(product);
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const displayPrice = getInitialProductPrice(product, variants);
  const activePrice = displayPrice.activePrice;
  const comparePrice = displayPrice.comparePrice;
  const rating = Number(product.rating || 0);
  const reviews = Array.isArray(product.reviews) ? product.reviews : [];
  const colors = Array.isArray(product.colors) ? product.colors : [];

  return `
    <section class="premium-section product-detail" data-product-detail>
      <div class="product-detail-gallery">
        <div class="product-detail-main-image" data-product-zoom>
          <img src="${escapeAttr(images[0])}" alt="${escapeAttr(product.name)}" data-product-main-image>
        </div>
        <div class="product-detail-thumbs" aria-label="Thư viện ảnh sản phẩm">
          ${images.map((image, index) => `
            <button class="product-detail-thumb ${index === 0 ? "is-active" : ""}" type="button" data-product-thumb="${escapeAttr(image)}" aria-label="Ảnh ${index + 1}">
              <img src="${escapeAttr(image)}" alt="${escapeAttr(product.name)} ${index + 1}">
            </button>
          `).join("")}
        </div>
      </div>

      <article class="product-detail-info">
        <div class="product-detail-meta">
          <span class="ds-tag">${escapeHtml(product.categoryName || "Chưa phân loại")}</span>
          <span class="product-stock ${Number(product.stock || 0) > 0 ? "in-stock" : "out-of-stock"}" data-product-variant-stock>
            ${Number(product.stock || 0) > 0 ? `${Number(product.stock)} tồn kho` : "Hết hàng"}
          </span>
        </div>
        <h1>${escapeHtml(product.name)}</h1>
        <p class="product-detail-sku">SKU: ${escapeHtml(product.sku || "N/A")}</p>

        <div class="product-detail-price">
          <strong>${formatCurrency(activePrice)}</strong>
          ${comparePrice ? `<del>${formatCurrency(comparePrice)}</del>` : ""}
        </div>

        <dl class="product-detail-specs">
          <div><dt>Danh mục</dt><dd>${escapeHtml(product.categoryName || "Chưa cập nhật")}</dd></div>
          <div><dt>Thương hiệu</dt><dd>${escapeHtml(product.brand || "Chưa cập nhật")}</dd></div>
          <div><dt>Đã bán</dt><dd>${Number(product.sold || 0)}</dd></div>
        </dl>

        ${createProductAttributeBox(product)}

        <div class="product-detail-options">
          ${variants.length ? `
            <div class="product-detail-option-group"><span>Màu sắc</span><div class="product-detail-option-list" data-variant-colors>
              ${colors.map((color) => `<button class="product-detail-option is-color" type="button" data-variant-color="${escapeAttr(color.name)}"><i style="background:${escapeAttr(color.code || "#94a3b8")}"></i><span>${escapeHtml(color.name)}</span></button>`).join("")}
            </div></div>
            <div class="product-detail-option-group"><span>Kích thước</span><div class="product-detail-option-list" data-variant-sizes><small>Chọn màu để xem kích thước còn hàng.</small></div></div>
          ` : `<div class="product-detail-option-group product-detail-no-variants"><p>Sản phẩm hiện chưa có biến thể.</p></div>`}
          <label class="product-detail-quantity">
            <span>Số lượng</span>
            <div class="product-quantity-control" data-quantity-control>
              <button type="button" class="customer-qty-btn" data-qty-dec aria-label="Giảm">−</button>
              <input type="number" min="1" max="${Math.max(1, Number(product.stock || 1))}" value="1" data-product-quantity>
              <button type="button" class="customer-qty-btn" data-qty-inc aria-label="Tăng">+</button>
            </div>
          </label>
        </div>

        <div class="product-detail-actions">
          <button class="customer-button" type="button" data-product-detail-add-to-cart ${(variants.length || Number(product.stock || 0) <= 0) ? "disabled" : ""}>
            <i class="fa-solid fa-bag-shopping" aria-hidden="true"></i>
            <span>Thêm vào giỏ</span>
          </button>
          <button class="customer-button secondary" type="button" data-product-detail-buy-now ${(variants.length || Number(product.stock || 0) <= 0) ? "disabled" : ""}>Thanh toán</button>
        </div>

        <div class="product-detail-description">
          <h2>Mô tả</h2>
          <p>${escapeHtml(product.description || product.shortDescription || "Sản phẩm chưa có mô tả.")}</p>
        </div>

        <div class="product-detail-tags">
          <h2>Thẻ</h2>
          <div>
            ${(product.tags || []).length
              ? product.tags.map((tag) => `<span class="ds-tag">${escapeHtml(tag)}</span>`).join("")
              : `<span class="ds-tag">Chưa có thẻ</span>`}
          </div>
        </div>

        <div class="product-detail-reviews">
          <h2>Đánh giá</h2>
          <div class="product-rating" aria-label="Đánh giá ${rating} trên 5">
            <span>${renderStars(rating)}</span>
            <small>${rating ? rating.toFixed(1) : "Chưa có đánh giá"}</small>
          </div>
          ${reviews.length
            ? reviews.map(createReviewItem).join("")
            : `<p>Chưa có dữ liệu đánh giá cho sản phẩm này.</p>`}
        </div>
      </article>
    </section>

    <section class="premium-section product-detail-related">
      <div class="section-heading">
        <div>
          <h2>Sản phẩm liên quan</h2>
          <p>Sản phẩm cùng danh mục được lấy trực tiếp từ API.</p>
        </div>
      </div>
      ${relatedProducts.length
        ? createProductGrid({ items: relatedProducts, page: 1, totalPages: 1 })
        : `<article class="customer-card" style="padding:24px;">Chưa có sản phẩm liên quan.</article>`}
    </section>
  `;
}

function getInitialProductPrice(product, variants = []) {
  const availableVariants = variants.filter((variant) => variant.status === "active");
  if (availableVariants.length) {
    const pricedVariants = availableVariants.map((variant) => {
      const price = variant.price === null || variant.price === undefined ? Number(product.price || 0) : Number(variant.price);
      const salePrice = variant.salePrice === null || variant.salePrice === undefined ? null : Number(variant.salePrice);
      return { activePrice: salePrice ?? price, comparePrice: salePrice !== null ? price : null };
    }).sort((left, right) => left.activePrice - right.activePrice);
    return pricedVariants[0];
  }
  const price = Number(product.price || 0);
  const salePrice = product.salePrice === null || product.salePrice === undefined ? null : Number(product.salePrice);
  return { activePrice: salePrice ?? price, comparePrice: salePrice !== null ? price : null };
}

function createOptionGroup(label, name, options) {
  if (!options.length) {
    return `
      <div class="product-detail-option-group">
        <span>${label}</span>
        <p>Chưa có dữ liệu ${label.toLowerCase()} từ API.</p>
      </div>
    `;
  }

  return `
    <div class="product-detail-option-group">
      <span>${label}</span>
      <div class="product-detail-option-list">
        ${options.map((option, index) => `
          <label class="product-detail-option ${name === "color" ? "is-color" : ""}">
            <input type="radio" name="${name}" value="${escapeAttr(option.value)}" ${index === 0 ? "checked" : ""}>
            ${name === "color" ? `<i style="background:${escapeAttr(option.value)}"></i>` : ""}
            <span>${escapeHtml(option.label)}</span>
          </label>
        `).join("")}
      </div>
    </div>
  `;
}

function createReviewItem(review) {
  return `
    <article class="product-detail-review">
      <strong>${escapeHtml(review.name || review.customerName || "Khách hàng")}</strong>
      <p>${escapeHtml(review.content || review.comment || "")}</p>
    </article>
  `;
}

function initProductDetailInteractions(root, product, options = {}) {
  const mainImage = root.querySelector("[data-product-main-image]");
  const zoomTarget = root.querySelector("[data-product-zoom]");
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const galleryIsSelectable = isSelectableGalleryProduct(product, variants);
  const thumbs = root.querySelector(".product-detail-thumbs");
  if (galleryIsSelectable && thumbs) {
    thumbs.classList.add("is-selectable");
    thumbs.insertAdjacentHTML("beforebegin", '<p class="product-detail-sample-label">Chọn mẫu</p>');
  }

  // remember the selected gallery image (resolved URL) so it can be sent with add-to-cart
  let selectedImageUrl = getProductImages(product)[0];

  root.querySelectorAll("[data-product-thumb]").forEach((button) => {
    button.setAttribute("aria-pressed", button.classList.contains("is-active") ? "true" : "false");
    button.addEventListener("click", () => {
      root.querySelectorAll("[data-product-thumb]").forEach((thumb) => {
        thumb.classList.remove("is-active");
        thumb.setAttribute("aria-pressed", "false");
      });
      button.classList.add("is-active");
      button.setAttribute("aria-pressed", "true");
      // dataset holds the raw attribute (may be escaped); use it as the selected image URL
      selectedImageUrl = button.dataset.productThumb || selectedImageUrl;
      mainImage.src = selectedImageUrl;
    });
  });

  zoomTarget?.addEventListener("mousemove", (event) => {
    const rect = zoomTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    mainImage.style.transformOrigin = `${x}% ${y}%`;
    mainImage.style.transform = "scale(1.8)";
  });

  zoomTarget?.addEventListener("mouseleave", () => {
    mainImage.style.transformOrigin = "center";
    mainImage.style.transform = "scale(1)";
  });

  const addButton = root.querySelector("[data-product-detail-add-to-cart]");
  const buyNowButton = root.querySelector("[data-product-detail-buy-now]");
  const quantityInput = root.querySelector("[data-product-quantity]");
  const qtyIncBtn = root.querySelector("[data-qty-inc]");
  const qtyDecBtn = root.querySelector("[data-qty-dec]");
  const stockLabel = root.querySelector("[data-product-variant-stock]");
  let selectedColor = null;
  let selectedVariant = null;
  let quantity = Number(quantityInput?.value || 1);

  function renderQuantity() {
    if (!quantityInput) return;
    quantityInput.value = String(quantity);
    const maxStock = Number(selectedVariant?.stock || product.stock || 0);
    if (qtyIncBtn) qtyIncBtn.disabled = quantity >= maxStock;
    if (qtyDecBtn) qtyDecBtn.disabled = quantity <= 1;
    quantityInput.disabled = maxStock <= 0;
    addButton.disabled = (variants.length && !selectedVariant) || maxStock <= 0 || quantity < 1 || quantity > maxStock;
    if (buyNowButton) buyNowButton.disabled = addButton.disabled;
  }

  function handleQuantityChange(value) {
    let nextQty = Number(value);
    if (!selectedVariant && variants.length) {
      showCustomerToast("Vui lòng chọn màu sắc và kích thước", "warning");
      quantity = 1;
      renderQuantity();
      return;
    }
    const maxStock = Number(selectedVariant?.stock || product.stock || 0);
    if (maxStock <= 0) {
      quantity = 0;
      showCustomerToast("Biến thể này đã hết hàng", "warning");
      renderQuantity();
      return;
    }
    if (!Number.isFinite(nextQty) || nextQty < 1) nextQty = 1;
    if (nextQty > maxStock) {
      nextQty = maxStock;
      showCustomerToast(`Chỉ còn ${maxStock} sản phẩm trong kho`, "warning");
    }
    quantity = nextQty;
    renderQuantity();
  }

  function increaseQuantity() {
    const maxStock = Number(selectedVariant?.stock || product.stock || 0);
    if (quantity >= maxStock) { showCustomerToast(`Chỉ còn ${maxStock} sản phẩm trong kho`, "warning"); return; }
    quantity += 1; renderQuantity();
  }

  function decreaseQuantity() { if (quantity <= 1) return; quantity -= 1; renderQuantity(); }

  root.querySelectorAll("[data-variant-color]").forEach((button) => button.addEventListener("click", () => {
    selectedColor = button.dataset.variantColor;
    selectedVariant = null;
    root.querySelectorAll("[data-variant-color]").forEach((item) => item.classList.toggle("is-selected", item === button));
    const available = variants.filter((variant) => variant.color === selectedColor && variant.status === "active");
    const sizeTarget = root.querySelector("[data-variant-sizes]");
    sizeTarget.innerHTML = [...new Map(available.map((variant) => [variant.size, variant])).values()].map((variant) => `<button class="product-detail-option" type="button" data-variant-size="${escapeAttr(variant.size)}" ${Number(variant.stock) <= 0 ? "disabled" : ""}>${escapeHtml(variant.size)}${Number(variant.stock) <= 0 ? " · Hết hàng" : ""}</button>`).join("") || "<small>Không còn kích thước khả dụng.</small>";
    addButton.disabled = true;
    if (buyNowButton) buyNowButton.disabled = true;
    stockLabel.textContent = "Chọn kích thước";
    sizeTarget.querySelectorAll("[data-variant-size]").forEach((sizeButton) => sizeButton.addEventListener("click", () => {
      selectedVariant = available.find((variant) => variant.size === sizeButton.dataset.variantSize) || null;
      sizeTarget.querySelectorAll("[data-variant-size]").forEach((item) => item.classList.toggle("is-selected", item === sizeButton));
      const stock = Number(selectedVariant?.stock || 0);
      // update stock UI
      if (stock <= 0) stockLabel.textContent = "Hết hàng";
      else if (stock === 1) stockLabel.textContent = "Còn 1 sản phẩm";
      else if (stock <= 5) stockLabel.textContent = `Sắp hết hàng - chỉ còn ${stock} sản phẩm`;
      else stockLabel.textContent = `${stock} tồn kho`;
      stockLabel.className = `product-stock ${stock > 0 ? "in-stock" : "out-of-stock"}`;
      // reset quantity according to stock
      if (stock > 0) quantity = 1; else quantity = 0;
      if (quantityInput) {
        quantityInput.max = String(Math.max(stock, 1));
        if (Number(quantityInput.value) > stock) quantityInput.value = String(Math.max(stock, 1));
      }
      renderQuantity();
      addButton.disabled = !selectedVariant || stock <= 0;
      if (buyNowButton) buyNowButton.disabled = addButton.disabled;
    }));
  }));

  // quantity input handlers
  quantityInput?.addEventListener("input", (e) => handleQuantityChange(e.target.value));
  qtyIncBtn?.addEventListener("click", () => increaseQuantity());
  qtyDecBtn?.addEventListener("click", () => decreaseQuantity());

  addButton?.addEventListener("click", async () => {
    const maxStock = Number(selectedVariant?.stock || product.stock || 0);
    if (variants.length && !selectedVariant) { showCustomerToast("Vui lòng chọn màu và kích thước", "warning"); return; }
    if (maxStock <= 0) { showCustomerToast("Sản phẩm này đã hết hàng", "warning"); return; }
    if (quantity < 1) { showCustomerToast("Số lượng không hợp lệ", "warning"); quantity = 1; renderQuantity(); return; }
    if (quantity > maxStock) { showCustomerToast(`Chỉ còn ${maxStock} sản phẩm trong kho`, "warning"); quantity = maxStock; renderQuantity(); return; }

    // build payload and include selected image for accessory products without variants
    const payload = variants.length ? {
      productId: product.id,
      variantId: selectedVariant?.id || null,
      size: selectedVariant?.size || null,
      color: selectedVariant?.color || null,
      quantity: Number(quantity)
    } : {
      product_id: product.id,
      variant_id: null,
      size: null,
      color: null,
      quantity: Number(quantity),
      ...(galleryIsSelectable ? { selected_image_url: selectedImageUrl } : {})
    };

    options.onAddToCart?.(payload);
  });

  buyNowButton?.addEventListener("click", () => {
    const maxStock = Number(selectedVariant?.stock || product.stock || 0);
    if (variants.length && !selectedVariant) { showCustomerToast("Vui lòng chọn màu và kích thước", "warning"); return; }
    if (maxStock <= 0) { showCustomerToast("Sản phẩm này đã hết hàng", "warning"); return; }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > maxStock) {
      showCustomerToast(`Số lượng hợp lệ từ 1 đến ${maxStock}`, "warning");
      return;
    }
    const unitPrice = selectedVariant
      ? Number(selectedVariant.salePrice ?? selectedVariant.price ?? product.salePrice ?? product.price ?? 0)
      : Number(product.salePrice ?? product.price ?? 0);
    options.onBuyNow?.({
      product_id: Number(product.id),
      variant_id: selectedVariant?.id || null,
      variant_key: selectedVariant ? `${product.id}|${selectedVariant.id}|${selectedVariant.size}|${selectedVariant.color}` : `${product.id}|base`,
      product_name: product.name,
      product_sku: selectedVariant?.sku || product.sku || null,
      quantity: Number(quantity),
      unit_price: unitPrice,
      size: selectedVariant?.size || null,
      color: selectedVariant?.color || null,
      product_image_url: selectedImageUrl || product.thumbnailUrl || null,
      selected_image_url: !selectedVariant && galleryIsSelectable ? selectedImageUrl : null
    });
  });
}

function isSelectableGalleryProduct(product, variants = []) {
  if (variants.length) return false;
  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const categoryName = product?.categoryName || product?.category?.name || product?.category || "";
  const searchable = `${normalize(categoryName)} ${normalize(product?.name)}`;
  return ["phu kien", "day chuyen", "dong ho"].some((keyword) => searchable.includes(keyword));
}

function createProductAttributeBox(product) {
  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const isAccessory = normalize(product.categoryName).includes("phu kien")
    || normalize(product.categoryName).includes("day chuyen")
    || normalize(product.name).includes("day chuyen");
  const attributes = product.productAttributes;
  if (!isAccessory || !attributes || typeof attributes !== "object") return "";
  const rows = [
    ["Chất liệu", attributes.material],
    ["Độ dài dây", attributes.chain_length],
    ["Loại mặt dây", attributes.pendant_type],
    ["Màu đá / màu mặt", attributes.stone_color],
    ["Kích thước mặt", attributes.pendant_size],
    ["Bảo hành", attributes.warranty]
  ].filter(([, value]) => String(value || "").trim());
  if (!rows.length) return "";
  return `<section class="product-detail-attributes" aria-labelledby="product-attribute-title">
    <h2 id="product-attribute-title">Thông tin dây chuyền</h2>
    <dl>${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>
  </section>`;
}

async function loadProduct(productId) {
  const payload = await fetchJson(`${API_BASE_URL}/products/${encodeURIComponent(productId)}`);
  const product = payload?.data?.product;

  if (!product) {
    throw new Error("Không tìm thấy sản phẩm.");
  }

  return product;
}

async function loadRelatedProducts(product) {
  if (!product?.categoryId) {
    return [];
  }

  const url = new URL(`${API_BASE_URL}/products`);
  url.searchParams.set("categoryId", product.categoryId);
  url.searchParams.set("status", "active");
  url.searchParams.set("limit", "4");

  const payload = await fetchJson(url.toString());
  const products = payload?.data?.products || [];
  return products
    .filter((item) => String(item.id) !== String(product.id))
    .slice(0, 4)
    .map(mapRelatedProduct);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error("Không tải được dữ liệu từ API.");
  }

  return response.json();
}

function mapRelatedProduct(product = {}) {
  const price = Number(product.price || 0);
  const salePrice = product.salePrice ? Number(product.salePrice) : null;

  return {
    id: product.id,
    name: product.name,
    category: product.categoryName || "Sản phẩm",
    image: resolveAssetUrl(product.thumbnailUrl || getProductImages(product)[0]),
    hoverImage: resolveAssetUrl(getProductImages(product)[1] || product.thumbnailUrl || getProductImages(product)[0]),
    price: salePrice || price,
    comparePrice: salePrice ? price : null,
    discount: salePrice && price > salePrice ? Math.round(((price - salePrice) / price) * 100) : 0,
    rating: Number(product.rating || 0),
    sold: Number(product.sold || 0),
    badge: salePrice ? "GIẢM GIÁ" : "MỚI",
    inStock: Number(product.stock || 0) > 0
  };
}

function getProductImages(product = {}) {
  const images = [
    product.thumbnailUrl,
    ...(Array.isArray(product.galleryUrls) ? product.galleryUrls : [])
  ].filter(Boolean).map(resolveAssetUrl);

  return [...new Set(images)].length ? [...new Set(images)] : [FALLBACK_PRODUCT_IMAGE];
}

function resolveAssetUrl(url) {
  if (!url) {
    return "";
  }

  if (/^(https?:)?\/\//i.test(url) || url.startsWith("data:")) {
    return url;
  }

  if (url.startsWith("/")) {
    return `${API_BASE_URL.replace("/api/v1", "")}${url}`;
  }

  return url;
}

function normalizeOptionList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return { label: item, value: item };
      }

      return {
        label: item.label || item.name || item.value,
        value: item.value || item.code || item.hex || item.name || item.label
      };
    })
    .filter((item) => item.label && item.value);
}

function renderError(target, message) {
  target.innerHTML = `
    <section class="premium-section">
      <article class="customer-card" style="padding:24px;">
        <div class="validation-summary" style="display:block;">${escapeHtml(message)}</div>
        <a class="customer-button secondary" href="#home">Về trang chủ</a>
      </article>
    </section>
  `;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(value || 0);
}

function renderStars(rating) {
  const full = Math.max(0, Math.min(5, Math.round(rating || 0)));
  return "&#9733;".repeat(full) + "&#9734;".repeat(5 - full);
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
