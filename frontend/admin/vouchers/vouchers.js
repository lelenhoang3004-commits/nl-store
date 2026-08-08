import { hidePageLoading, showPageLoading } from "../components/loading/loading.js";
import { notifyError, notifySuccess } from "../../assets/js/notify.js";
import { loadTemplate } from "../router/template-cache.js";
import { voucherService } from "../services/voucher.service.js";

const DEFAULT_QUERY = Object.freeze({ page: 1, limit: 10, sortBy: "createdAt", sortOrder: "desc" });
let state = { vouchers: [], pagination: null, query: { ...DEFAULT_QUERY }, busy: false, error: null };
let filterTimer = null;

export async function createVouchersPage() {
  showPageLoading("Äang táº£i mÃ£ giáº£m giÃ¡...");
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
    if (action.dataset.voucherAction === "edit") await openVoucherModal(root, voucher);
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
  } catch (error) { state.vouchers = []; state.error = error; notifyError(message(error)); }
  finally { state.busy = false; renderTable(root); renderPagination(root); }
}

function normalizeVoucher(voucher = {}) {
  const discountType = normalizeDiscountType(voucher.discountType ?? voucher.discount_type);
  return {
    id: voucher.id,
    code: voucher.code || "",
    name: voucher.name || "",
    description: voucher.description || "",
    discountType,
    discountValue: Number(voucher.discountValue ?? voucher.discount_value ?? 0),
    minOrderAmount: Number(voucher.minOrderAmount ?? voucher.min_order_amount ?? 0),
    maxDiscountAmount: voucher.maxDiscountAmount ?? voucher.max_discount_amount ?? null,
    quantity: voucher.quantity ?? voucher.usageLimit ?? voucher.usage_limit ?? null,
    usedQuantity: Number(voucher.usedQuantity ?? voucher.used_quantity ?? voucher.usedCount ?? voucher.used_count ?? 0),
    startsAt: voucher.startsAt ?? voucher.starts_at ?? voucher.startDate ?? voucher.start_date ?? null,
    expiresAt: voucher.expiresAt ?? voucher.expires_at ?? voucher.endDate ?? voucher.end_date ?? null,
    status: voucher.status || "inactive",
    conditions: voucher.conditions ?? null
  };
}

function renderTable(root) {
  const body = root.querySelector("[data-vouchers-body]");
  if (!body) return;
  if (state.busy) { body.innerHTML = `<tr><td colspan="11" class="admin-voucher-empty">Äang táº£i mÃ£ giáº£m giÃ¡...</td></tr>`; return; }
  if (state.error) { body.innerHTML = `<tr><td colspan="11"><div class="admin-voucher-error"><span>${escapeHtml(message(state.error))}</span><button type="button" data-voucher-refresh>Thá»­ láº¡i</button></div></td></tr>`; return; }
  body.innerHTML = state.vouchers.length ? state.vouchers.map(renderRow).join("") : `<tr><td colspan="11" class="admin-voucher-empty">ChÆ°a cÃ³ mÃ£ giáº£m giÃ¡ nÃ o.</td></tr>`;
}

function renderRow(voucher) {
  const displayStatus = getDisplayStatus(voucher);
  return `<tr>
    <td class="admin-voucher-id">#${escapeHtml(voucher.id)}</td><td><strong class="admin-voucher-code" title="${escapeHtml(voucher.code)}">${escapeHtml(voucher.code)}</strong></td><td class="admin-voucher-name" title="${escapeHtml(voucher.name)}">${escapeHtml(voucher.name)}</td>
    <td class="admin-voucher-type">${voucher.discountType === "percentage" ? "Ph\u1ea7n tr\u0103m" : "Ti\u1ec1n c\u1ed1 \u0111\u1ecbnh"}</td><td class="admin-voucher-value">${voucher.discountType === "percentage" ? `${escapeHtml(voucher.discountValue)}%` : formatCurrency(voucher.discountValue)}</td>
    <td class="admin-voucher-money">${formatCurrency(voucher.minOrderAmount)}</td><td class="admin-voucher-money">${voucher.maxDiscountAmount == null ? "-" : formatCurrency(voucher.maxDiscountAmount)}</td>
    <td>${usageCell(voucher)}</td><td class="admin-voucher-period" title="${escapeHtml(`${formatDate(voucher.startsAt)} -> ${formatDate(voucher.expiresAt)}`)}">${formatPeriod(voucher.startsAt, voucher.expiresAt)}</td>
    <td><span class="admin-voucher-status is-${escapeHtml(displayStatus.key)}">${escapeHtml(displayStatus.label)}</span></td>
    <td><div class="admin-voucher-actions"><button data-voucher-action="edit" data-voucher-id="${escapeHtml(voucher.id)}" title="S\u1eeda" aria-label="S\u1eeda m\u00e3 gi\u1ea3m gi\u00e1"><i class="fa-solid fa-pen"></i></button><button data-voucher-action="toggle" data-voucher-id="${escapeHtml(voucher.id)}" title="B\u1eadt/t\u1eaft" aria-label="B\u1eadt/t\u1eaft m\u00e3 gi\u1ea3m gi\u00e1"><i class="fa-solid ${voucher.status === "active" ? "fa-toggle-on" : "fa-toggle-off"}"></i></button><button class="is-danger" data-voucher-action="delete" data-voucher-id="${escapeHtml(voucher.id)}" title="X\u00f3a" aria-label="X\u00f3a m\u00e3 gi\u1ea3m gi\u00e1"><i class="fa-solid fa-trash"></i></button></div></td>
  </tr>`;
}

function renderPagination(root) {
  const target = root.querySelector("[data-vouchers-pagination]");
  if (!target || !state.pagination) { if (target) target.innerHTML = ""; return; }
  const { page, totalPages, totalItems, hasPreviousPage, hasNextPage } = state.pagination;
  target.innerHTML = `<span>${state.vouchers.length} / ${totalItems} mÃ£</span><div><button data-vouchers-page="${page - 1}" ${hasPreviousPage ? "" : "disabled"}>TrÆ°á»›c</button><strong>Trang ${page}/${totalPages || 1}</strong><button data-vouchers-page="${page + 1}" ${hasNextPage ? "" : "disabled"}>Sau</button></div>`;
}

function usageCell(voucher) {
  const total = voucher.quantity == null ? "\u221e" : String(voucher.quantity);
  const percent = voucher.quantity ? Math.min(100, Math.max(0, Number(voucher.usedQuantity || 0) / Number(voucher.quantity) * 100)) : 0;
  return `<div class="admin-voucher-usage"><span>${escapeHtml(voucher.usedQuantity)} / ${escapeHtml(total)}</span><i><b style="width:${percent}%"></b></i></div>`;
}
function formatPeriod(start, end) {
  const startText = formatShortDate(start);
  const endText = formatShortDate(end);
  return `<span>${escapeHtml(startText)}</span><small>${escapeHtml(endText)}</small>`;
}
function formatShortDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.toLocaleDateString("vi-VN")} ${date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
}
async function openVoucherModal(root, voucherSummary = null) {
  const editing = Boolean(voucherSummary?.id);
  let voucher = voucherSummary ? normalizeVoucher(voucherSummary) : createEmptyVoucher();
  if (editing) {
    try {
      const response = await voucherService.getById(voucherSummary.id, silent());
      voucher = normalizeVoucher(response.data?.voucher || voucherSummary);
    } catch (error) {
      notifyError(message(error));
      return;
    }
  }

  const overlay = document.createElement("div");
  overlay.className = "admin-voucher-modal";
  overlay.innerHTML = `<section class="admin-voucher-dialog"><header><div><p>Voucher</p><h2>${editing ? "Sá»­a mÃ£ giáº£m giÃ¡" : "ThÃªm mÃ£ giáº£m giÃ¡"}</h2></div><button type="button" data-modal-close aria-label="ÄÃ³ng">Ã—</button></header><div class="admin-voucher-modal-body">${formHtml(voucher, editing)}</div><footer><button type="button" data-modal-close>Há»§y</button><button class="is-primary" type="button" data-modal-save>${editing ? "LÆ°u thay Ä‘á»•i" : "Táº¡o mÃ£"}</button></footer></section>`;
  document.body.appendChild(overlay); document.body.classList.add("modal-open"); requestAnimationFrame(() => overlay.classList.add("is-open"));
  bindModalForm(overlay);
  overlay.addEventListener("click", async (event) => {
    if (event.target === overlay || event.target.closest("[data-modal-close]")) return closeModal(overlay);
    const saveButton = event.target.closest("[data-modal-save]");
    if (!saveButton) return;
    const form = overlay.querySelector("[data-voucher-form]");
    const errorTarget = overlay.querySelector("[data-voucher-form-error]");
    if (errorTarget) errorTarget.textContent = "";
    saveButton.disabled = true;
    try {
      const payload = readForm(form, voucher, editing);
      if (editing) await voucherService.patch(voucher.id, payload, silent());
      else await voucherService.create(payload, silent());
      notifySuccess(editing ? "ÄÃ£ cáº­p nháº­t mÃ£ giáº£m giÃ¡." : "ÄÃ£ thÃªm mÃ£ giáº£m giÃ¡.");
      form.reset();
      closeModal(overlay);
      await reload(root);
    } catch (error) {
      if (errorTarget) errorTarget.textContent = message(error);
      notifyError(message(error));
    } finally {
      saveButton.disabled = false;
    }
  });
}

