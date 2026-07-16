import { hidePageLoading, showPageLoading } from "../components/loading/loading.js";
import { toast } from "../components/toast/toast.js";
import { loadTemplate } from "../router/template-cache.js";
import { newsletterService } from "../services/newsletter.service.js";

const DEFAULT_QUERY = Object.freeze({ page: 1, limit: 10, sortBy: "createdAt", sortOrder: "desc" });
let state = { subscribers: [], pagination: null, query: { ...DEFAULT_QUERY }, busy: false, error: null };
let filterTimer = null;

export async function createNewsletterPage() {
  showPageLoading("Đang tải đăng ký email...");
  try { return await loadTemplate(new URL("./index.html", import.meta.url)); }
  finally { hidePageLoading(); }
}

export async function initNewsletterPage(root = document) {
  bindEvents(root);
  await reload(root);
  return () => window.clearTimeout(filterTimer);
}

function bindEvents(root) {
  root.querySelector("[data-newsletter-filters]")?.addEventListener("input", () => scheduleFilter(root));
  root.querySelector("[data-newsletter-filters]")?.addEventListener("change", () => applyFilters(root));
  root.addEventListener("click", async (event) => {
    if (event.target.closest("[data-newsletter-refresh]")) { await reload(root); return; }
    const pageButton = event.target.closest("[data-newsletter-page]");
    if (pageButton) { state.query = { ...state.query, page: Number(pageButton.dataset.newsletterPage) || 1 }; await reload(root); return; }
    const action = event.target.closest("[data-newsletter-action]");
    if (!action) return;
    const subscriber = state.subscribers.find((item) => String(item.id) === String(action.dataset.newsletterId));
    if (!subscriber) return;
    if (action.dataset.newsletterAction === "view") showDetails(subscriber);
    if (action.dataset.newsletterAction === "toggle") await toggleStatus(root, subscriber);
    if (action.dataset.newsletterAction === "delete") await deleteSubscriber(root, subscriber);
  });
}

function scheduleFilter(root) { window.clearTimeout(filterTimer); filterTimer = window.setTimeout(() => applyFilters(root), 250); }
async function applyFilters(root) {
  const data = new FormData(root.querySelector("[data-newsletter-filters]"));
  state.query = { ...state.query, search: String(data.get("search") || "").trim(), status: String(data.get("status") || ""), page: 1 };
  await reload(root);
}

async function reload(root) {
  state.busy = true; renderTable(root);
  try {
    const response = await newsletterService.getAll(state.query, silent());
    state.subscribers = (response.data?.subscribers || []).map(normalizeSubscriber);
    state.pagination = response.meta?.pagination || null;
    state.error = null;
  } catch (error) {
    state.subscribers = [];
    state.error = error;
    toast.error(message(error));
  } finally {
    state.busy = false;
    renderTable(root);
    renderPagination(root);
  }
}

function normalizeSubscriber(subscriber = {}) {
  return {
    id: subscriber.id,
    email: subscriber.email || "",
    fullName: subscriber.fullName ?? subscriber.full_name ?? "",
    source: subscriber.source || "website",
    status: subscriber.status || "subscribed",
    subscribedAt: subscriber.subscribedAt ?? subscriber.subscribed_at ?? null,
    unsubscribedAt: subscriber.unsubscribedAt ?? subscriber.unsubscribed_at ?? null,
    createdAt: subscriber.createdAt ?? subscriber.created_at ?? null
  };
}

function renderTable(root) {
  const body = root.querySelector("[data-newsletter-body]");
  if (!body) return;
  if (state.busy) { body.innerHTML = `<tr><td colspan="8" class="admin-newsletter-empty">Đang tải danh sách email...</td></tr>`; return; }
  if (state.error) { body.innerHTML = `<tr><td colspan="8"><div class="admin-newsletter-error"><span>${escapeHtml(message(state.error))}</span><button type="button" data-newsletter-refresh>Thử lại</button></div></td></tr>`; return; }
  body.innerHTML = state.subscribers.length ? state.subscribers.map(renderRow).join("") : `<tr><td colspan="8" class="admin-newsletter-empty">Chưa có email đăng ký nào.</td></tr>`;
}

function renderRow(subscriber) {
  return `<tr>
    <td>#${escapeHtml(subscriber.id)}</td>
    <td><strong>${escapeHtml(subscriber.email)}</strong></td>
    <td>${escapeHtml(subscriber.fullName || "—")}</td>
    <td>${escapeHtml(subscriber.source)}</td>
    <td><span class="admin-newsletter-status is-${escapeHtml(subscriber.status)}">${escapeHtml(subscriber.status)}</span></td>
    <td>${formatDate(subscriber.subscribedAt || subscriber.createdAt)}</td>
    <td>${formatDate(subscriber.unsubscribedAt)}</td>
    <td><div class="admin-newsletter-actions">
      <button type="button" data-newsletter-action="view" data-newsletter-id="${escapeHtml(subscriber.id)}" title="Xem chi tiết"><i class="fa-solid fa-eye"></i></button>
      <button type="button" data-newsletter-action="toggle" data-newsletter-id="${escapeHtml(subscriber.id)}" title="Chuyển trạng thái"><i class="fa-solid ${subscriber.status === "subscribed" ? "fa-toggle-on" : "fa-toggle-off"}"></i></button>
      <button class="is-danger" type="button" data-newsletter-action="delete" data-newsletter-id="${escapeHtml(subscriber.id)}" title="Xóa"><i class="fa-solid fa-trash"></i></button>
    </div></td>
  </tr>`;
}

function renderPagination(root) {
  const target = root.querySelector("[data-newsletter-pagination]");
  if (!target || !state.pagination) { if (target) target.innerHTML = ""; return; }
  const { page, totalPages, totalItems, hasPreviousPage, hasNextPage } = state.pagination;
  target.innerHTML = `<span>${state.subscribers.length} / ${totalItems} email</span><div><button data-newsletter-page="${page - 1}" ${hasPreviousPage ? "" : "disabled"}>Trước</button><strong>Trang ${page}/${totalPages || 1}</strong><button data-newsletter-page="${page + 1}" ${hasNextPage ? "" : "disabled"}>Sau</button></div>`;
}

function showDetails(subscriber) {
  alert(`Email: ${subscriber.email}\nHọ tên: ${subscriber.fullName || "—"}\nSource: ${subscriber.source}\nStatus: ${subscriber.status}\nNgày đăng ký: ${formatDate(subscriber.subscribedAt || subscriber.createdAt)}\nNgày hủy: ${formatDate(subscriber.unsubscribedAt)}`);
}

async function toggleStatus(root, subscriber) {
  const nextStatus = subscriber.status === "subscribed" ? "unsubscribed" : "subscribed";
  await newsletterService.updateStatus(subscriber.id, nextStatus, silent());
  toast.success("Đã cập nhật trạng thái đăng ký email.");
  await reload(root);
}

async function deleteSubscriber(root, subscriber) {
  if (!confirm(`Xóa email ${subscriber.email}?`)) return;
  await newsletterService.remove(subscriber.id, silent());
  toast.success("Đã xóa email đăng ký.");
  await reload(root);
}

function message(error) {
  if (error?.status === 401) return "Phiên đăng nhập hết hạn.";
  if (error?.status === 403) return "Không có quyền quản lý đăng ký email.";
  if (error?.status === 404) return "Không tìm thấy email đăng ký.";
  if (error?.status === 422) return "Email không hợp lệ.";
  if (error?.status >= 500) return "Lỗi hệ thống.";
  return error?.message || "Không thể xử lý yêu cầu.";
}
function formatDate(value) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN"); }
function silent() { return { showErrorToast: false }; }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
