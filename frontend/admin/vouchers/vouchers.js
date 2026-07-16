import { hidePageLoading, showPageLoading } from "../components/loading/loading.js";
import { toast } from "../components/toast/toast.js";
import { loadTemplate } from "../router/template-cache.js";
import { voucherService } from "../services/voucher.service.js";

const DEFAULT_QUERY = Object.freeze({ page: 1, limit: 10, sortBy: "createdAt", sortOrder: "desc" });
let state = { vouchers: [], pagination: null, query: { ...DEFAULT_QUERY }, busy: false, error: null };
let filterTimer = null;

export async function createVouchersPage() {
  showPageLoading("Đang tải mã giảm giá...");
  try { return await loadTemplate(new URL("./index.html", import.meta.url)); }
  finally { hidePageLoading(); }
}

export async function initVouchersPage(root = document) {
  bindEvents(root);
  await reload(root);
  return () => window.clearTimeout(filterTimer);
}

function bindEvents(root) {
  root.querySelector("[data-voucher-filters]")?.addEventListener("input", () => scheduleFilter(root));
  root.querySelector("[data-voucher-filters]")?.addEventListener("change", () => applyFilters(root));
  root.addEventListener("click", async (event) => {
    if (event.target.closest("[data-voucher-refresh]")) { await reload(root); return; }
    if (event.target.closest("[data-voucher-create]")) { openVoucherModal(root); return; }
    const pageButton = event.target.closest("[data-vouchers-page]");
    if (pageButton) { state.query = { ...state.query, page: Number(pageButton.dataset.vouchersPage) || 1 }; await reload(root); return; }
    const action = event.target.closest("[data-voucher-action]");
    if (!action) return;
    const voucher = state.vouchers.find((item) => String(item.id) === String(action.dataset.voucherId));
    if (!voucher) return;
    if (action.dataset.voucherAction === "edit") openVoucherModal(root, voucher);
    if (action.dataset.voucherAction === "toggle") await toggleVoucher(root, voucher);
    if (action.dataset.voucherAction === "delete") await deleteVoucher(root, voucher);
  });
}

function scheduleFilter(root) { window.clearTimeout(filterTimer); filterTimer = window.setTimeout(() => applyFilters(root), 250); }
async function applyFilters(root) {
  const data = new FormData(root.querySelector("[data-voucher-filters]"));
  state.query = { ...state.query, search: String(data.get("search") || "").trim(), status: String(data.get("status") || ""), page: 1 };
  await reload(root);
}

async function reload(root) {
  state.busy = true; renderTable(root);
  try {
    const response = await voucherService.getAll(state.query, silent());
    state.vouchers = (response.data?.vouchers || []).map(normalizeVoucher);
    state.pagination = response.meta?.pagination || null;
    state.error = null;
  } catch (error) { state.vouchers = []; state.error = error; toast.error(message(error)); }
  finally { state.busy = false; renderTable(root); renderPagination(root); }
}

function normalizeVoucher(voucher = {}) {
  return {
    id: voucher.id,
    code: voucher.code,
    name: voucher.name,
    description: voucher.description || "",
    discountType: voucher.discountType ?? voucher.discount_type,
    discountValue: Number(voucher.discountValue ?? voucher.discount_value ?? 0),
    minOrderAmount: Number(voucher.minOrderAmount ?? voucher.min_order_amount ?? 0),
    maxDiscountAmount: voucher.maxDiscountAmount ?? voucher.max_discount_amount ?? null,
    quantity: voucher.quantity ?? voucher.usageLimit ?? voucher.usage_limit ?? null,
    usedQuantity: Number(voucher.usedQuantity ?? voucher.used_quantity ?? voucher.usedCount ?? voucher.used_count ?? 0),
    startsAt: voucher.startsAt ?? voucher.starts_at ?? voucher.startDate ?? voucher.start_date ?? null,
    expiresAt: voucher.expiresAt ?? voucher.expires_at ?? voucher.endDate ?? voucher.end_date ?? null,
    status: voucher.status
  };
}

function renderTable(root) {
  const body = root.querySelector("[data-vouchers-body]");
  if (!body) return;
  if (state.busy) { body.innerHTML = `<tr><td colspan="11" class="admin-voucher-empty">Đang tải mã giảm giá...</td></tr>`; return; }
  if (state.error) { body.innerHTML = `<tr><td colspan="11"><div class="admin-voucher-error"><span>${escapeHtml(message(state.error))}</span><button type="button" data-voucher-refresh>Thử lại</button></div></td></tr>`; return; }
  body.innerHTML = state.vouchers.length ? state.vouchers.map(renderRow).join("") : `<tr><td colspan="11" class="admin-voucher-empty">Chưa có mã giảm giá nào.</td></tr>`;
}

function renderRow(voucher) {
  return `<tr>
    <td>#${escapeHtml(voucher.id)}</td><td><strong class="admin-voucher-code">${escapeHtml(voucher.code)}</strong></td><td>${escapeHtml(voucher.name)}</td>
    <td>${voucher.discountType === "percentage" ? "Percentage" : "Fixed"}</td><td>${voucher.discountType === "percentage" ? `${escapeHtml(voucher.discountValue)}%` : formatCurrency(voucher.discountValue)}</td>
    <td>${formatCurrency(voucher.minOrderAmount)}</td><td>${voucher.maxDiscountAmount == null ? "-" : formatCurrency(voucher.maxDiscountAmount)}</td>
    <td>${escapeHtml(voucher.usedQuantity)} / ${voucher.quantity == null ? "∞" : escapeHtml(voucher.quantity)}</td><td>${formatDate(voucher.startsAt)} → ${formatDate(voucher.expiresAt)}</td>
    <td><span class="admin-voucher-status is-${escapeHtml(voucher.status)}">${escapeHtml(voucher.status)}</span></td>
    <td><div class="admin-voucher-actions"><button data-voucher-action="edit" data-voucher-id="${escapeHtml(voucher.id)}" title="Sửa"><i class="fa-solid fa-pen"></i></button><button data-voucher-action="toggle" data-voucher-id="${escapeHtml(voucher.id)}" title="Bật/tắt"><i class="fa-solid ${voucher.status === "active" ? "fa-toggle-on" : "fa-toggle-off"}"></i></button><button class="is-danger" data-voucher-action="delete" data-voucher-id="${escapeHtml(voucher.id)}" title="Xóa"><i class="fa-solid fa-trash"></i></button></div></td>
  </tr>`;
}

function renderPagination(root) {
  const target = root.querySelector("[data-vouchers-pagination]");
  if (!target || !state.pagination) { if (target) target.innerHTML = ""; return; }
  const { page, totalPages, totalItems, hasPreviousPage, hasNextPage } = state.pagination;
  target.innerHTML = `<span>${state.vouchers.length} / ${totalItems} mã</span><div><button data-vouchers-page="${page - 1}" ${hasPreviousPage ? "" : "disabled"}>Trước</button><strong>Trang ${page}/${totalPages || 1}</strong><button data-vouchers-page="${page + 1}" ${hasNextPage ? "" : "disabled"}>Sau</button></div>`;
}

function openVoucherModal(root, voucher = null) {
  const editing = Boolean(voucher);
  const overlay = document.createElement("div");
  overlay.className = "admin-voucher-modal";
  overlay.innerHTML = `<section class="admin-voucher-dialog"><header><div><p>Voucher</p><h2>${editing ? "Sửa mã giảm giá" : "Thêm mã giảm giá"}</h2></div><button data-modal-close>×</button></header><div class="admin-voucher-modal-body">${formHtml(voucher)}</div><footer><button data-modal-close>Hủy</button><button class="is-primary" data-modal-save>${editing ? "Lưu thay đổi" : "Tạo mã"}</button></footer></section>`;
  document.body.appendChild(overlay); document.body.classList.add("modal-open"); requestAnimationFrame(() => overlay.classList.add("is-open"));
  overlay.addEventListener("click", async (event) => {
    if (event.target === overlay || event.target.closest("[data-modal-close]")) return closeModal(overlay);
    if (!event.target.closest("[data-modal-save]")) return;
    const errorTarget = overlay.querySelector("[data-voucher-form-error]"); if (errorTarget) errorTarget.textContent = "";
    try { const payload = readForm(overlay.querySelector("[data-voucher-form]")); if (editing) await voucherService.patch(voucher.id, payload, silent()); else await voucherService.create(payload, silent()); toast.success(editing ? "Đã cập nhật mã giảm giá." : "Đã thêm mã giảm giá."); closeModal(overlay); await reload(root); }
    catch (error) { if (errorTarget) errorTarget.textContent = message(error); toast.error(message(error)); }
  });
}