function createEmptyVoucher() {
  return { code: "", name: "", description: "", discountType: "percentage", discountValue: "", minOrderAmount: 0, maxDiscountAmount: "", quantity: "", usedQuantity: 0, startsAt: "", expiresAt: "", status: "active", conditions: null };
}

function formHtml(voucher, editing) {
  const safeVoucher = voucher || createEmptyVoucher();
  return `<form class="admin-voucher-form" data-voucher-form>
    <label><span>MÃ£ giáº£m giÃ¡</span><input name="code" value="${escapeHtml(safeVoucher.code)}" required ${editing && safeVoucher.usedQuantity > 0 ? "readonly" : ""}></label>
    <label><span>TÃªn chÆ°Æ¡ng trÃ¬nh</span><input name="name" value="${escapeHtml(safeVoucher.name)}" required></label>
    <label><span>Loáº¡i giáº£m</span><select name="discountType" data-discount-type><option value="percentage" ${safeVoucher.discountType === "percentage" ? "selected" : ""}>percentage</option><option value="fixed_amount" ${safeVoucher.discountType === "fixed_amount" ? "selected" : ""}>fixed_amount</option></select></label>
    <label><span>GiÃ¡ trá»‹ giáº£m</span><input type="number" name="discountValue" value="${escapeHtml(safeVoucher.discountValue ?? "")}" min="1" step="1" required></label>
    <label><span>ÄÆ¡n hÃ ng tá»‘i thiá»ƒu</span><input type="number" name="minOrderAmount" value="${escapeHtml(safeVoucher.minOrderAmount ?? 0)}" min="0" step="1"></label>
    <label data-max-discount><span>Giáº£m tá»‘i Ä‘a</span><input type="number" name="maxDiscountAmount" value="${escapeHtml(safeVoucher.maxDiscountAmount ?? "")}" min="0" step="1"></label>
    <label><span>Tá»•ng lÆ°á»£t sá»­ dá»¥ng</span><input type="number" name="quantity" value="${escapeHtml(safeVoucher.quantity ?? "")}" min="1" step="1" required></label>
    ${editing ? `<label><span>ÄÃ£ sá»­ dá»¥ng</span><input name="usedQuantity" value="${escapeHtml(safeVoucher.usedQuantity)}" readonly></label>` : ""}
    <label><span>NgÃ y giá» báº¯t Ä‘áº§u</span><input type="datetime-local" name="startsAt" value="${toInputDate(safeVoucher.startsAt)}"></label>
    <label><span>NgÃ y giá» káº¿t thÃºc</span><input type="datetime-local" name="expiresAt" value="${toInputDate(safeVoucher.expiresAt)}"></label>
    <label><span>Tráº¡ng thÃ¡i</span><select name="status"><option value="active" ${safeVoucher.status === "active" ? "selected" : ""}>active</option><option value="inactive" ${safeVoucher.status === "inactive" ? "selected" : ""}>inactive</option></select></label>
    <label><span>Äiá»u kiá»‡n Ã¡p dá»¥ng</span><select name="conditionScope" data-condition-scope><option value="all">Táº¥t cáº£ sáº£n pháº©m</option><option value="json">JSON tÃ¹y chá»‰nh</option></select></label>
    <label class="is-full" data-conditions-json hidden><span>Äiá»u kiá»‡n JSON</span><textarea name="conditions" spellcheck="false">${escapeHtml(formatConditions(safeVoucher.conditions))}</textarea></label>
    <label class="is-full"><span>MÃ´ táº£</span><textarea name="description">${escapeHtml(safeVoucher.description || "")}</textarea></label>
    <div class="admin-voucher-form-error is-full" data-voucher-form-error></div>
  </form>`;
}

function bindModalForm(overlay) {
  const form = overlay.querySelector("[data-voucher-form]");
  const updateVisibility = () => {
    const type = normalizeDiscountType(form.discountType.value);
    const maxRow = form.querySelector("[data-max-discount]");
    if (maxRow) maxRow.hidden = type !== "percentage";
    const conditionsRow = form.querySelector("[data-conditions-json]");
    if (conditionsRow) conditionsRow.hidden = form.conditionScope.value !== "json";
  };
  form.discountType.addEventListener("change", updateVisibility);
  form.conditionScope.addEventListener("change", updateVisibility);
  if (formatConditions(form.conditions?.value || "")) form.conditionScope.value = "json";
  updateVisibility();
}

function readForm(form, currentVoucher, editing) {
  const data = new FormData(form);
  const discountType = normalizeDiscountType(data.get("discountType"));
  const payload = {
    code: String(data.get("code") || "").trim().toUpperCase(),
    name: String(data.get("name") || "").trim(),
    description: String(data.get("description") || "").trim(),
    discountType,
    discountValue: readInteger(data.get("discountValue"), "GiÃ¡ trá»‹ giáº£m"),
    minOrderAmount: readInteger(data.get("minOrderAmount") || 0, "ÄÆ¡n hÃ ng tá»‘i thiá»ƒu"),
    maxDiscountAmount: discountType === "percentage" && String(data.get("maxDiscountAmount") || "") !== "" ? readInteger(data.get("maxDiscountAmount"), "Giáº£m tá»‘i Ä‘a") : null,
    quantity: readInteger(data.get("quantity"), "Tá»•ng lÆ°á»£t sá»­ dá»¥ng"),
    startsAt: String(data.get("startsAt") || ""),
    expiresAt: String(data.get("expiresAt") || ""),
    status: String(data.get("status") || "active"),
    conditions: form.conditionScope.value === "json" ? String(data.get("conditions") || "").trim() || null : null
  };
  validatePayload(payload, currentVoucher, editing);
  return payload;
}

function validatePayload(payload, currentVoucher, editing) {
  if (!payload.code || /\s/.test(payload.code)) throw new Error("MÃ£ giáº£m giÃ¡ báº¯t buá»™c, khÃ´ng Ä‘Æ°á»£c cÃ³ khoáº£ng tráº¯ng.");
  if (!payload.name) throw new Error("TÃªn chÆ°Æ¡ng trÃ¬nh báº¯t buá»™c.");
  if (payload.discountType === "percentage" && (payload.discountValue < 1 || payload.discountValue > 100)) throw new Error("Pháº§n trÄƒm giáº£m pháº£i tá»« 1 Ä‘áº¿n 100.");
  if (payload.discountType === "fixed_amount" && payload.discountValue <= 0) throw new Error("GiÃ¡ trá»‹ tiá»n cá»‘ Ä‘á»‹nh pháº£i lá»›n hÆ¡n 0.");
  if (payload.minOrderAmount < 0 || (payload.maxDiscountAmount ?? 0) < 0) throw new Error("Sá»‘ tiá»n khÃ´ng Ä‘Æ°á»£c Ã¢m.");
  if (!Number.isInteger(payload.quantity) || payload.quantity <= 0) throw new Error("Tá»•ng lÆ°á»£t sá»­ dá»¥ng pháº£i lÃ  sá»‘ nguyÃªn lá»›n hÆ¡n 0.");
  if (editing && payload.quantity < Number(currentVoucher.usedQuantity || 0)) throw new Error("Tá»•ng lÆ°á»£t sá»­ dá»¥ng khÃ´ng Ä‘Æ°á»£c nhá» hÆ¡n sá»‘ lÆ°á»£t Ä‘Ã£ dÃ¹ng.");
  if (payload.startsAt && payload.expiresAt && new Date(payload.expiresAt) <= new Date(payload.startsAt)) throw new Error("NgÃ y káº¿t thÃºc pháº£i sau ngÃ y báº¯t Ä‘áº§u.");
  if (payload.conditions) JSON.parse(payload.conditions);
}

function readInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || Number.isNaN(number)) throw new Error(`${label} pháº£i lÃ  sá»‘ nguyÃªn VND há»£p lá»‡.`);
  return number;
}

async function toggleVoucher(root, voucher) {
  try {
    await voucherService.updateStatus(voucher.id, voucher.status === "active" ? "inactive" : "active", silent());
    notifySuccess("ÄÃ£ cáº­p nháº­t tráº¡ng thÃ¡i mÃ£.");
    await reload(root);
  } catch (error) {
    notifyError(message(error));
  }
}
async function deleteVoucher(root, voucher) {
  if (!confirm(`XÃ³a mÃ£ ${voucher.code}? Voucher Ä‘Ã£ sá»­ dá»¥ng sáº½ Ä‘Æ°á»£c chuyá»ƒn sang táº¡m khÃ³a.`)) return;
  try {
    const response = await voucherService.remove(voucher.id, silent());
    notifySuccess(response.data?.voucher?.deactivated ? "Voucher Ä‘Ã£ sá»­ dá»¥ng nÃªn Ä‘Ã£ Ä‘Æ°á»£c táº¡m khÃ³a." : "ÄÃ£ xÃ³a mÃ£ giáº£m giÃ¡.");
    await reload(root);
  } catch (error) {
    notifyError(message(error));
  }
}
function closeModal(overlay) { overlay.classList.remove("is-open"); setTimeout(() => { overlay.remove(); if (!document.querySelector(".admin-voucher-modal")) document.body.classList.remove("modal-open"); }, 150); }
function message(error) { if (error?.status === 401) return "PhiÃªn Ä‘Äƒng nháº­p háº¿t háº¡n."; if (error?.status === 403) return "KhÃ´ng cÃ³ quyá»n quáº£n lÃ½ mÃ£ giáº£m giÃ¡."; if (error?.status === 404) return "KhÃ´ng tÃ¬m tháº¥y mÃ£ giáº£m giÃ¡."; return error?.message || "KhÃ´ng thá»ƒ xá»­ lÃ½ yÃªu cáº§u."; }
function normalizeDiscountType(value) { return String(value || "").trim().toLowerCase() === "fixed" ? "fixed_amount" : String(value || "").trim().toLowerCase(); }
function getDisplayStatus(voucher) { const now = Date.now(); if (voucher.status !== "active") return { key: "inactive", label: "Táº¡m khÃ³a" }; if (voucher.startsAt && new Date(voucher.startsAt).getTime() > now) return { key: "scheduled", label: "ChÆ°a báº¯t Ä‘áº§u" }; if (voucher.expiresAt && new Date(voucher.expiresAt).getTime() < now) return { key: "expired", label: "Háº¿t háº¡n" }; if (voucher.quantity !== null && Number(voucher.usedQuantity || 0) >= Number(voucher.quantity)) return { key: "soldout", label: "Háº¿t lÆ°á»£t" }; return { key: "active", label: "Äang hoáº¡t Ä‘á»™ng" }; }
function formatConditions(value) { if (!value) return ""; if (typeof value === "string") { try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; } } return JSON.stringify(value, null, 2); }
function formatCurrency(value) { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value || 0)); }
function formatDate(value) { if (!value) return "-"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("vi-VN"); }
function toInputDate(value) { if (!value) return ""; const date = new Date(value); if (Number.isNaN(date.getTime())) return ""; return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function silent() { return { showErrorToast: false }; }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }

