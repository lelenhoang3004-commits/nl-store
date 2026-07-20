import { toast } from "../components/toast/toast.js";
import { activateModalUX } from "../components/modal/modal-ux.js";
import { hasPermission } from "../permissions/access-control.js";
import { PERMISSIONS } from "../permissions/permissions.js";
import { loadTemplate } from "../router/template-cache.js";
import { categoryService } from "../services/category.service.js";
import { productService } from "../services/product.service.js";
import { uploadService } from "../services/upload.service.js";
import { syncProductVariantState } from "./variant-state.js";

const OLD_UPLOAD_LOST_MESSAGE = "Ảnh cũ đã mất, vui lòng tải lại ảnh.";
const PLACEHOLDER = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100%25' height='100%25' fill='%23eef2f7'/%3E%3Ctext x='50%25' y='52%25' text-anchor='middle' fill='%2364748b' font-size='12'%3EKhong co anh%3C/text%3E%3C/svg%3E";
const DEFAULT_QUERY = Object.freeze({ page: 1, limit: 10, sortBy: "updatedAt", sortOrder: "desc" });
let state = { items: [], categories: [], pagination: null, query: { ...DEFAULT_QUERY }, error: null, busy: false, detail: null };
let activeModal = null;
let modalUxCleanup = null;
let activeProductLoadKey = null;
let activeProductLoadPromise = null;
let variantsLoadingProductId = null;
let variantsLoadedProductId = null;
let currentVariantsCache = [];

const SIZE_PRESETS = Object.freeze({
  quanao: { label: "Quần áo", sizes: ["S", "M", "L", "XL", "XXL"], keywords: ["quan ao", "ao", "quan", "thoi trang"] },
  chanvay: { label: "Chân váy", sizes: ["S", "M", "L", "XL", "XXL"], keywords: ["chan vay", "vay"] },
  giay: { label: "Giày", sizes: ["35", "36", "37", "38", "39", "40", "41", "42", "43"], keywords: ["giay", "sneaker", "dep"] },
  mu: { label: "Mũ", sizes: ["Freesize", "M", "L"], keywords: ["mu", "non"] },
  daychuyen: { label: "Dây chuyền", sizes: ["40cm", "45cm", "50cm", "55cm"], keywords: ["day chuyen", "vong co"] },
  matkinh: { label: "Mắt kính", sizes: ["Freesize", "Gọng nhỏ", "Gọng vừa", "Gọng lớn"], keywords: ["mat kinh", "kinh"] },
  dongho: { label: "Đồng hồ", sizes: ["36mm", "38mm", "40mm", "42mm", "44mm"], keywords: ["dong ho"] }
});


export async function createProductsPage({ route }) {
  const id = route.params?.id;
  try {
    if (!state.categories.length) await fetchCategories();
    if (id) {
      const response = await productService.getProductById(id, silent());
      state.detail = response.data?.product;
      syncProductVariantState(state, state.detail);
      return renderDetail(state.detail);
    }
    const template = await loadTemplate(new URL("./index.html", import.meta.url));
    await fetchProducts();
    return template;
  } catch (error) {
    state.error = error;
    return id ? renderPageError(error) : await loadTemplate(new URL("./index.html", import.meta.url));
  }
}

export function initProductsPage(root, route) {
  if (route.params?.id) {
    bindDetailEvents(root, route.params.id);
    return () => closeModal();
  }
  hydrateFilters(root);
  renderCategoryFilter(root);
  renderRows(root);
  bindListEvents(root);
  return () => closeModal();
}

async function fetchProducts() {
  const response = await productService.listProducts(state.query, silent());
  state.items = response.data?.items || [];
  state.pagination = response.data?.pagination || response.meta?.pagination || null;
  state.error = null;
}

async function fetchCategories() {
  const response = await categoryService.getAll({ page: 1, limit: 100, status: "active", sortBy: "name", sortOrder: "asc" }, silent());
  state.categories = response.data?.categories || [];
}

function bindListEvents(root) {
  const form = root.querySelector("[data-product-filters]");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    state.query = { ...state.query, page: 1, search: String(data.get("search") || "").trim(), categoryId: data.get("categoryId"), status: data.get("status"), lowStock: data.get("lowStock") || "" };
    await reload(root);
  });
  root.querySelector("[data-product-reset]")?.addEventListener("click", async () => { form?.reset(); state.query = { ...DEFAULT_QUERY }; await reload(root); });
  root.querySelector("[data-product-create]")?.addEventListener("click", () => {
    if (!hasProductPermission(PERMISSIONS.PRODUCT_CREATE)) return toast.error("Bạn không có quyền thêm sản phẩm.");
    openProductForm(root);
  });
  root.addEventListener("click", async (event) => {
    const page = event.target.closest("[data-product-page]");
    if (page && !page.disabled) { state.query.page = Number(page.dataset.productPage); await reload(root); return; }
    if (event.target.closest("[data-product-retry]")) { await reload(root); return; }
    const edit = event.target.closest("[data-product-edit]");
    if (edit) { await loadAndOpenForm(root, edit.dataset.productEdit); return; }
    const stock = event.target.closest("[data-product-stock]");
    if (stock) { const product = state.items.find((item) => String(item.id) === stock.dataset.productStock); if (product) openStockModal(root, product); return; }
    const variants = event.target.closest("[data-product-variants]");
    if (variants) { const product = state.items.find((item) => String(item.id) === variants.dataset.productVariants); if (product) openVariantModal(root, product); return; }
    const status = event.target.closest("[data-product-status]");
    if (status) { await changeStatus(root, status.dataset.productId, status.dataset.productStatus); return; }
    const remove = event.target.closest("[data-product-delete]");
    if (remove) await deleteProduct(root, remove.dataset.productDelete);
  });
}

async function reload(root) {
  if (state.busy) return;
  setBusy(root, true);
  try { await fetchProducts(); } catch (error) { state.error = error; toast.error(message(error)); }
  finally { renderRows(root); setBusy(root, false); }
}

function renderRows(root) {
  const body = root.querySelector("[data-product-rows]");
  if (!body) return;
  if (state.error) {
    body.innerHTML = `<tr><td colspan="11"><div class="admin-product-error">${escapeHtml(message(state.error))}<button type="button" data-product-retry>Thử lại</button></div></td></tr>`;
    return renderPagination(root);
  }
  body.innerHTML = state.items.length ? state.items.map(renderRow).join("") : '<tr><td colspan="11" class="admin-product-empty">Không có sản phẩm phù hợp.</td></tr>';
  bindImageFallbacks(body);
  renderPagination(root);
}

function renderRow(product) {
  const canUpdate = hasProductPermission(PERMISSIONS.PRODUCT_UPDATE);
  const canDelete = hasProductPermission(PERMISSIONS.PRODUCT_DELETE);
  const nextStatus = product.status === "active" ? "inactive" : "active";
  return `<tr>
    <td><img class="admin-product-thumb" src="${globalThis.FASHION_IMAGE_PLACEHOLDER}" data-product-image-src="${escapeHtml(resolveImageUrl(product.thumbnailUrl))}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async" data-product-image></td>
    <td><a href="#products/${id(product.id)}" data-page="products/${id(product.id)}"><strong>${escapeHtml(product.name)}</strong></a><small>${escapeHtml(product.brand || "-")}</small><div class="admin-product-variant-pill">${Number(product.variantCount || 0)} biến thể</div></td>
    <td>${escapeHtml(product.sku)}</td><td>${escapeHtml(product.categoryName || "-")}</td>
    <td><strong>${formatCurrency(product.price)}</strong></td><td>${product.salePrice === null ? "-" : formatCurrency(product.salePrice)}</td>
    <td>${stockBadge(product.stock)}</td><td>${Number(product.sold || 0)}</td><td>${statusBadge(product.status)}</td><td>${formatDate(product.updatedAt)}</td>
    <td><div class="admin-product-actions"><a class="product-action-btn is-view" href="#products/${id(product.id)}" data-page="products/${id(product.id)}"><i class="fa-regular fa-eye" aria-hidden="true"></i><span>Xem</span></a>${canUpdate ? `<button type="button" class="product-action-btn is-edit" data-product-edit="${id(product.id)}"><i class="fa-regular fa-pen-to-square" aria-hidden="true"></i><span>Sửa</span></button><button type="button" class="product-action-btn is-stock" data-product-stock="${id(product.id)}"><i class="fa-solid fa-boxes-stacked" aria-hidden="true"></i><span>Cập nhật kho</span></button><button type="button" class="product-action-btn is-variants" data-product-variants="${id(product.id)}"><i class="fa-solid fa-layer-group" aria-hidden="true"></i><span>Quản lý biến thể</span></button>${product.status !== "out_of_stock" ? `<button type="button" class="product-action-btn is-visibility" data-product-id="${id(product.id)}" data-product-status="${nextStatus}"><i class="fa-regular fa-eye-slash" aria-hidden="true"></i><span>${nextStatus === "active" ? "Hiện" : "Ẩn"}</span></button>` : ""}` : ""}${canDelete ? `<button type="button" class="product-action-btn is-danger" data-product-delete="${id(product.id)}"><i class="fa-regular fa-trash-can" aria-hidden="true"></i><span>Xóa</span></button>` : ""}</div></td>
  </tr>`;
}

function renderPagination(root) {
  const target = root.querySelector("[data-product-pagination]");
  if (!target || !state.pagination || state.error) { if (target) target.innerHTML = ""; return; }
  const p = state.pagination, page = Number(p.page || 1), pages = Math.max(Number(p.totalPages || 0), 1);
  target.innerHTML = `<span>Trang ${page}/${pages} · ${Number(p.totalItems || 0)} sản phẩm</span><div><button type="button" data-product-page="${page - 1}" ${(p.hasPreviousPage ?? page > 1) ? "" : "disabled"}>Trước</button><button type="button" data-product-page="${page + 1}" ${(p.hasNextPage ?? page < pages) ? "" : "disabled"}>Sau</button></div>`;
}

function hydrateFilters(root) {
  const form = root.querySelector("[data-product-filters]"); if (!form) return;
  ["search", "categoryId", "status"].forEach((key) => { if (form.elements[key]) form.elements[key].value = state.query[key] || ""; });
  form.elements.lowStock.checked = state.query.lowStock === "true";
}
function renderCategoryFilter(root) {
  const select = root.querySelector("[data-product-category-filter]"); if (!select) return;
  select.innerHTML = '<option value="">Tất cả danh mục</option>' + categoryOptions(state.query.categoryId);
}

async function loadAndOpenForm(root, productId) {
  if (!hasProductPermission(PERMISSIONS.PRODUCT_UPDATE)) return toast.error("Bạn không có quyền sửa sản phẩm.");

  const loadKey = String(productId);

  if (activeProductLoadKey === loadKey && activeProductLoadPromise) {
    console.debug("[PRODUCT MODAL] skip duplicate product load", loadKey);
    return activeProductLoadPromise;
  }

  activeProductLoadKey = loadKey;
  activeProductLoadPromise = (async () => {
    try {
      console.debug("[PRODUCT MODAL] open product", loadKey);
      const response = await productService.getProductById(productId, silent());
      openProductForm(root, response.data?.product);
    } catch (error) {
      toast.error(message(error));
      throw error;
    } finally {
      if (activeProductLoadKey === loadKey) {
        activeProductLoadKey = null;
        activeProductLoadPromise = null;
      }
    }
  })();

  return activeProductLoadPromise;
}

function openProductForm(root, product = null) {
  closeModal();
  const editing = Boolean(product);
  const modal = createModal(`
    <header class="admin-product-modal-header"><div><h2 id="product-form-title">${editing ? "Sửa sản phẩm" : "Thêm sản phẩm"}</h2><p>Cập nhật thông tin hiển thị, giá bán và tồn kho sản phẩm</p></div><button type="button" data-modal-close aria-label="Đóng form sản phẩm"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header>
    <form class="admin-product-form" data-product-form novalidate>
      <div class="admin-product-form-body">
        <p class="admin-product-form-error" data-product-form-error role="alert"></p>
        <section class="admin-product-form-section"><div class="admin-product-form-section-title"><i class="fa-solid fa-box"></i><div><h3>Thông tin cơ bản</h3><p>Thông tin nhận diện và trạng thái hiển thị</p></div></div><div class="admin-product-section-grid">
          ${field("Tên sản phẩm", "name", product?.name, "text", true, 'placeholder="Ví dụ: Áo thun nam basic"')}${field("Slug", "slug", product?.slug, "text", false, 'placeholder="ao-thun-nam-basic"')}${field("SKU", "sku", product?.sku, "text", true, 'placeholder="SP001"')}
          <label data-product-field="category_id"><span>Danh mục</span><select name="category_id"><option value="">Không có danh mục</option>${categoryOptions(product?.categoryId)}</select><small class="admin-field-error" data-field-error="category_id"></small></label>
          ${field("Thương hiệu", "brand", product?.brand, "text", false, 'placeholder="N&L Store"')}
          <label data-product-field="status"><span>Trạng thái</span><select name="status"><option value="active" ${selected(product?.status, "active")}>Đang bán</option><option value="inactive" ${selected(product?.status, "inactive")}>Tạm ẩn</option><option value="out_of_stock" ${selected(product?.status, "out_of_stock")}>Hết hàng</option></select><small class="admin-field-error" data-field-error="status"></small></label>
        </div></section>
        <section class="admin-product-form-section"><div class="admin-product-form-section-title"><i class="fa-solid fa-tags"></i><div><h3>Giá và kho</h3><p>Quản lý giá bán và số lượng sẵn có</p></div></div><div class="admin-product-section-grid is-four">
          ${field("Giá", "price", product?.price ?? 0, "number", true, 'min="0" step="1000" placeholder="250000"')}${field("Giá sale", "sale_price", product?.salePrice, "number", false, 'min="0" step="1000" placeholder="199000"')}${field("Tồn kho", "stock", product?.stock ?? 0, "number", false, 'min="0" step="1"')}${field("Đã bán", "sold", product?.sold ?? 0, "number", false, 'readonly aria-readonly="true"')}${field("Đánh giá sao", "rating_average", product?.rating_average ?? product?.ratingAverage ?? product?.rating ?? "", "number", false, 'min="0" max="5" step="0.1" placeholder="4.8"')}
        </div><div class="admin-product-helper-row"><span><i class="fa-solid fa-circle-info"></i> Giá sale phải nhỏ hơn hoặc bằng giá gốc</span><span><i class="fa-solid fa-circle-info"></i> Tồn kho không được âm</span></div></section>
        <section class="admin-product-form-section"><div class="admin-product-form-section-title"><i class="fa-solid fa-layer-group"></i><div><h3>Biến thể sản phẩm</h3><p>Quản lý màu sắc, kích thước, giá và tồn kho từng biến thể</p></div></div><div class="admin-product-variant-section" data-product-variant-section><div class="admin-product-variant-toolbar"><span class="admin-product-variant-hint" data-product-variant-hint>Số lượng đã bán được tự động cập nhật từ đơn hàng.</span><button type="button" class="admin-product-variant-add" data-product-variant-add ${product?.id ? "" : "disabled"}>Thêm biến thể</button></div><div class="admin-product-variant-editor" data-product-variant-editor hidden></div><div class="admin-product-variant-table" data-product-variant-table></div></div></section>
        <section class="admin-product-form-section"><div class="admin-product-form-section-title"><i class="fa-solid fa-images"></i><div><h3>Ảnh sản phẩm</h3><p>Tải ảnh đại diện từ máy tính và quản lý thư viện ảnh</p></div></div><div class="admin-product-image-layout"><div class="admin-product-upload-column"><input type="hidden" name="thumbnail_url" value="${escapeHtml(product?.thumbnailUrl || product?.thumbnail_url || "")}" data-original-thumbnail-url="${escapeHtml(product?.thumbnailUrl || product?.thumbnail_url || "")}"><input class="admin-product-file-input" id="product-thumbnail-file" type="file" multiple accept="image/*" data-product-image-input><div class="admin-product-upload-box" data-product-dropzone tabindex="0" role="button" aria-label="Chọn ảnh sản phẩm từ máy tính"><i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i><strong>Kéo thả ảnh vào đây</strong><span>hoặc bấm để chọn ảnh từ máy tính</span><small>Hỗ trợ JPG, PNG, WEBP. Tối đa 5MB.</small><button type="button" data-product-choose-image>Chọn ảnh sản phẩm</button></div><div class="admin-product-upload-status" aria-live="polite"><span data-product-file-name>${(product?.thumbnailUrl || product?.thumbnail_url) ? "Ảnh hiện tại" : "Chưa chọn ảnh"}</span><strong data-product-upload-message>${(product?.thumbnailUrl || product?.thumbnail_url) ? "Sẵn sàng đổi ảnh" : ""}</strong></div></div><div class="admin-product-thumbnail-card"><div class="admin-product-thumbnail-preview"><img src="${globalThis.FASHION_IMAGE_PLACEHOLDER}" data-product-image-src="${escapeHtml(resolveImageUrl(product?.thumbnailUrl || product?.thumbnail_url))}" alt="Xem trước ảnh thumbnail" loading="lazy" decoding="async" data-product-image data-thumbnail-preview></div><div><button type="button" class="admin-product-remove-image" data-product-remove-image ${(product?.thumbnailUrl || product?.thumbnail_url) ? "" : "hidden"}><i class="fa-regular fa-trash-can"></i> Xóa ảnh</button></div></div><label class="admin-product-gallery-field"><span>Gallery URLs</span><textarea name="gallery_urls" rows="5" placeholder="Mỗi dòng một URL ảnh">${escapeHtml((product?.galleryUrls || product?.gallery_urls || []).join("\n"))}</textarea><small class="admin-product-field-hint">Gallery vẫn hỗ trợ mỗi dòng một URL. Tối đa nên dùng 8 ảnh.</small></label></div><div class="admin-product-gallery-preview" data-gallery-preview></div></section>
        <section class="admin-product-form-section"><div class="admin-product-form-section-title"><i class="fa-solid fa-align-left"></i><div><h3>Mô tả</h3><p>Nội dung khách hàng nhìn thấy trên trang sản phẩm</p></div></div><div class="admin-product-description-grid"><label><span>Mô tả ngắn</span><textarea name="short_description" maxlength="500" rows="4" placeholder="Mô tả ngắn gọn về sản phẩm">${escapeHtml(product?.shortDescription || "")}</textarea></label><label><span>Mô tả chi tiết</span><textarea name="description" rows="7" placeholder="Chất liệu, kiểu dáng, hướng dẫn bảo quản...">${escapeHtml(product?.description || "")}</textarea></label></div></section>
        <section class="admin-product-form-section"><div class="admin-product-form-section-title"><i class="fa-solid fa-hashtag"></i><div><h3>Tags</h3><p>Hỗ trợ tìm kiếm và phân loại sản phẩm</p></div></div>${field("Tags", "tags", (product?.tags || []).join(", "), "text", false, 'placeholder="áo nam, basic, cotton"')}<small class="admin-product-field-hint">Nhập nhiều tags, phân cách bằng dấu phẩy.</small></section>
      </div>
      <footer class="admin-product-form-footer"><button type="button" class="is-secondary" data-modal-close>Hủy</button><button type="submit" data-product-submit data-idle-label="${editing ? "Lưu thay đổi" : "Tạo sản phẩm"}">${editing ? "Lưu thay đổi" : "Tạo sản phẩm"}</button></footer>
    </form>`, "[name='name']");
  bindProductImageUpload(modal);
  bindProductAttributeSection(modal, product);
  bindProductVariantSection(modal, product, root);
  modal.querySelector("[data-product-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget, payload = formPayload(form), validation = validateFormPayload(payload);
    try { console.log("[admin product submit] rating_average ->", payload.rating_average); } catch (e) {}
    const errorTarget = form.querySelector("[data-product-form-error]");
    clearFormErrors(form);
    if (form.dataset.imageUploading === "true") { errorTarget.textContent = "Vui lòng chờ tải ảnh hoàn tất."; return; }
    if (validation) { showFieldError(form, validation.field, validation.message); return; }
    setFormBusy(form, true);
    try {
      await validateAndNormalizeProductImages(payload, form);
      if (editing) await productService.updateProduct(product.id, payload, silent());
      else await productService.createProduct(payload, silent());
      closeModal(); toast.success(editing ? "Đã cập nhật sản phẩm." : "Đã thêm sản phẩm."); await reload(root);
    } catch (error) { errorTarget.textContent = message(error); errorTarget.scrollIntoView({ behavior: "smooth", block: "center" }); toast.error(message(error)); setFormBusy(form, false); }
  });
}

function bindProductAttributeSection(modal, product) {
  const variantSection = modal.querySelector("[data-product-variant-section]")?.closest(".admin-product-form-section");
  if (!variantSection) return;
  const attributes = product?.productAttributes || {};
  const section = document.createElement("section");
  section.className = "admin-product-form-section";
  section.dataset.productAttributeSection = "";
  section.innerHTML = `<div class="admin-product-form-section-title"><i class="fa-solid fa-gem"></i><div><h3>Thông tin dây chuyền</h3><p>Thuộc tính riêng cho sản phẩm phụ kiện, không tạo biến thể màu hoặc kích thước</p></div></div><div class="admin-product-section-grid is-three">
    ${field("Chất liệu", "attribute_material", attributes.material, "text", false, 'maxlength="200" placeholder="Bạc titan"')}
    ${field("Độ dài dây", "attribute_chain_length", attributes.chain_length, "text", false, 'maxlength="200" placeholder="45cm"')}
    ${field("Loại mặt dây", "attribute_pendant_type", attributes.pendant_type, "text", false, 'maxlength="200" placeholder="Mặt kim cương"')}
    ${field("Màu đá / màu mặt", "attribute_stone_color", attributes.stone_color, "text", false, 'maxlength="200" placeholder="Trắng"')}
    ${field("Kích thước mặt", "attribute_pendant_size", attributes.pendant_size, "text", false, 'maxlength="200" placeholder="1.5cm"')}
    ${field("Bảo hành", "attribute_warranty", attributes.warranty, "text", false, 'maxlength="200" placeholder="7 ngày"')}
  </div>`;
  variantSection.before(section);

  const updateVisibility = () => {
    const name = modal.querySelector('[name="name"]')?.value || "";
    const categoryId = modal.querySelector('[name="category_id"]')?.value || "";
    const categoryName = state.categories.find((category) => String(category.id) === String(categoryId))?.name || "";
    section.hidden = !isAccessoryProduct(name, categoryName);
  };
  modal.querySelector('[name="name"]')?.addEventListener("input", updateVisibility);
  modal.querySelector('[name="category_id"]')?.addEventListener("change", updateVisibility);
  updateVisibility();
}

function isAccessoryProduct(name, categoryName) {
  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const normalizedName = normalize(name);
  const normalizedCategory = normalize(categoryName);
  return normalizedCategory.includes("phu kien") || normalizedCategory.includes("day chuyen") || normalizedName.includes("day chuyen");
}

function openStockModal(root, product, onSuccess = () => reload(root)) {
  if (!hasProductPermission(PERMISSIONS.PRODUCT_UPDATE)) return toast.error("Bạn không có quyền cập nhật kho.");
  const modal = createModal(`<header><div><p class="admin-products-eyebrow">Inventory</p><h2>Cập nhật tồn kho</h2></div><button type="button" data-modal-close>×</button></header><form class="admin-product-stock-form" data-stock-form><p>Tồn kho hiện tại: <strong>${Number(product.stock)}</strong></p>${field("Tồn kho mới", "stock", product.stock, "number", true, 'min="0" step="1"')}<label><span>Lý do cập nhật</span><textarea name="reason" maxlength="500" placeholder="Ví dụ: Nhập thêm hàng"></textarea></label><p class="admin-product-form-error" data-product-form-error></p><footer><button type="button" class="is-secondary" data-modal-close>Đóng</button><button type="submit">Cập nhật</button></footer></form>`);
  modal.querySelector("[data-stock-form]").addEventListener("submit", async (event) => {
    event.preventDefault(); const form = event.currentTarget, data = new FormData(form), stock = Number(data.get("stock"));
    if (!Number.isInteger(stock) || stock < 0) throw new Error("Tồn kho không được âm.");
    setFormBusy(form, true);
    try { await productService.updateStock(product.id, { stock, reason: String(data.get("reason") || "").trim() }, silent()); closeModal(); toast.success("Đã cập nhật tồn kho."); await onSuccess(); }
    catch (error) { form.querySelector("[data-product-form-error]").textContent = message(error); toast.error(message(error)); setFormBusy(form, false); }
  });
}

async function changeStatus(root, productId, status) {
  if (!hasProductPermission(PERMISSIONS.PRODUCT_UPDATE)) return toast.error("Bạn không có quyền cập nhật trạng thái.");
  if (!confirm(`Xác nhận chuyển trạng thái sang "${statusLabel(status)}"?`)) return;
  try { await productService.updateStatus(productId, status, silent()); toast.success("Đã cập nhật trạng thái sản phẩm."); await reload(root); }
  catch (error) { toast.error(message(error)); }
}
async function deleteProduct(root, productId) {
  if (!hasProductPermission(PERMISSIONS.PRODUCT_DELETE)) return toast.error("Bạn không có quyền xóa sản phẩm.");
  if (!confirm("Xóa mềm sản phẩm này? Dữ liệu đơn hàng cũ vẫn được giữ nguyên.")) return;
  try { await productService.deleteProduct(productId, silent()); toast.success("Đã xóa sản phẩm."); await reload(root); }
  catch (error) { toast.error(message(error)); }
}

function renderDetail(product) {
  if (!product) return renderPageError({ status: 404 });
  return `<section class="admin-product-detail"><header class="admin-products-hero"><div><p class="admin-products-eyebrow">Chi tiết sản phẩm</p><h1>${escapeHtml(product.name)}</h1><p>${escapeHtml(product.sku)}</p></div><a href="#products" data-page="products">← Danh sách</a></header><div class="admin-product-detail-grid"><article class="admin-product-card admin-product-detail-image"><img src="${globalThis.FASHION_IMAGE_PLACEHOLDER}" data-product-image-src="${escapeHtml(resolveImageUrl(product.thumbnailUrl))}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async" data-product-image>${statusBadge(product.status)}${stockBadge(product.stock)}</article><article class="admin-product-card"><h2>Thông tin sản phẩm</h2>${detailRow("Danh mục", product.categoryName)}${detailRow("Thương hiệu", product.brand)}${detailRow("Giá", formatCurrency(product.price))}${detailRow("Giá sale", product.salePrice === null ? "-" : formatCurrency(product.salePrice))}${detailRow("Đã bán", product.sold)}${detailRow("Đánh giá", `${Number(product.ratingAverage ?? product.rating_average ?? product.rating ?? 4.8).toFixed(1)} sao`)}${detailRow("Biến thể", product.variantCount || 0)}${detailRow("Slug", product.slug)}${detailRow("Cập nhật", formatDate(product.updatedAt))}<div class="admin-product-detail-actions">${hasProductPermission(PERMISSIONS.PRODUCT_UPDATE) ? `<button type="button" data-detail-edit="${id(product.id)}">Sửa sản phẩm</button><button type="button" data-detail-stock="${id(product.id)}">Cập nhật kho</button><button type="button" data-detail-variants="${id(product.id)}">Quản lý biến thể</button>` : ""}</div></article></div><article class="admin-product-card"><h2>Mô tả ngắn</h2><p>${escapeHtml(product.shortDescription || "-")}</p><h2>Mô tả chi tiết</h2><p class="admin-product-description">${escapeHtml(product.description || "-")}</p><h2>Tags</h2><p>${escapeHtml((product.tags || []).join(", ") || "-")}</p></article></section>`;
}
function bindDetailEvents(root, productId) {
  bindImageFallbacks(root);
  root.querySelector("[data-product-retry]")?.addEventListener("click", () => location.hash = `#products/${productId}`);
  root.querySelector("[data-detail-edit]")?.addEventListener("click", async () => loadAndOpenForm(root, productId));
  root.querySelector("[data-detail-stock]")?.addEventListener("click", () => state.detail && openStockModalForDetail(root, state.detail));
  root.querySelector("[data-detail-variants]")?.addEventListener("click", () => state.detail && openVariantModal(root, state.detail));
}
function openStockModalForDetail(root, product) {
  openStockModal(root, product, async () => { location.hash = "#products"; });
}

function openVariantModal(root, product) {
  if (!hasProductPermission(PERMISSIONS.PRODUCT_UPDATE)) return toast.error("Bạn không có quyền quản lý biến thể.");
  const modal = createModal(`
    <div class="variant-modal-shell">
      <header class="variant-modal-header">
        <div>
          <p class="admin-products-eyebrow">Variants</p>
          <h2>Quản lý biến thể</h2>
          <p>Cập nhật màu sắc, kích thước, giá và tồn kho</p>
        </div>
        <button type="button" class="admin-product-variant-close" data-modal-close aria-label="Đóng modal">&times;</button>
      </header>
      <nav class="variant-modal-tabs" aria-label="Quản lý biến thể">
        <button type="button" class="is-active" data-variant-tab="list">Danh sách biến thể</button>
        <button type="button" data-variant-tab="stock">Cập nhật tồn kho nhanh</button>
        <button type="button" data-variant-tab="price">Cập nhật giá nhanh</button>
        <button type="button" data-variant-tab="form">Thêm / sửa biến thể</button>
      </nav>
      <div class="variant-modal-body admin-product-variant-modal is-upgraded" data-variant-root>
        <p class="admin-product-form-error" data-variant-error></p>
        <section class="variant-tab-panel is-active" data-variant-panel="list">
          <div class="variant-panel-toolbar">
            <div><strong>Danh sách biến thể</strong><span>Quản lý SKU, màu, size, giá và tồn kho hiện tại.</span></div>
            <button type="button" data-variant-add>+ Thêm biến thể</button>
          </div>
          <div class="admin-product-variant-list" data-variant-list></div>
        </section>
        <section class="variant-tab-panel" data-variant-panel="stock">
          <div class="variant-panel-toolbar">
            <div><strong>Cập nhật tồn kho nhanh</strong><span>Chọn phạm vi rồi áp dụng tồn kho cho các biến thể phù hợp.</span></div>
          </div>
          <p class="admin-product-form-error" data-bulk-status></p>
          <div class="variant-stock-cards">
            <article><h3>Áp dụng cho tất cả</h3><label><span>Tồn kho mới</span><input type="number" min="0" step="1" data-bulk-all-stock placeholder="VD: 10"></label><button type="button" data-bulk-apply="all">Áp dụng</button></article>
            <article><h3>Áp dụng theo màu</h3><label><span>Màu</span><select data-bulk-color><option value="">Chọn màu</option></select></label><label><span>Tồn kho mới</span><input type="number" min="0" step="1" data-bulk-color-stock placeholder="VD: 5"></label><button type="button" data-bulk-apply="color">Áp dụng</button></article>
            <article><h3>Áp dụng theo size</h3><label><span>Size</span><select data-bulk-size><option value="">Chọn size</option></select></label><label><span>Tồn kho mới</span><input type="number" min="0" step="1" data-bulk-size-stock placeholder="VD: 2"></label><button type="button" data-bulk-apply="size">Áp dụng</button></article>
          </div>
        </section>
        <section class="variant-tab-panel" data-variant-panel="price">
          <div class="variant-panel-toolbar">
            <div><strong>Cập nhật giá nhanh cho tất cả size</strong><span>Áp dụng cho toàn bộ biến thể của sản phẩm, giữ nguyên màu, size, tồn kho và trạng thái.</span></div>
          </div>
          <form class="variant-quick-price-card" data-bulk-price-form>
            <div class="variant-quick-price-grid">
              <label><span>Giá mới <em>*</em></span><input type="number" min="0" step="1000" name="bulkVariantPrice" placeholder="VD: 250000" required></label>
              <label><span>Giá sale mới</span><input type="number" min="0" step="1000" name="bulkVariantSalePrice" placeholder="Để trống để xóa giá sale" disabled></label>
            </div>
            <label class="variant-quick-price-toggle"><input type="checkbox" data-bulk-price-sale-toggle><span>Cập nhật cả giá sale</span></label>
            <div class="variant-quick-price-summary"><i class="fa-solid fa-circle-info" aria-hidden="true"></i><span data-bulk-price-summary>Đang tải danh sách biến thể...</span></div>
            <p class="admin-product-form-error" data-bulk-price-error></p>
            <div class="variant-modal-footer-actions"><button type="submit" data-bulk-price-apply>Áp dụng giá cho tất cả size</button></div>
          </form>
        </section>
        <section class="variant-tab-panel" data-variant-panel="form">
          <form class="admin-product-variant-form is-card" data-variant-form>
            <div class="admin-product-variant-card-title"><div><strong data-variant-form-title>Thêm biến thể</strong><span>Không cho sửa trực tiếp số đã bán.</span></div></div>
            <div class="admin-product-variant-form-grid">
              <label data-product-field="sku"><span>SKU biến thể <em>*</em></span><input type="text" name="sku" required><small class="admin-field-error" data-field-error="sku"></small></label>
              <label data-product-field="color"><span>Màu <em>*</em></span><input type="text" name="color" required><small class="admin-field-error" data-field-error="color"></small></label>
              <label data-product-field="colorCode"><span>Mã màu</span><input type="text" name="colorCode" placeholder="#000000"><small class="admin-field-error" data-field-error="colorCode"></small></label>
              <label data-product-field="size"><span>Kích thước <em>*</em></span><input type="text" name="size" required><small class="admin-field-error" data-field-error="size"></small></label>
              <label data-product-field="price"><span>Giá</span><input type="number" name="price" min="0" step="1000"><small class="admin-field-error" data-field-error="price"></small></label>
              <label data-product-field="salePrice"><span>Giá sale</span><input type="number" name="salePrice" min="0" step="1000"><small class="admin-field-error" data-field-error="salePrice"></small></label>
              <label data-product-field="stock"><span>Tồn kho <em>*</em></span><input type="number" name="stock" min="0" step="1" required><small class="admin-field-error" data-field-error="stock"></small></label>
              <label data-product-field="status"><span>Trạng thái</span><select name="status"><option value="active">active</option><option value="inactive">inactive</option></select><small class="admin-field-error" data-field-error="status"></small></label>
            </div>
            <input type="hidden" name="variantId" value="">
            <footer class="admin-product-variant-form-actions"><button type="button" class="is-secondary" data-variant-cancel>Hủy</button><button type="submit">Lưu biến thể</button></footer>
          </form>
        </section>
      </div>
    </div>`, "[data-modal-close]");

  const listTarget = modal.querySelector("[data-variant-list]");
  const form = modal.querySelector("[data-variant-form]");
  const errorTarget = modal.querySelector("[data-variant-error]");
  const bulkStatus = modal.querySelector("[data-bulk-status]");
  const bulkPriceForm = modal.querySelector("[data-bulk-price-form]");
  const bulkPriceSummary = modal.querySelector("[data-bulk-price-summary]");
  const bulkPriceError = modal.querySelector("[data-bulk-price-error]");
  const bulkPriceSaleToggle = modal.querySelector("[data-bulk-price-sale-toggle]");
  const bulkVariantSalePrice = modal.querySelector("[name='bulkVariantSalePrice']");
  let editingVariantId = null;
  let variantsCache = [];

  const setActiveTab = (tab) => {
    modal.querySelectorAll("[data-variant-tab]").forEach((button) => button.classList.toggle("is-active", button.dataset.variantTab === tab));
    modal.querySelectorAll("[data-variant-panel]").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.variantPanel === tab));
    errorTarget.textContent = "";
  };

  const renderVariants = async () => {
    try {
      const response = await productService.getVariants(product.id, silent());
      const variants = response.data?.variants || [];
      variantsCache = variants;
      if (bulkPriceSummary) bulkPriceSummary.textContent = variants.length
        ? `Sẽ áp dụng cho ${variants.length} biến thể thuộc tất cả màu và size.`
        : "Sản phẩm chưa có biến thể để cập nhật giá.";
      product.variantCount = variants.length;
      product.variants = variants;
      syncProductVariantState(state, { id: product.id, variantCount: variants.length, variants });
      if (root) renderRows(root);
      renderBulkTools(variants);

      if (!variants.length) {
        listTarget.innerHTML = '<div class="admin-product-variant-empty-state">Chưa có biến thể nào cho sản phẩm này.</div>';
        return;
      }

      listTarget.innerHTML = `<div class="admin-product-variant-table is-upgraded"><div class="admin-product-variant-row admin-product-variant-head"><span>SKU</span><span>Màu</span><span>Size</span><span>Tồn kho</span><span>Đã bán</span><span>Giá</span><span>Trạng thái</span><span>Hành động</span></div>${variants.map(renderVariantRow).join("")}</div>`;
      listTarget.querySelectorAll("[data-variant-edit]").forEach((button) => button.addEventListener("click", () => {
        const variant = variants.find((item) => String(item.id) === String(button.dataset.variantEdit));
        populateForm(variant);
        setActiveTab("form");
      }));
      listTarget.querySelectorAll("[data-variant-delete]").forEach((button) => button.addEventListener("click", async () => {
        if (!confirm("Bạn có chắc muốn xóa biến thể này không?")) return;
        try { await productService.deleteVariant(product.id, button.dataset.variantDelete, silent()); toast.success("Đã xóa biến thể"); await renderVariants(); }
        catch (error) { errorTarget.textContent = message(error); toast.error(message(error)); }
      }));
    } catch (error) {
      listTarget.innerHTML = `<p>${escapeHtml(message(error))}</p>`;
    }
  };

  function renderVariantRow(variant) {
    const stock = Number(variant.stock || 0);
    const stockBadge = stock === 0 ? `<span class="variant-badge is-empty">Hết hàng</span>` : stock <= 5 ? `<span class="variant-badge is-low">Sắp hết · ${stock}</span>` : `<span class="variant-badge is-ok">Còn hàng · ${stock}</span>`;
    return `<div class="admin-product-variant-row" data-variant-row="${id(variant.id)}"><span class="variant-sku">${escapeHtml(variant.sku || "-")}</span><span>${escapeHtml(variant.color || "-")}</span><span>${escapeHtml(variant.size || "-")}</span><span>${stockBadge}</span><span>${Number(variant.sold || 0)}</span><span>${escapeHtml(formatCurrency(variant.price ?? 0))}</span><span><span class="variant-status ${variant.status === "active" ? "is-active" : "is-inactive"}">${escapeHtml(variant.status || "active")}</span></span><span class="variant-actions"><button type="button" data-variant-edit="${id(variant.id)}"><i class="fa-regular fa-pen-to-square"></i> Sửa</button><button type="button" data-variant-delete="${id(variant.id)}" class="is-danger"><i class="fa-regular fa-trash-can"></i> Xóa</button></span></div>`;
  }

  function populateForm(variant) {
    editingVariantId = variant?.id || null;
    form.elements.sku.value = variant?.sku || "";
    form.elements.size.value = variant?.size || "";
    form.elements.color.value = variant?.color || "";
    form.elements.colorCode.value = variant?.colorCode || "";
    form.elements.price.value = variant?.price ?? "";
    form.elements.salePrice.value = variant?.salePrice ?? "";
    form.elements.stock.value = variant?.stock ?? "";
    form.elements.status.value = variant?.status || "active";
    form.elements.variantId.value = variant?.id || "";
    form.querySelector("[data-variant-form-title]").textContent = variant ? "Sửa biến thể" : "Thêm biến thể";
    form.querySelector("button[type='submit']").textContent = variant ? "Lưu thay đổi" : "Lưu biến thể";
  }

  function collectVariantPayload() {
    const data = new FormData(form);
    const payload = {
      sku: String(data.get("sku") || "").trim().toUpperCase(),
      size: String(data.get("size") || "").trim(),
      color: String(data.get("color") || "").trim(),
      colorCode: String(data.get("colorCode") || "").trim(),
      price: data.get("price") === "" ? null : Number(data.get("price")),
      salePrice: data.get("salePrice") === "" ? null : Number(data.get("salePrice")),
      stock: Number(data.get("stock") || 0),
      status: String(data.get("status") || "active").trim().toLowerCase()
    };
    if (!payload.sku) throw new Error("SKU không được để trống.");
    if (!payload.color) throw new Error("Màu không được để trống.");
    if (!payload.size) throw new Error("Size không được để trống.");
    if (!Number.isInteger(payload.stock) || payload.stock < 0) throw new Error("Tồn kho không được âm.");
    if (payload.price !== null && payload.price < 0) throw new Error("Giá không được âm.");
    if (payload.salePrice !== null && payload.price !== null && payload.salePrice > payload.price) throw new Error("Giá sale không được lớn hơn giá.");
    return payload;
  }

  function renderBulkTools(variants) {
    const colors = uniqueValues(variants.map((variant) => variant.color));
    const sizes = uniqueValues(variants.map((variant) => variant.size));
    fillSelect(modal.querySelector("[data-bulk-color]"), colors, "Chọn màu");
    fillSelect(modal.querySelector("[data-bulk-size]"), sizes, "Chọn size");
  }

  async function applyBulkStock(mode, trigger = null) {
    const setBulkStatus = (textValue) => { if (bulkStatus) bulkStatus.textContent = textValue; };
    const originalLabel = trigger?.textContent || "Áp dụng";
    if (trigger) {
      trigger.disabled = true;
      trigger.textContent = "Đang cập nhật...";
    }
    try {
      setBulkStatus("");
      const updates = buildBulkStockUpdates(mode);
      if (!updates.length) throw new Error("Không có biến thể nào cần cập nhật.");
      const invalid = updates.find((item) => !Number.isInteger(item.stock) || item.stock < 0);
      if (invalid) throw new Error("Tồn kho phải là số nguyên không âm.");
      setBulkStatus("Đang cập nhật...");
      const results = await Promise.allSettled(updates.map((item) => productService.updateVariantStock(product.id, item.id, { stock: item.stock }, silent())));
      const failed = results.filter((result) => result.status === "rejected");
      if (failed.length) throw new Error(`${failed.length}/${results.length} biến thể cập nhật thất bại.`);
      toast.success("Cập nhật tồn kho thành công");
      setBulkStatus("Cập nhật tồn kho thành công");
      await renderVariants();
      if (root) renderRows(root);
    } catch (error) {
      const errorMessage = message(error);
      setBulkStatus(errorMessage);
      toast.error(errorMessage);
    } finally {
      if (trigger) {
        trigger.disabled = false;
        trigger.textContent = originalLabel;
      }
    }
  }

  function buildBulkStockUpdates(mode) {
    if (mode === "all") {
      const stockInput = modal.querySelector("[data-bulk-all-stock]");
      if (!stockInput) throw new Error("Không tìm thấy ô nhập tồn kho cho tất cả biến thể.");
      const stock = parseStockInput(stockInput.value);
      return variantsCache.map((variant) => ({ id: variant.id, stock }));
    }
    if (mode === "color") {
      const colorSelect = modal.querySelector("[data-bulk-color]");
      const stockInput = modal.querySelector("[data-bulk-color-stock]");
      if (!colorSelect || !stockInput) throw new Error("Không tìm thấy ô cập nhật tồn kho theo màu.");
      const color = colorSelect.value;
      const stock = parseStockInput(stockInput.value);
      if (!color) throw new Error("Vui lòng chọn màu cần cập nhật.");
      return variantsCache.filter((variant) => String(variant.color || "") === color).map((variant) => ({ id: variant.id, stock }));
    }
    if (mode === "size") {
      const sizeSelect = modal.querySelector("[data-bulk-size]");
      const stockInput = modal.querySelector("[data-bulk-size-stock]");
      if (!sizeSelect || !stockInput) throw new Error("Không tìm thấy ô cập nhật tồn kho theo size.");
      const size = sizeSelect.value;
      const stock = parseStockInput(stockInput.value);
      if (!size) throw new Error("Vui lòng chọn size cần cập nhật.");
      return variantsCache.filter((variant) => String(variant.size || "") === size).map((variant) => ({ id: variant.id, stock }));
    }
    return [];
  }

  function parseStockInput(value) {
    if (value === "") throw new Error("Vui lòng nhập tồn kho mới.");
    const stock = Number(value);
    if (!Number.isInteger(stock) || stock < 0) throw new Error("Tồn kho phải là số nguyên không âm.");
    return stock;
  }

  function uniqueValues(values) { return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean))); }
  function fillSelect(select, values, placeholder) {
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
    if (values.includes(current)) select.value = current;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const payload = collectVariantPayload();
      if (editingVariantId) await productService.updateVariant(product.id, editingVariantId, payload, silent());
      else await productService.createVariant(product.id, payload, silent());
      toast.success(editingVariantId ? "Đã cập nhật biến thể." : "Đã thêm biến thể.");
      populateForm(null);
      form.reset();
      form.elements.status.value = "active";
      await renderVariants();
      setActiveTab("list");
    } catch (error) {
      errorTarget.textContent = message(error);
      toast.error(message(error));
    }
  });

  bulkPriceSaleToggle?.addEventListener("change", () => {
    bulkVariantSalePrice.disabled = !bulkPriceSaleToggle.checked;
    if (!bulkPriceSaleToggle.checked) bulkVariantSalePrice.value = "";
  });

  bulkPriceForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    bulkPriceError.textContent = "";
    if (!variantsCache.length) {
      bulkPriceError.textContent = "Sản phẩm chưa có biến thể để cập nhật giá.";
      return;
    }
    const priceInput = bulkPriceForm.elements.bulkVariantPrice.value;
    const price = Number(priceInput);
    const updateSalePrice = Boolean(bulkPriceSaleToggle?.checked);
    const saleInput = bulkVariantSalePrice?.value ?? "";
    const salePrice = saleInput === "" ? null : Number(saleInput);
    if (priceInput === "" || !Number.isFinite(price) || price < 0) {
      bulkPriceError.textContent = "Giá mới phải là số không âm.";
      return;
    }
    if (updateSalePrice && salePrice !== null && (!Number.isFinite(salePrice) || salePrice < 0 || salePrice > price)) {
      bulkPriceError.textContent = "Giá sale phải là số không âm và không lớn hơn giá mới.";
      return;
    }
    if (!updateSalePrice && variantsCache.some((variant) => variant.salePrice !== null && Number(variant.salePrice) > price)) {
      bulkPriceError.textContent = "Một số giá sale hiện tại lớn hơn giá mới. Hãy bật “Cập nhật cả giá sale”.";
      return;
    }
    if (!updateSalePrice && product.salePrice !== null && product.salePrice !== undefined && Number(product.salePrice) > price) {
      bulkPriceError.textContent = "Giá sale của sản phẩm đang lớn hơn giá mới. Hãy bật “Cập nhật cả giá sale”.";
      return;
    }

    const submitButton = bulkPriceForm.querySelector("[data-bulk-price-apply]");
    submitButton.disabled = true;
    submitButton.textContent = "Đang cập nhật...";
    try {
      const results = await Promise.allSettled(variantsCache.map((variant) => productService.updateVariant(product.id, variant.id, {
        price,
        ...(updateSalePrice ? { salePrice } : {})
      }, silent())));
      const failed = results.filter((result) => result.status === "rejected");
      if (failed.length) throw new Error(`${failed.length}/${results.length} biến thể cập nhật giá thất bại.`);
      const productResponse = await productService.updateProduct(product.id, {
        price,
        ...(updateSalePrice ? { salePrice } : {})
      }, silent());
      const updatedProduct = productResponse.data?.product || {};
      product.price = updatedProduct.price ?? price;
      if (updateSalePrice) product.salePrice = updatedProduct.salePrice ?? salePrice;
      const stateProduct = state.items.find((item) => String(item.id) === String(product.id));
      if (stateProduct) {
        stateProduct.price = product.price;
        if (updateSalePrice) stateProduct.salePrice = product.salePrice;
      }
      if (state.detail && String(state.detail.id) === String(product.id)) {
        state.detail.price = product.price;
        if (updateSalePrice) state.detail.salePrice = product.salePrice;
      }
      toast.success(`Đã cập nhật giá cho ${results.length} biến thể.`);
      await renderVariants();
      setActiveTab("list");
    } catch (error) {
      bulkPriceError.textContent = message(error);
      toast.error(message(error));
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Áp dụng giá cho tất cả size";
    }
  });

  modal.querySelectorAll("[data-variant-tab]").forEach((button) => button.addEventListener("click", () => setActiveTab(button.dataset.variantTab)));
  modal.querySelector("[data-variant-add]")?.addEventListener("click", () => { populateForm(null); form.reset(); form.elements.status.value = "active"; setActiveTab("form"); });
  modal.querySelector("[data-variant-cancel]")?.addEventListener("click", () => { populateForm(null); form.reset(); form.elements.status.value = "active"; setActiveTab("list"); });
  modal.querySelectorAll("[data-bulk-apply]").forEach((button) => button.addEventListener("click", () => applyBulkStock(button.dataset.bulkApply, button)));

  renderVariants();
}

function createModal(html, initialFocus = "[data-modal-close]") {
  closeModal(); const overlay = document.createElement("div"); overlay.className = "admin-product-modal"; overlay.innerHTML = `<section class="admin-product-modal-dialog" role="dialog" aria-modal="true" tabindex="-1">${html}</section>`; const dialog = overlay.querySelector("[role='dialog']"); const title = dialog.querySelector("h2"); if (title?.id) dialog.setAttribute("aria-labelledby", title.id); else dialog.setAttribute("aria-label", title?.textContent || "Modal quản lý sản phẩm"); document.body.appendChild(overlay); document.body.classList.add("modal-open"); activeModal = overlay; modalUxCleanup = activateModalUX(overlay, { onClose: closeModal, initialFocus }); requestAnimationFrame(() => overlay.classList.add("is-visible")); overlay.querySelectorAll("[data-modal-close]").forEach((button) => { if (!button.getAttribute("aria-label")) button.setAttribute("aria-label", "Đóng modal"); }); overlay.addEventListener("click", (event) => { if (event.target === overlay || event.target.closest("[data-modal-close]")) closeModal(); }); return overlay;
}
function closeModal() { modalUxCleanup?.(); modalUxCleanup = null; activeModal?._productPreviewCleanup?.(); activeModal?.remove(); activeModal = null; document.body.classList.remove("modal-open"); }
function field(label, name, value = "", type = "text", required = false, extra = "") { return `<label data-product-field="${name}"><span>${escapeHtml(label)}${required ? " <em>*</em>" : ""}</span><input type="${type}" name="${name}" value="${escapeHtml(value ?? "")}" ${required ? "required" : ""} ${extra}><small class="admin-field-error" data-field-error="${name}"></small></label>`; }
function formPayload(form) {
  const d = new FormData(form);
  const attribute = (name) => String(d.get(`attribute_${name}`) || "").trim();
  const galleryUrls = String(d.get("gallery_urls") || "").split("\n").map(x => x.trim()).filter(Boolean);
  const thumbnailInput = form.querySelector('[name="thumbnail_url"]');
  const currentThumbnailUrl = String(d.get("thumbnail_url") || "").trim();
  const originalThumbnailUrl = String(thumbnailInput?.dataset.originalThumbnailUrl || "").trim();
  const selectedThumbnailUrl = currentThumbnailUrl || galleryUrls[0] || originalThumbnailUrl || "";
  return {
    name: String(d.get("name") || "").trim(), slug: String(d.get("slug") || "").trim(), sku: String(d.get("sku") || "").trim().toUpperCase(), category_id: d.get("category_id") || null,
    brand: String(d.get("brand") || "").trim(), short_description: String(d.get("short_description") || "").trim(), description: String(d.get("description") || "").trim(),
    price: Number(d.get("price")), sale_price: d.get("sale_price") === "" ? null : Number(d.get("sale_price")), stock: Number(d.get("stock") || 0),
    rating_average: (function(v){ const s = String(v ?? "").trim(); if (s === "") return undefined; const n = Number(s.replace(/,/g, '.')); return Number.isFinite(n) ? n : undefined; })(d.get("rating_average")), status: d.get("status"),
    thumbnail_url: selectedThumbnailUrl, gallery_urls: galleryUrls, tags: String(d.get("tags") || "").split(",").map(x => x.trim()).filter(Boolean),
    product_attributes: { material: attribute("material"), chain_length: attribute("chain_length"), pendant_type: attribute("pendant_type"), stone_color: attribute("stone_color"), pendant_size: attribute("pendant_size"), warranty: attribute("warranty") }
  };
}
function validateFormPayload(p) { if (!p.name) return { field: "name", message: "Tên sản phẩm là bắt buộc." }; if (!p.sku) return { field: "sku", message: "SKU là bắt buộc." }; if (!Number.isFinite(p.price) || p.price < 0) return { field: "price", message: "Giá phải là số không âm." }; if (p.sale_price !== null && (p.sale_price < 0 || p.sale_price > p.price)) return { field: "sale_price", message: "Giá sale phải nhỏ hơn hoặc bằng giá gốc." }; if (!Number.isInteger(p.stock) || p.stock < 0) return { field: "stock", message: "Tồn kho phải là số nguyên không âm." }; if (!Number.isFinite(p.rating_average) || p.rating_average < 0 || p.rating_average > 5 || Math.round(p.rating_average * 10) !== p.rating_average * 10) return { field: "rating_average", message: "Đánh giá sao phải từ 0 đến 5 và có 1 chữ số thập phân." }; return null; }

async function validateAndNormalizeProductImages(payload, form = null) {
  const normalizeForSave = (value) => normalizeProductImageUrl(value);
  const originalThumbnailUrl = normalizeForSave(form?.querySelector('[name="thumbnail_url"]')?.dataset.originalThumbnailUrl || "");

  payload.thumbnail_url = normalizeForSave(payload.thumbnail_url) || null;
  payload.gallery_urls = (payload.gallery_urls || []).map(normalizeForSave).filter(Boolean);
  if (!payload.thumbnail_url && payload.gallery_urls.length) payload.thumbnail_url = payload.gallery_urls[0];

  const selectedThumbnailUrl = payload.thumbnail_url || "";
  const selectedNewMainImage = selectedThumbnailUrl && selectedThumbnailUrl !== originalThumbnailUrl;
  console.debug("[admin product images] normalized", {
    thumbnail_url: payload.thumbnail_url,
    gallery_urls: payload.gallery_urls,
    original_thumbnail_url: originalThumbnailUrl || null,
    selected_new_main_image: Boolean(selectedNewMainImage)
  });

  if (!selectedNewMainImage || isPlaceholderImageUrl(selectedThumbnailUrl)) return;

  const reachable = await imageUrlLoads(selectedThumbnailUrl, "thumbnail_url");
  if (!reachable) {
    console.warn("[admin product images] unreachable selected main image", { field: "thumbnail_url", url: selectedThumbnailUrl });
    throw new Error(isLegacyUploadUrl(selectedThumbnailUrl) ? OLD_UPLOAD_LOST_MESSAGE : "Ảnh sản phẩm hiện không truy cập được. Vui lòng tải lại ảnh hoặc chọn một ảnh hợp lệ.");
  }
}
function imageUrlLoads(url, label) {
  return new Promise((resolve) => {
    if (!isValidProductImageUrl(url)) {
      console.warn("[admin product images] invalid image URL", { field: label, url });
      resolve(false);
      return;
    }

    const image = new Image();
    const timer = window.setTimeout(() => {
      cleanup();
      console.warn("[admin product images] image load timeout", { field: label, url });
      resolve(false);
    }, 8000);
    const cleanup = () => {
      window.clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
    };

    image.onload = () => { cleanup(); resolve(true); };
    image.onerror = () => {
      cleanup();
      console.warn("[admin product images] image load failed", { field: label, url });
      resolve(false);
    };
    image.src = url;
  });
}

function isValidProductImageUrl(url) {
  return /^https?:\/\//i.test(String(url || "")) || String(url || "").startsWith("data:");
}

function isPlaceholderImageUrl(url) {
  return !url || url === PLACEHOLDER || url === globalThis.FASHION_IMAGE_PLACEHOLDER;
}

function normalizeProductImageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("/uploads") || raw.startsWith("uploads")) return raw;
  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) return raw;
  return raw;
}
function isLegacyUploadUrl(value) {
  try {
    return new URL(value).pathname.startsWith("/uploads/");
  } catch {
    const url = String(value || "").trim();
    return url.startsWith("/uploads/") || url.startsWith("uploads/");
  }
}
function clearFormErrors(form) { form.querySelectorAll(".is-invalid").forEach((field) => field.classList.remove("is-invalid")); form.querySelectorAll("[data-field-error]").forEach((target) => { target.textContent = ""; }); const summary = form.querySelector("[data-product-form-error]"); if (summary) summary.textContent = ""; }
function showFieldError(form, fieldName, errorMessage) { const input = form.elements[fieldName]; const wrapper = input?.closest("[data-product-field]"); wrapper?.classList.add("is-invalid"); const target = form.querySelector(`[data-field-error="${fieldName}"]`); if (target) target.textContent = errorMessage; (wrapper || input)?.scrollIntoView({ behavior: "smooth", block: "center" }); input?.focus({ preventScroll: true }); }
function bindProductImageUpload(modal) {
  const form = modal.querySelector("[data-product-form]");
  const fileInput = modal.querySelector("[data-product-image-input]");
  const hiddenInput = modal.querySelector('[name="thumbnail_url"]');
  const thumbnail = modal.querySelector("[data-thumbnail-preview]");
  const dropzone = modal.querySelector("[data-product-dropzone]");
  const chooseButton = modal.querySelector("[data-product-choose-image]");
  const removeButton = modal.querySelector("[data-product-remove-image]");
  const fileName = modal.querySelector("[data-product-file-name]");
  const uploadMessage = modal.querySelector("[data-product-upload-message]");
  const galleryInput = modal.querySelector('[name="gallery_urls"]');
  const gallery = modal.querySelector("[data-gallery-preview]");
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  const maxImageSize = 5 * 1024 * 1024;
  const maxGalleryImages = 8;
  let objectUrls = [];

  const setMainImage = (url, { message = "Đã chọn ảnh chính" } = {}) => {
    const nextUrl = String(url || "").trim();
    hiddenInput.value = nextUrl;
    thumbnail.src = resolveImageUrl(nextUrl);
    removeButton.hidden = !nextUrl;
    if (nextUrl) {
      fileName.textContent = "Ảnh chính đã chọn";
      uploadMessage.textContent = message;
      uploadMessage.className = "is-success";
    }
    updateGallery();
  };

  const updateGallery = () => {
    const urls = readGalleryUrls().slice(0, maxGalleryImages);
    const selectedUrl = String(hiddenInput.value || urls[0] || "").trim();
    if (!hiddenInput.value && urls[0]) {
      hiddenInput.value = urls[0];
      thumbnail.src = resolveImageUrl(urls[0]);
      removeButton.hidden = false;
    }
    gallery.innerHTML = urls.length ? urls.map((url, index) => {
      const isMain = String(url).trim() === selectedUrl;
      return `<div class="admin-product-gallery-item${isMain ? " is-main" : ""}" style="position:relative;border:2px solid ${isMain ? "#16a34a" : "#e2e8f0"};border-radius:8px;padding:6px;display:grid;gap:6px;background:#fff;">
        ${isMain ? '<span class="admin-product-main-badge" style="position:absolute;left:8px;top:8px;background:#16a34a;color:#fff;border-radius:999px;padding:3px 8px;font-size:12px;font-weight:700;">Ảnh chính</span>' : ""}
        <img src="${globalThis.FASHION_IMAGE_PLACEHOLDER}" data-product-image-src="${escapeHtml(resolveImageUrl(url))}" alt="Ảnh gallery ${index + 1}" loading="lazy" decoding="async" data-product-image>
        <button type="button" data-product-main-image="${escapeHtml(url)}" ${isMain ? "disabled" : ""} style="border:1px solid ${isMain ? "#16a34a" : "#cbd5e1"};background:${isMain ? "#dcfce7" : "#fff"};color:${isMain ? "#166534" : "#334155"};border-radius:6px;padding:6px 8px;font-weight:700;cursor:${isMain ? "default" : "pointer"};"><i class="fa-${isMain ? "solid" : "regular"} fa-star" aria-hidden="true"></i> ${isMain ? "Ảnh chính" : "Đặt làm ảnh chính"}</button>
      </div>`;
    }).join("") : '<span>Chưa có ảnh gallery</span>';
    bindImageFallbacks(gallery);
  };

  thumbnail.addEventListener("error", () => { thumbnail.src = PLACEHOLDER; });
  galleryInput.addEventListener("input", updateGallery);
  gallery.addEventListener("click", (event) => { const button = event.target.closest("[data-product-main-image]"); if (button && !button.disabled) setMainImage(button.dataset.productMainImage); });
  chooseButton.addEventListener("click", (event) => { event.stopPropagation(); fileInput.click(); });
  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); fileInput.click(); } });
  fileInput.addEventListener("change", () => { if (fileInput.files?.length) uploadImages(fileInput.files); });
  ["dragenter", "dragover"].forEach((type) => dropzone.addEventListener(type, (event) => { event.preventDefault(); dropzone.classList.add("is-dragging"); }));
  ["dragleave", "drop"].forEach((type) => dropzone.addEventListener(type, (event) => { event.preventDefault(); dropzone.classList.remove("is-dragging"); }));
  dropzone.addEventListener("drop", (event) => { const files = event.dataTransfer?.files; if (files?.length) uploadImages(files); });
  removeButton.addEventListener("click", () => {
    hiddenInput.value = ""; fileInput.value = ""; thumbnail.src = PLACEHOLDER; updateGallery();
    fileName.textContent = "Chưa chọn ảnh"; uploadMessage.textContent = "Ảnh sẽ được xóa khi lưu sản phẩm";
    uploadMessage.className = "is-warning"; removeButton.hidden = true;
  });

  async function uploadImages(fileList) {
    const files = Array.from(fileList || []);
    const invalidType = files.find((file) => !allowedTypes.includes(file.type));
    if (invalidType) return showUploadError("Chỉ hỗ trợ ảnh JPG, PNG và WEBP.");
    const oversized = files.find((file) => file.size > maxImageSize);
    if (oversized) return showUploadError(`Ảnh "${oversized.name}" vượt quá 5MB.`);
    const currentUrls = readGalleryUrls();
    if (currentUrls.length + files.length > maxGalleryImages) return showUploadError(`Gallery tối đa ${maxGalleryImages} ảnh. Hiện đã có ${currentUrls.length} ảnh.`);

    const previousThumbnailUrl = hiddenInput.value;
    const previousGalleryValue = galleryInput.value;
    clearObjectUrls();
    objectUrls = files.map((file) => URL.createObjectURL(file));
    if (!hiddenInput.value && objectUrls[0]) thumbnail.src = objectUrls[0];
    fileName.textContent = files.length === 1 ? files[0].name : `${files.length} ảnh đã chọn`;
    uploadMessage.textContent = `Đang tải ${files.length} ảnh...`;
    uploadMessage.className = "is-uploading"; form.dataset.imageUploading = "true"; chooseButton.disabled = true;
    form.querySelector("[data-product-submit]").disabled = true;

    try {
      const response = files.length > 1
        ? await uploadService.uploadImages(files, { showErrorToast: false, loadingMessage: "Đang tải ảnh sản phẩm..." })
        : await uploadService.uploadProductImage(files[0], { showErrorToast: false, loadingMessage: "Đang tải ảnh sản phẩm..." });
      const uploadedUrls = extractUploadedUrls(response);
      if (!uploadedUrls.length) throw new Error("Backend không trả về URL ảnh.");
      appendGalleryUrls(uploadedUrls);
      const firstUrl = uploadedUrls[0];
      if (!hiddenInput.value && firstUrl) {
        hiddenInput.value = firstUrl;
        thumbnail.src = resolveImageUrl(firstUrl);
        removeButton.hidden = false;
      }
      uploadMessage.textContent = `Tải thành công ${uploadedUrls.length} ảnh`;
      uploadMessage.className = "is-success";
      fileName.textContent = files.length === 1 ? (response.data?.originalName || files[0].name) : `${uploadedUrls.length} ảnh đã thêm vào gallery`;
      toast.success(`Đã thêm ${uploadedUrls.length} ảnh vào Gallery URLs.`);
    } catch (error) {
      hiddenInput.value = previousThumbnailUrl;
      thumbnail.src = resolveImageUrl(previousThumbnailUrl);
      galleryInput.value = previousGalleryValue;
      updateGallery();
      showUploadError(message(error));
    } finally {
      form.dataset.imageUploading = "false";
      chooseButton.disabled = false;
      form.querySelector("[data-product-submit]").disabled = false;
      clearObjectUrls();
      fileInput.value = "";
    }
  }

  function readGalleryUrls() {
    return galleryInput.value.split("\n").map((url) => url.trim()).filter(Boolean);
  }

  function appendGalleryUrls(uploadedUrls) {
    const currentUrls = readGalleryUrls();
    const newUrls = uploadedUrls.map((url) => String(url || "").trim()).filter((url) => url && !currentUrls.includes(url));
    galleryInput.value = [...currentUrls, ...newUrls].slice(0, maxGalleryImages).join("\n");
    galleryInput.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function extractUploadedUrls(response) {
    const data = response?.data || {};
    const items = data.items || data.files || data.images || (data.url ? [data] : []);
    return (Array.isArray(items) ? items : [items])
      .map((item) => String(item?.url || "").trim())
      .filter((url) => /^https:\/\//i.test(url));
  }

  function clearObjectUrls() {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls = [];
  }

  function showUploadError(errorMessage) { uploadMessage.textContent = errorMessage; uploadMessage.className = "is-error"; toast.error(errorMessage); }
  modal._productPreviewCleanup = clearObjectUrls;
  updateGallery();
}
function bindProductVariantSection(modal, product, root = null) {
  const section = modal.querySelector("[data-product-variant-section]");
  if (!section) return;
  const hint = section.querySelector("[data-product-variant-hint]");
  const editor = section.querySelector("[data-product-variant-editor]");
  const table = section.querySelector("[data-product-variant-table]");
  let editingVariantId = null;
  let selectedColors = [];
  let selectedSizes = [];
  let renderSelectionLists = null;
  let colorOptions = [
    { name: "Đen", value: "Black", colorCode: "#000000" },
    { name: "Trắng", value: "White", colorCode: "#FFFFFF" },
    { name: "Xanh", value: "Green", colorCode: "#10B981" },
    { name: "Xám", value: "Gray", colorCode: "#9CA3AF" },
    { name: "Hồng", value: "Pink", colorCode: "#EC4899" },
    { name: "Đỏ", value: "Red", colorCode: "#EF4444" }
  ];
  let activeSizePresetKey = getProductSizePreset(product)?.key || "quanao";
  let sizeOptions = [...(SIZE_PRESETS[activeSizePresetKey]?.sizes || SIZE_PRESETS.quanao.sizes)];

  if (!product?.id) {
    section.innerHTML = `<div class="admin-product-variant-empty">Sản phẩm này chưa có biến thể. Tạo sản phẩm trước rồi quay lại phần này để tạo biến thể theo màu và size.</div>`;
    if (hint) hint.textContent = "Tạo sản phẩm trước, sau đó thêm biến thể từ đây.";
    return;
  }

  renderBuilder();
  void renderVariants();

  function renderBuilder() {
    section.innerHTML = `
      <div class="admin-product-variant-toolbar">
        <span class="admin-product-variant-hint" data-product-variant-hint>Chọn màu và size, sau đó tạo biến thể hàng loạt bằng cấu hình mặc định.</span>
      </div>
      <div class="admin-product-variant-builder">
        <div class="admin-product-variant-step">
          <div class="admin-product-variant-step-title">1. Chọn màu sắc</div>
          <div class="admin-product-variant-chip-list" data-color-options></div>
          <form class="admin-product-variant-inline-form" data-custom-color-form>
            <div class="admin-product-variant-inline-fields">
              <label><span>Tên màu</span><input type="text" name="customColorName" placeholder="Ví dụ: Xanh navy" /></label>
              <label><span>Mã màu HEX</span><input type="text" name="customColorCode" placeholder="#1E3A8A" /></label>
              <button type="submit">+ Thêm màu khác</button>
            </div>
          </form>
        </div>
        <div class="admin-product-variant-step">
          <div class="admin-product-variant-step-title">2. Chọn kích thước</div>
          <div class="admin-product-variant-preset-row">
            ${Object.entries(SIZE_PRESETS).map(([key, preset]) => `<button type="button" class="admin-product-variant-preset${key === activeSizePresetKey ? " is-active" : ""}" data-size-preset="${escapeHtml(key)}">${escapeHtml(preset.label)}</button>`).join("")}
          </div>
          <div class="admin-product-variant-chip-list" data-size-options></div>
          <form class="admin-product-variant-inline-form" data-custom-size-form>
            <div class="admin-product-variant-inline-fields">
              <label><span>Size mới</span><input type="text" name="customSize" placeholder="Ví dụ: XXL" /></label>
              <button type="submit">+ Thêm size khác</button>
            </div>
          </form>
        </div>
        <div class="admin-product-variant-step">
          <div class="admin-product-variant-step-title">3. Tạo biến thể</div>
          <p class="admin-product-form-error" data-bulk-create-error></p>
          <button type="button" class="admin-product-variant-create" data-product-variant-create>Tạo biến thể đã chọn</button>
        </div>
        <div class="admin-product-variant-step">
          <div class="admin-product-variant-step-title">4. Cập nhật tồn kho hàng loạt</div>
          <div class="admin-product-variant-bulk-stock">
            <div class="admin-product-variant-bulk-grid">
              <label><span>Phạm vi</span><select data-bulk-stock-scope><option value="all">Tất cả biến thể</option><option value="color">Theo màu</option><option value="size">Theo kích thước</option></select></label>
              <label class="bulk-stock-color" hidden><span>Màu</span><select data-bulk-stock-color><option value="">Chọn màu</option></select></label>
              <label class="bulk-stock-size" hidden><span>Size</span><select data-bulk-stock-size><option value="">Chọn size</option></select></label>
              <label class="bulk-stock-value"><span>Tồn kho mới</span><input type="number" name="bulkStockValue" min="0" step="1" value="0" /></label>
            </div>
            <div class="admin-product-variant-bulk-actions">
              <button type="button" class="admin-product-variant-create" data-bulk-stock-apply>Cập nhật tồn kho</button>
              <span class="admin-product-variant-hint">Chọn phạm vi rồi bấm cập nhật tồn kho cho các biến thể phù hợp.</span>
            </div>
            <p class="admin-product-form-error" data-bulk-error></p>
          </div>
        </div>
      </div>
      <div class="admin-product-variant-editor" data-product-variant-editor hidden></div>
      <div class="admin-product-variant-table" data-product-variant-table></div>
    `;

    bindBuilderEvents();
  }

  function bindBuilderEvents() {
    const colorContainer = section.querySelector("[data-color-options]");
    const sizeContainer = section.querySelector("[data-size-options]");
    const customColorForm = section.querySelector("[data-custom-color-form]");
    const customSizeForm = section.querySelector("[data-custom-size-form]");
    const createButton = section.querySelector("[data-product-variant-create]");
    const bulkStockApply = section.querySelector("[data-bulk-stock-apply]");
    const bulkScopeSelect = section.querySelector("[data-bulk-stock-scope]");
    const bulkColorField = section.querySelector(".bulk-stock-color");
    const bulkSizeField = section.querySelector(".bulk-stock-size");
    const bulkColorSelect = section.querySelector("[data-bulk-stock-color]");
    const bulkSizeSelect = section.querySelector("[data-bulk-stock-size]");
    const bulkStockValue = section.querySelector("[name='bulkStockValue']");
    const bulkCreateErrorTarget = section.querySelector("[data-bulk-create-error]");
    const bulkErrorTarget = section.querySelector("[data-bulk-error]");
    const categorySelect = modal.querySelector('[name="category_id"]');

    const applySizePreset = (presetKey, { selectAll = false } = {}) => {
      if (!SIZE_PRESETS[presetKey]) return;
      activeSizePresetKey = presetKey;
      sizeOptions = applySizePresetToOptions(presetKey);
      if (selectAll) selectedSizes = [...sizeOptions];
      renderSelectionLists?.();
    };

    renderSelectionLists = () => {
      colorContainer.innerHTML = colorOptions.map((color) => {
        const active = selectedColors.includes(color.value) || selectedColors.includes(color.name);
        return `<label class="admin-product-variant-chip admin-product-variant-chip-color ${active ? "is-active" : ""}">
          <input type="checkbox" data-color-option="${escapeHtml(color.value)}" ${active ? "checked" : ""}>
          <span class="admin-product-variant-swatch" style="background:${escapeHtml(color.colorCode || "#ccc")}"></span>
          <span>${escapeHtml(color.name)}</span>
        </label>`;
      }).join("");

      sizeContainer.innerHTML = sizeOptions.map((size) => {
        const active = selectedSizes.includes(size);
        return `<label class="admin-product-variant-chip ${active ? "is-active" : ""}">
          <input type="checkbox" data-size-option="${escapeHtml(size)}" ${active ? "checked" : ""}>
          <span>${escapeHtml(size)}</span>
        </label>`;
      }).join("");

      section.querySelectorAll("[data-size-preset]").forEach((button) => button.classList.toggle("is-active", button.dataset.sizePreset === activeSizePresetKey));

      colorContainer.querySelectorAll("input[data-color-option]").forEach((input) => input.addEventListener("change", (event) => {
        const value = event.currentTarget.dataset.colorOption;
        selectedColors = event.currentTarget.checked ? Array.from(new Set([...selectedColors, value])) : selectedColors.filter((item) => item !== value);
        renderSelectionLists();
      }));

      sizeContainer.querySelectorAll("input[data-size-option]").forEach((input) => input.addEventListener("change", (event) => {
        const value = event.currentTarget.dataset.sizeOption;
        selectedSizes = event.currentTarget.checked ? Array.from(new Set([...selectedSizes, value])) : selectedSizes.filter((item) => item !== value);
        renderSelectionLists();
      }));
    };

    customColorForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(customColorForm);
      const name = String(formData.get("customColorName") || "").trim();
      const code = String(formData.get("customColorCode") || "").trim();
      if (!name) return toast.error("Vui lòng nhập tên màu.");
      if (code && !/^#[0-9a-f]{6}$/i.test(code)) return toast.error("Mã màu phải có định dạng HEX như #1E3A8A.");
      const value = name;
      if (!colorOptions.some((item) => item.value === value || item.name === name)) {
        colorOptions = [...colorOptions, { name, value, colorCode: code || "#cccccc" }];
        selectedColors = [...selectedColors, value];
      }
      customColorForm.reset();
      renderSelectionLists();
      toast.success(`Đã thêm màu ${name}.`);
    });

    customSizeForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(customSizeForm);
      const value = String(formData.get("customSize") || "").trim();
      if (!value) return toast.error("Vui lòng nhập size mới.");
      if (!sizeOptions.includes(value)) {
        sizeOptions = [...sizeOptions, value];
        selectedSizes = [...selectedSizes, value];
      }
      customSizeForm.reset();
      renderSelectionLists();
      toast.success(`Đã thêm size ${value}.`);
    });

    section.querySelectorAll("[data-size-preset]").forEach((button) => button.addEventListener("click", () => {
      applySizePreset(button.dataset.sizePreset, { selectAll: true });
    }));

    categorySelect?.addEventListener("change", () => {
      const preset = getProductSizePreset({ ...product, categoryId: categorySelect.value, categoryName: state.categories.find((category) => String(category.id) === String(categorySelect.value))?.name || "" });
      if (preset && (!selectedSizes.length || arraysEqual(selectedSizes, SIZE_PRESETS[activeSizePresetKey]?.sizes || []))) {
        applySizePreset(preset.key, { selectAll: true });
      }
    });

    bulkScopeSelect?.addEventListener("change", () => {
      updateBulkFields();
    });

    createButton?.addEventListener("click", async () => {
      bulkCreateErrorTarget.textContent = "";
      if (!selectedColors.length) {
        bulkCreateErrorTarget.textContent = "Vui lòng chọn ít nhất một màu.";
        return;
      }
      if (!selectedSizes.length) {
        bulkCreateErrorTarget.textContent = "Vui lòng chọn ít nhất một kích thước.";
        return;
      }
      const price = Number(product?.price ?? 0);
      const salePrice = product?.salePrice ?? product?.sale_price ?? null;
      const stock = 0;
      const status = "active";
      const createdVariants = [];
      const skippedVariants = [];
      const existingKeys = new Set((product?.existingVariants || []).map((variant) => `${normalizeVariantKey(variant.color)}::${normalizeVariantKey(variant.size)}`));
      const existingSkus = new Set((product?.existingVariants || []).map((variant) => String(variant.sku || "").trim().toUpperCase()));

      for (const color of selectedColors) {
        const colorOption = colorOptions.find((item) => item.value === color || item.name === color) || { name: color, value: color, colorCode: "#cccccc" };
        for (const size of selectedSizes) {
          const fingerprint = `${normalizeVariantKey(colorOption.name || color)}::${normalizeVariantKey(size)}`;
          if (existingKeys.has(fingerprint)) {
            skippedVariants.push(`${colorOption.name || color}/${size}`);
            continue;
          }
          const nextSku = createVariantSku(product?.sku, colorOption.name || color, size);
          if (existingSkus.has(nextSku)) {
            skippedVariants.push(`${colorOption.name || color}/${size}`);
            continue;
          }
          try {
            const payload = {
              sku: nextSku,
              size,
              color: colorOption.name || color,
              colorCode: colorOption.colorCode || "",
              price,
              salePrice,
              stock,
              status
            };
            await productService.createVariant(product.id, payload, silent());
            createdVariants.push(payload);
            existingKeys.add(fingerprint);
            existingSkus.add(nextSku);
          } catch (error) {
            skippedVariants.push(`${colorOption.name || color}/${size}`);
          }
        }
      }

      if (!createdVariants.length && skippedVariants.length) {
        bulkCreateErrorTarget.textContent = `Không tạo mới biến thể nào. Thất bại/bỏ qua ${skippedVariants.length} biến thể vì đã tồn tại hoặc API không thành công.`;
        toast.error(bulkCreateErrorTarget.textContent);
      } else {
        toast.success(skippedVariants.length ? `Tạo biến thể thành công: ${createdVariants.length} tạo mới, ${skippedVariants.length} thất bại/bỏ qua.` : "Tạo biến thể thành công");
      }
      await renderVariants({ force: true });
      if (root) renderRows(root);
    });

    bulkStockApply?.addEventListener("click", async () => {
      bulkErrorTarget.textContent = "";
      const scope = bulkScopeSelect?.value || "all";
      const stockValue = bulkStockValue ? Number(bulkStockValue.value) : null;
      const selectedColor = bulkColorSelect?.value || "";
      const selectedSize = bulkSizeSelect?.value || "";
      const allVariants = product?.existingVariants || [];
      const updates = [];

      if (stockValue === null || !Number.isInteger(stockValue) || stockValue < 0) {
        bulkErrorTarget.textContent = "Tồn kho phải là số nguyên không âm.";
        return;
      }

      if (!allVariants.length) {
        bulkErrorTarget.textContent = "Không có biến thể nào để cập nhật.";
        return;
      }

      let targetVariants = [];
      if (scope === "all") {
        targetVariants = allVariants;
      } else if (scope === "color") {
        if (!selectedColor) { bulkErrorTarget.textContent = "Vui lòng chọn màu."; return; }
        targetVariants = allVariants.filter((variant) => normalizeVariantKey(variant.color) === normalizeVariantKey(selectedColor));
      } else if (scope === "size") {
        if (!selectedSize) { bulkErrorTarget.textContent = "Vui lòng chọn size."; return; }
        targetVariants = allVariants.filter((variant) => normalizeVariantKey(variant.size) === normalizeVariantKey(selectedSize));
      }

      if (!targetVariants.length) {
        bulkErrorTarget.textContent = "Không có biến thể nào phù hợp để cập nhật.";
        return;
      }

      updates.push(...targetVariants.map((variant) => ({ variantId: variant.id, stock: stockValue })));

      const results = await Promise.allSettled(updates.map((item) => productService.updateVariantStock(product.id, item.variantId, { stock: item.stock }, silent())));
      const successCount = results.filter((result) => result.status === "fulfilled").length;
      const failedCount = results.length - successCount;
      if (successCount) {
        toast.success(`Đã cập nhật tồn kho cho ${successCount} biến thể.`);
      }
      if (failedCount) {
        bulkErrorTarget.textContent = `Không cập nhật được ${failedCount} biến thể.`;
      }
      await renderVariants({ force: true });
      if (root) renderRows(root);
    });

    renderSelectionLists();
  }

  async function renderVariants({ force = false } = {}) {
    if (!product?.id) return;

    if (variantsLoadingProductId === product.id) {
      console.debug("[VARIANTS] skip duplicate request", product.id);
      return;
    }

    if (!force && variantsLoadedProductId === product.id && Array.isArray(currentVariantsCache)) {
      console.debug("[VARIANTS] use cached variants", product.id, currentVariantsCache.length);
      renderVariantTable(currentVariantsCache);
      return;
    }

    variantsLoadingProductId = product.id;
    console.debug("[VARIANTS] load start", product.id);

    try {
      const variants = await loadProductVariants(product.id, { force });
      renderVariantTable(variants);
    } catch (error) {
      table.innerHTML = `<div class="admin-product-variant-empty">${escapeHtml(message(error))}</div>`;
      toast.error(message(error));
    } finally {
      if (variantsLoadingProductId === product.id) {
        variantsLoadingProductId = null;
      }
    }
  }

  function renderVariantTable(variants) {
    product.existingVariants = variants;
    product.variantCount = variants.length;
    product.variants = variants;
    syncProductVariantState(state, { id: product.id, variantCount: variants.length, variants });
    if (root) renderRows(root);
    if (!selectedColors.length) {
      selectedColors = Array.from(new Set(variants.map((variant) => variant.color).filter(Boolean)));
    }
    if (!selectedSizes.length) {
      selectedSizes = Array.from(new Set(variants.map((variant) => variant.size).filter(Boolean)));
    }
    renderSelectionLists?.();
    if (!variants.length) {
      table.innerHTML = '<div class="admin-product-variant-empty">Chưa có biến thể nào. Hãy chọn màu và size, sau đó tạo biến thể hàng loạt.</div>';
    } else {
      table.innerHTML = `<div class="admin-product-variant-grid">${variants.map((variant) => {
        const isEditing = String(inlineEditingId) === String(variant.id);
        if (isEditing) {
          return `<div class="admin-product-variant-row" data-variant-row="${variant.id}">
            <span><input class="variant-input" name="sku" value="${escapeHtml(variant.sku || "")}"></span>
            <span><input class="variant-input" name="color" value="${escapeHtml(variant.color || "")}"></span>
            <span><input class="variant-input" name="color_code" value="${escapeHtml(variant.colorCode || "")}" placeholder="#FFFFFF"></span>
            <span><input class="variant-input" name="size" value="${escapeHtml(variant.size || "")}"></span>
            <span><input class="variant-input" name="price" type="number" min="0" value="${Number(variant.price ?? 0)}"></span>
            <span><input class="variant-input" name="sale_price" type="number" min="0" value="${variant.salePrice === null ? "" : Number(variant.salePrice)}"></span>
            <span><input class="variant-input" name="stock" type="number" min="0" value="${Number(variant.stock || 0)}"></span>
            <span>${escapeHtml(String(variant.sold || 0))}</span>
            <span><select class="variant-input" name="status"><option value="active" ${variant.status === 'active' ? 'selected' : ''}>Đang bán</option><option value="inactive" ${variant.status === 'inactive' ? 'selected' : ''}>Tạm ẩn</option><option value="out_of_stock" ${variant.status === 'out_of_stock' ? 'selected' : ''}>Hết hàng</option></select></span>
            <div class="admin-product-variant-actions"><button type="button" class="btn-save" data-variant-save="${variant.id}">Lưu thay đổi</button><button type="button" class="btn-cancel" data-variant-cancel="${variant.id}">Hủy</button></div>
          </div>`;
        }

        const stockBadge = Number(variant.stock || 0) === 0 ? `<span class="variant-badge is-empty">Hết hàng</span>` : Number(variant.stock || 0) <= 5 ? `<span class="variant-badge is-low">Sắp hết · ${Number(variant.stock)}</span>` : `${Number(variant.stock)}`;
        return `<div class="admin-product-variant-row" data-variant-row="${variant.id}"><span>${escapeHtml(variant.sku || "-")}</span><span>${escapeHtml(variant.color || "-")}</span><span>${escapeHtml(variant.size || "-")}</span><span>${escapeHtml(formatCurrency(variant.price ?? 0))}</span><span>${escapeHtml(variant.salePrice === null ? "-" : formatCurrency(variant.salePrice))}</span><span>${stockBadge}</span><span>${escapeHtml(String(variant.sold || 0))}</span><span>${escapeHtml(statusLabel(variant.status))}</span><div class="admin-product-variant-actions"><button type="button" data-variant-edit="${variant.id}">Sửa</button><button type="button" class="is-danger" data-variant-delete="${variant.id}">Xóa</button></div></div>`;
      }).join("")}</div>`;
    }
    table.querySelectorAll("[data-variant-edit]").forEach((button) => {
      button.addEventListener("click", () => {
        const vid = button.dataset.variantEdit;
        inlineEditingId = vid;
        renderVariantTable(variants);
        setTimeout(() => { const row = table.querySelector(`[data-variant-row="${vid}"]`); row?.querySelectorAll(".variant-input")[0]?.focus(); }, 30);
      });
    });

    table.querySelectorAll("[data-variant-save]").forEach((button) => {
      button.addEventListener("click", async () => {
        const vid = button.dataset.variantSave;
        const row = table.querySelector(`[data-variant-row="${vid}"]`);
        if (!row) return;
        const inputsArr = Array.from(row.querySelectorAll('.variant-input'));
        const inputs = {};
        inputsArr.forEach((el) => { const name = el.name; const val = el.type === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value; inputs[name] = val; });

        // Validation
        if (!String(inputs.sku || '').trim()) return toast.error('SKU không được để trống.');
        if (!String(inputs.color || '').trim()) return toast.error('Màu không được để trống.');
        if (!String(inputs.size || '').trim()) return toast.error('Size không được để trống.');
        if (inputs.price !== null && inputs.price < 0) return toast.error('Giá phải >= 0');
        if (inputs.sale_price !== null && inputs.sale_price < 0) return toast.error('Giá sale phải >= 0');
        if (inputs.sale_price !== null && inputs.price !== null && inputs.sale_price > inputs.price) return toast.error('Giá sale không được lớn hơn giá.');
        if (inputs.stock !== null && (!Number.isInteger(inputs.stock) || inputs.stock < 0)) return toast.error('Tồn kho phải là số nguyên >= 0');
        if (inputs.color_code && !/^#[0-9a-f]{6}$/i.test(inputs.color_code)) return toast.error('Mã màu phải có định dạng HEX như #FFFFFF');

        try {
          await productService.updateVariant(product.id, vid, {
            sku: String(inputs.sku || '').trim().toUpperCase(),
            color: String(inputs.color || '').trim(),
            color_code: String(inputs.color_code || '').trim(),
            size: String(inputs.size || '').trim(),
            price: inputs.price,
            sale_price: inputs.sale_price,
            stock: inputs.stock,
            status: row.querySelector('[name="status"]').value
          }, silent());
          toast.success('Đã cập nhật biến thể');
          inlineEditingId = null;
          await renderVariants({ force: true });
          if (root) renderRows(root);
        } catch (error) {
          toast.error(message(error));
        }
      });
    });

    table.querySelectorAll("[data-variant-cancel]").forEach((button) => {
      button.addEventListener("click", () => {
        inlineEditingId = null;
        renderVariantTable(variants);
      });
    });

    table.querySelectorAll("[data-variant-delete]").forEach((button) => {
      button.addEventListener("click", async () => {
        const variant = variants.find((item) => String(item.id) === String(button.dataset.variantDelete));
        if (!confirm('Bạn có chắc muốn xóa biến thể này không?')) return;
        try {
          await productService.deleteVariant(product.id, variant.id, silent());
          toast.success('Đã xóa biến thể');
          await renderVariants({ force: true });
          if (root) renderRows(root);
        } catch (error) {
          toast.error(message(error));
        }
      });
    });
    if (section.querySelector("[data-color-options]") && section.querySelector("[data-size-options]") && !section.querySelector("[data-color-options]").dataset.bound) {
      const colorContainer = section.querySelector("[data-color-options]");
      const sizeContainer = section.querySelector("[data-size-options]");
      colorContainer.dataset.bound = "true";
      sizeContainer.dataset.bound = "true";
    }
  }

  async function loadProductVariants(productId, { force = false } = {}) {
    if (!productId) return [];

    if (variantsLoadingProductId === productId) {
      console.debug("[VARIANTS] already loading", productId);
      return currentVariantsCache;
    }

    if (!force && variantsLoadedProductId === productId && Array.isArray(currentVariantsCache)) {
      console.debug("[VARIANTS] use cached variants", productId, currentVariantsCache.length);
      return currentVariantsCache;
    }

    variantsLoadingProductId = productId;
    console.debug("[VARIANTS] load start", productId);

    try {
      const response = await productService.getVariants(productId, silent());
      const variants = Array.isArray(response.data?.variants) ? response.data.variants : [];
      currentVariantsCache = variants;
      variantsLoadedProductId = productId;
      console.debug("[VARIANTS] load done", productId, variants.length);
      return variants;
    } catch (error) {
      console.debug("[VARIANTS] load failed", productId, error?.message || error);
      throw error;
    } finally {
      if (variantsLoadingProductId === productId) {
        variantsLoadingProductId = null;
      }
    }
  }

  function showEditor(variant = null) {
    editingVariantId = variant?.id || null;
    const suggestedSku = product?.sku ? `${product.sku}${variant?.color ? `-${String(variant.color).toUpperCase().replace(/\s+/g, "-")}` : ""}${variant?.size ? `-${String(variant.size).toUpperCase()}` : ""}` : "";
    editor.hidden = false;
    editor.innerHTML = `<div class="admin-product-variant-editor-form"><div class="admin-product-variant-editor-grid">${field("SKU biến thể", "variant_sku", variant?.sku || suggestedSku, "text", true)}${field("Màu sắc", "variant_color", variant?.color || "", "text", true)}${field("Mã màu", "variant_color_code", variant?.colorCode || "", "text", false, 'placeholder="#000000"')}${field("Kích thước", "variant_size", variant?.size || "", "text", true)}</div><div class="admin-product-variant-editor-grid">${field("Giá", "variant_price", variant?.price ?? "", "number", false, 'min="0" step="1000"')}${field("Giá sale", "variant_sale_price", variant?.salePrice ?? "", "number", false, 'min="0" step="1000"')}${field("Tồn kho", "variant_stock", variant?.stock ?? "", "number", true, 'min="0" step="1"')}${field("Trạng thái", "variant_status", variant?.status || "active", "text", false, 'placeholder="active"')}</div><div class="admin-product-variant-editor-actions"><button type="button" class="is-secondary" data-variant-editor-cancel>Hủy</button><button type="submit" data-variant-editor-save>${variant ? "Cập nhật" : "Lưu biến thể"}</button></div><p class="admin-product-form-error" data-variant-editor-error></p></div>`;
    const form = editor.querySelector(".admin-product-variant-editor-form");
    const skuInput = form.querySelector('[name="variant_sku"]');
    const colorInput = form.querySelector('[name="variant_color"]');
    const sizeInput = form.querySelector('[name="variant_size"]');
    const syncSku = () => {
      const base = String(product?.sku || "").trim().toUpperCase();
      const color = String(colorInput.value || "").trim().replace(/\s+/g, "-").toUpperCase();
      const size = String(sizeInput.value || "").trim().replace(/\s+/g, "-").toUpperCase();
      const nextSku = [base, color, size].filter(Boolean).join("-");
      if (nextSku) skuInput.value = nextSku;
    };
    colorInput?.addEventListener("input", syncSku);
    sizeInput?.addEventListener("input", syncSku);
    form.querySelector("[data-variant-editor-cancel]").addEventListener("click", () => { editor.hidden = true; editor.innerHTML = ""; editingVariantId = null; });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const payload = {
        sku: String(formData.get("variant_sku") || "").trim().toUpperCase(),
        size: String(formData.get("variant_size") || "").trim(),
        color: String(formData.get("variant_color") || "").trim(),
        colorCode: String(formData.get("variant_color_code") || "").trim(),
        price: formData.get("variant_price") === "" ? null : Number(formData.get("variant_price")),
        salePrice: formData.get("variant_sale_price") === "" ? null : Number(formData.get("variant_sale_price")),
        stock: Number(formData.get("variant_stock") || 0),
        status: String(formData.get("variant_status") || "active").trim().toLowerCase()
      };
      const errorTarget = form.querySelector("[data-variant-editor-error]");
      try {
        if (editingVariantId) await productService.updateVariant(product.id, editingVariantId, payload, silent());
        else await productService.createVariant(product.id, payload, silent());
        toast.success(editingVariantId ? "Đã cập nhật biến thể." : "Đã thêm biến thể.");
        editor.hidden = true;
        editor.innerHTML = "";
        editingVariantId = null;
        await renderVariants({ force: true });
        if (root) renderRows(root);
      } catch (error) {
        errorTarget.textContent = message(error);
        toast.error(message(error));
      }
    });
  }
}

function applySizePresetToOptions(presetKey) {
  return [...(SIZE_PRESETS[presetKey]?.sizes || SIZE_PRESETS.quanao.sizes)];
}

function getProductSizePreset(product = {}) {
  const categoryName = state.categories.find((category) => String(category.id) === String(product?.categoryId || ""))?.name || product?.categoryName || product?.category?.name || product?.category || "";
  const searchable = normalizeSearchText(String(categoryName) + " " + String(product?.name || ""));
  const match = Object.entries(SIZE_PRESETS).find(([, preset]) => preset.keywords.some((keyword) => searchable.includes(keyword)));
  return match ? { key: match[0], ...match[1] } : null;
}

function normalizeSearchText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function arraysEqual(left = [], right = []) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function createVariantSku(productSku, color, size) {
  const base = String(productSku || "").trim().toUpperCase();
  const colorToken = normalizeVariantToken(color);
  const sizeToken = normalizeVariantToken(size);
  return [base, colorToken, sizeToken].filter(Boolean).join("-");
}

function normalizeVariantToken(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

function normalizeVariantKey(value) {
  return String(value || "").trim().toLowerCase();
}

function categoryOptions(selectedId) { return state.categories.map(c => `<option value="${id(c.id)}" ${String(c.id) === String(selectedId || "") ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join(""); }
function selected(current, value) { return (current || "active") === value ? "selected" : ""; }
function detailRow(label, value) { return `<p class="admin-product-detail-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? "-")}</strong></p>`; }
function renderPageError(error) { return `<section class="admin-product-page-error"><h1>Không thể tải sản phẩm</h1><p>${escapeHtml(message(error))}</p><a href="#products" data-page="products">Về danh sách</a><button type="button" data-product-retry>Thử lại</button></section>`; }
function stockBadge(stock) { const n = Number(stock || 0); return n === 0 ? '<span class="admin-stock-badge is-empty">Hết hàng · 0</span>' : n <= 5 ? `<span class="admin-stock-badge is-low">Sắp hết · ${n}</span>` : `<span class="admin-stock-badge">${n}</span>`; }
function statusBadge(status) { return `<span class="admin-product-status is-${escapeHtml(status || "unknown")}">${escapeHtml(statusLabel(status))}</span>`; }
function statusLabel(status) { return ({ active: "Đang bán", inactive: "Tạm ẩn", out_of_stock: "Hết hàng" })[status] || status || "-"; }
function resolveImageUrl(url) { if (!url) return PLACEHOLDER; const normalized = normalizeProductImageUrl(url); return globalThis.normalizeImageUrl?.(normalized) ?? normalized; }
function bindImageFallbacks(root) { root.querySelectorAll("[data-product-image]").forEach(img => img.addEventListener("error", () => { img.src = PLACEHOLDER; }, { once: true })); }
function setBusy(root, busy) { state.busy = busy; root?.querySelectorAll?.("button,input,select").forEach(el => { el.disabled = busy; }); }
function setFormBusy(form, busy) { form.querySelectorAll("button,input,select,textarea").forEach(el => { el.disabled = busy; }); const submit = form.querySelector("[data-product-submit]"); if (submit) submit.innerHTML = busy ? '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...' : submit.dataset.idleLabel; }
function silent() { return { showErrorToast: false }; }
function hasProductPermission(permission) { return hasPermission(permission) || hasPermission(PERMISSIONS.PRODUCT_MANAGE); }
function message(error) {
  if (error?.code === "OLD_PRODUCT_IMAGE_LOST" || error?.code === "OLD_UPLOAD_IMAGE_LOST") return OLD_UPLOAD_LOST_MESSAGE;
  if (error?.code === "PRODUCT_IMAGE_URL_UNREACHABLE") return "Ảnh sản phẩm hiện không truy cập được. Vui lòng tải lại ảnh hoặc chọn một ảnh hợp lệ.";
  if (error?.status === 401) return "Phiên đăng nhập hết hạn, vui lòng đăng nhập lại.";
  if (error?.status === 403) return "Bạn không có quyền quản lý sản phẩm.";
  if (error?.status === 404) return "Không tìm thấy sản phẩm.";
  if (error?.status === 429) return "Bạn thao tác quá nhanh hoặc hệ thống đang gửi quá nhiều yêu cầu. Vui lòng thử lại sau.";
  if (error?.status >= 500) return "Lỗi hệ thống, vui lòng thử lại.";
  return error?.message || "Không thể xử lý yêu cầu sản phẩm.";
}
function formatCurrency(value) { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value || 0)); }
function formatDate(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("vi-VN"); }
function id(value) { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? n : ""; }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