function formHtml(voucher = {}) {
  return `<form class="admin-voucher-form" data-voucher-form>
    <label><span>Code</span><input name="code" value="${escapeHtml(voucher.code || "")}" required></label><label><span>Tên mã</span><input name="name" value="${escapeHtml(voucher.name || "")}" required></label>
    <label class="is-full"><span>Mô tả</span><textarea name="description">${escapeHtml(voucher.description || "")}</textarea></label>
    <label><span>Loại giảm</span><select name="discountType"><option value="percentage" ${voucher.discountType === "percentage" ? "selected" : ""}>percentage</option><option value="fixed" ${voucher.discountType === "fixed" ? "selected" : ""}>fixed</option></select></label>
    <label><span>Giá trị giảm</span><input type="number" name="discountValue" value="${escapeHtml(voucher.discountValue ?? "")}" min="0" required></label>
    <label><span>Đơn tối thiểu</span><input type="number" name="minOrderAmount" value="${escapeHtml(voucher.minOrderAmount ?? 0)}" min="0"></label><label><span>Giảm tối đa</span><input type="number" name="maxDiscountAmount" value="${escapeHtml(voucher.maxDiscountAmount ?? "")}" min="0"></label>
    <label><span>Giới hạn lượt dùng</span><input type="number" name="quantity" value="${escapeHtml(voucher.quantity ?? "")}" min="1"></label><label><span>Ngày bắt đầu</span><input type="datetime-local" name="startsAt" value="${toInputDate(voucher.startsAt)}"></label>
    <label><span>Ngày kết thúc</span><input type="datetime-local" name="expiresAt" value="${toInputDate(voucher.expiresAt)}"></label><label><span>Trạng thái</span><select name="status"><option value="active" ${voucher.status === "active" ? "selected" : ""}>active</option><option value="inactive" ${voucher.status === "inactive" ? "selected" : ""}>inactive</option><option value="expired" ${voucher.status === "expired" ? "selected" : ""}>expired</option></select></label>
    <div class="admin-voucher-form-error is-full" data-voucher-form-error></div>
  </form>`;
}

function readForm(form) { const data = new FormData(form); return Object.fromEntries(["code","name","description","discountType","discountValue","minOrderAmount","maxDiscountAmount","quantity","startsAt","expiresAt","status"].map((key) => [key, String(data.get(key) || "").trim()])); }
async function toggleVoucher(root, voucher) { await voucherService.updateStatus(voucher.id, voucher.status === "active" ? "inactive" : "active", silent()); toast.success("Đã cập nhật trạng thái mã."); await reload(root); }
async function deleteVoucher(root, voucher) { if (!confirm(`Xóa mã ${voucher.code}?`)) return; await voucherService.remove(voucher.id, silent()); toast.success("Đã xóa mã giảm giá."); await reload(root); }
function closeModal(overlay) { overlay.classList.remove("is-open"); setTimeout(() => { overlay.remove(); if (!document.querySelector(".admin-voucher-modal")) document.body.classList.remove("modal-open"); }, 150); }
function message(error) { if (error?.status === 401) return "Phiên đăng nhập hết hạn."; if (error?.status === 403) return "Không có quyền quản lý mã giảm giá."; if (error?.status === 404) return "Không tìm thấy mã giảm giá."; if (error?.status === 422) return "Dữ liệu mã giảm giá không hợp lệ."; return error?.message || "Không thể xử lý yêu cầu."; }
function formatCurrency(value) { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value || 0)); }
function formatDate(value) { if (!value) return "-"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("vi-VN"); }
function toInputDate(value) { if (!value) return ""; const date = new Date(value); if (Number.isNaN(date.getTime())) return ""; return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function silent() { return { showErrorToast: false }; }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }

