import { customerApi } from "../../assets/js/customer-auth.js?v=20260717-cloudflare-pages";

const STORAGE_KEY = "nl-store-chatbot-history";
const CONVERSATION_KEY = "nl-store-chatbot-conversation-id";
const AVATAR_URL = "./assets/images/chatbotai.png";
const MAX_MESSAGES = 30;
const WELCOME_MESSAGE = "Xin chào! Tôi là trợ lý của N&L Store. Tôi có thể giúp bạn tìm sản phẩm, tư vấn kích thước, kiểm tra đơn hàng và giải đáp chính sách của cửa hàng. Bạn cần hỗ trợ gì ạ?";
const DEFAULT_SUGGESTIONS = ["Tìm sản phẩm", "Tư vấn kích thước", "Sản phẩm đang bán", "Phí vận chuyển", "Chính sách đổi trả", "Kiểm tra đơn hàng"];

let chatbotState = {
  root: null,
  messages: [],
  isSending: false,
  conversationId: ""
};

export function initCustomerChatbot() {
  if (document.querySelector("[data-nl-chatbot]")) return;

  chatbotState.conversationId = getConversationId();
  chatbotState.messages = loadMessages();
  if (!chatbotState.messages.length) {
    chatbotState.messages = [createMessage("bot", WELCOME_MESSAGE)];
    persistMessages();
  }

  document.body.insertAdjacentHTML("beforeend", createChatbotHtml());
  chatbotState.root = document.querySelector("[data-nl-chatbot]");
  bindChatbotEvents();
  renderMessages();
  renderSuggestions(DEFAULT_SUGGESTIONS);
}

function createChatbotHtml() {
  return `
    <section class="nl-chatbot" data-nl-chatbot>
      <div class="nl-chatbot-panel" role="dialog" aria-modal="false" aria-label="Trợ lý N&L Store">
        <header class="nl-chatbot-header">
          <div class="nl-chatbot-avatar">${avatarImage()}</div>
          <div class="nl-chatbot-title"><strong>Trợ lý N&amp;L Store</strong><span>Đang hoạt động</span></div>
          <button class="nl-chatbot-close" type="button" data-chatbot-close aria-label="Đóng chatbot"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </header>
        <div class="nl-chatbot-messages" data-chatbot-messages aria-live="polite"></div>
        <div>
          <div class="nl-chatbot-suggestions" data-chatbot-suggestions></div>
          <form class="nl-chatbot-form" data-chatbot-form>
            <textarea class="nl-chatbot-input" data-chatbot-input maxlength="1000" rows="1" placeholder="Nhập câu hỏi của bạn..." aria-label="Nội dung tin nhắn"></textarea>
            <button class="nl-chatbot-send" type="submit" data-chatbot-send aria-label="Gửi tin nhắn"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i></button>
            <button class="nl-chatbot-clear" type="button" data-chatbot-clear aria-label="Xóa cuộc trò chuyện">Xóa cuộc trò chuyện</button>
          </form>
        </div>
      </div>
      <button class="nl-chatbot-toggle" type="button" data-chatbot-toggle aria-label="Mở chatbot N&L Store">${avatarImage()}</button>
    </section>
  `;
}

function bindChatbotEvents() {
  const root = chatbotState.root;
  const form = root.querySelector("[data-chatbot-form]");
  const input = root.querySelector("[data-chatbot-input]");

  root.querySelector("[data-chatbot-toggle]")?.addEventListener("click", () => {
    root.classList.toggle("is-open");
    if (root.classList.contains("is-open")) {
      input?.focus();
      scrollToBottom();
    }
  });

  root.querySelector("[data-chatbot-close]")?.addEventListener("click", () => root.classList.remove("is-open"));
  root.querySelector("[data-chatbot-clear]")?.addEventListener("click", clearConversation);
  root.querySelector("[data-chatbot-suggestions]")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-chatbot-suggestion]");
    if (button) sendMessage(button.dataset.chatbotSuggestion || button.textContent || "");
  });

  input?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    form?.requestSubmit();
  });

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(input?.value || "");
  });
}

async function sendMessage(value) {
  const input = chatbotState.root.querySelector("[data-chatbot-input]");
  const text = sanitizeText(value);

  if (!text || chatbotState.isSending) return;

  chatbotState.messages.push(createMessage("user", text));
  trimMessages();
  if (input) input.value = "";
  setSending(true);
  renderMessages({ typing: true });
  persistMessages();

  try {
    const response = await customerApi("/chatbot/message", {
      method: "POST",
      auth: true,
      refreshOnUnauthorized: false,
      body: { message: text, conversationId: chatbotState.conversationId }
    });
    const data = response?.data || {};
    chatbotState.messages.push(createMessage("bot", data.reply || "Tôi đã nhận tin nhắn của bạn.", {
      products: Array.isArray(data.products) ? data.products : [],
      orders: Array.isArray(data.orders) ? data.orders : []
    }));
    renderSuggestions(Array.isArray(data.suggestions) && data.suggestions.length ? data.suggestions : DEFAULT_SUGGESTIONS);
  } catch (error) {
    chatbotState.messages.push(createMessage("bot", getChatbotErrorMessage(error)));
  } finally {
    trimMessages();
    setSending(false);
    renderMessages();
    persistMessages();
  }
}

function renderMessages(options = {}) {
  const target = chatbotState.root?.querySelector("[data-chatbot-messages]");
  if (!target) return;
  target.innerHTML = chatbotState.messages.map(renderMessage).join("") + (options.typing ? renderTypingMessage() : "");
  scrollToBottom();
}

function renderMessage(message) {
  const isUser = message.sender === "user";
  return `
    <article class="nl-chatbot-message ${isUser ? "is-user" : "is-bot"}">
      ${isUser ? "" : `<div class="nl-chatbot-message-avatar">${avatarImage()}</div>`}
      <div class="nl-chatbot-bubble">
        <div class="nl-chatbot-text">${escapeHtml(message.text)}</div>
        ${renderProducts(message.products)}
        ${renderOrders(message.orders)}
        <div class="nl-chatbot-time">${escapeHtml(formatTime(message.createdAt))}</div>
      </div>
    </article>
  `;
}

function renderProducts(products = []) {
  if (!Array.isArray(products) || !products.length) return "";
  return `<div class="nl-chatbot-products">${products.slice(0, 5).map((product) => {
    const price = Number(product.finalPrice || product.salePrice || product.price || 0);
    return `
      <div class="nl-chatbot-product">
        <img src="${escapeAttribute(resolveImageUrl(product.thumbnailUrl))}" alt="${escapeAttribute(product.name || "Sản phẩm")}">
        <div>
          <strong>${escapeHtml(product.name || "Sản phẩm")}</strong>
          <span>${escapeHtml(formatCurrency(price))} · ${Number(product.stock || 0) > 0 ? "Còn hàng" : "Hết hàng"}</span>
          <a href="#product-detail/${encodeURIComponent(product.id)}">Xem sản phẩm</a>
        </div>
      </div>
    `;
  }).join("")}</div>`;
}

function renderOrders(orders = []) {
  if (!Array.isArray(orders) || !orders.length) return "";
  return `<div class="nl-chatbot-orders">${orders.slice(0, 5).map((order) => `
    <div class="nl-chatbot-order">
      <div class="nl-chatbot-fallback"><i class="fa-solid fa-receipt" aria-hidden="true"></i></div>
      <div>
        <strong>${escapeHtml(order.orderCode || `Đơn #${order.id}`)}</strong>
        <span>${escapeHtml(getOrderStatusLabel(order.status))} · ${escapeHtml(formatCurrency(order.grandTotal || 0))}</span>
        <a href="#orders">Xem đơn hàng</a>
      </div>
    </div>
  `).join("")}</div>`;
}

function renderTypingMessage() {
  return `<article class="nl-chatbot-message is-bot"><div class="nl-chatbot-message-avatar">${avatarImage()}</div><div class="nl-chatbot-bubble"><span class="nl-chatbot-typing" aria-label="Chatbot đang xử lý"><span></span><span></span><span></span></span></div></article>`;
}

function renderSuggestions(suggestions = DEFAULT_SUGGESTIONS) {
  const target = chatbotState.root?.querySelector("[data-chatbot-suggestions]");
  if (!target) return;
  target.innerHTML = suggestions.slice(0, 6).map((label) => `<button class="nl-chatbot-suggestion" type="button" data-chatbot-suggestion="${escapeAttribute(label)}">${escapeHtml(label)}</button>`).join("");
}

function clearConversation() {
  chatbotState.messages = [createMessage("bot", WELCOME_MESSAGE)];
  localStorage.removeItem(STORAGE_KEY);
  renderMessages();
  renderSuggestions(DEFAULT_SUGGESTIONS);
  persistMessages();
}

function createMessage(sender, text, extra = {}) {
  return { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, sender, text, products: extra.products || [], orders: extra.orders || [], createdAt: new Date().toISOString() };
}

function loadMessages() {
  try {
    const messages = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(messages) ? messages.slice(-MAX_MESSAGES) : [];
  } catch {
    return [];
  }
}

function persistMessages() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chatbotState.messages.slice(-MAX_MESSAGES)));
}

function trimMessages() {
  chatbotState.messages = chatbotState.messages.slice(-MAX_MESSAGES);
}

function setSending(value) {
  chatbotState.isSending = Boolean(value);
  const button = chatbotState.root?.querySelector("[data-chatbot-send]");
  const input = chatbotState.root?.querySelector("[data-chatbot-input]");
  if (button) button.disabled = chatbotState.isSending;
  if (input) input.disabled = chatbotState.isSending;
}

function getConversationId() {
  let id = localStorage.getItem(CONVERSATION_KEY);
  if (!id) {
    id = `nl-chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(CONVERSATION_KEY, id);
  }
  return id;
}

function avatarImage() {
  return `<img src="${AVATAR_URL}" alt="Trợ lý N&L Store" onerror="this.replaceWith(window.createChatbotFallbackIcon())">`;
}

function createFallbackIcon() {
  const fallback = document.createElement("span");
  fallback.className = "nl-chatbot-fallback";
  fallback.innerHTML = '<i class="fa-solid fa-comments" aria-hidden="true"></i>';
  return fallback;
}

function scrollToBottom() {
  window.requestAnimationFrame(() => {
    const target = chatbotState.root?.querySelector("[data-chatbot-messages]");
    if (target) target.scrollTop = target.scrollHeight;
  });
}

function sanitizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 1000);
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function formatCurrency(value) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function resolveImageUrl(url) {
  return globalThis.normalizeImageUrl?.(url) || url || "https://placehold.co/104x128/f1f5f9/334155?text=N%26L";
}

function getOrderStatusLabel(status = "") {
  const labels = { pending: "Đang chờ xác nhận", confirmed: "Đã xác nhận", processing: "Đang chuẩn bị", shipped: "Đang giao hàng", delivered: "Đã giao hàng", cancelled: "Đã hủy", refunded: "Đã hoàn tiền" };
  return labels[String(status).toLowerCase()] || status || "Đang xử lý";
}

function getChatbotErrorMessage(error) {
  if (error?.status === 422) return "Bạn vui lòng nhập nội dung hợp lệ, tối đa 1.000 ký tự.";
  if (error?.status === 429) return "Bạn gửi tin nhắn hơi nhanh. Vui lòng thử lại sau ít phút.";
  return "Xin lỗi, hệ thống đang tạm thời gặp sự cố. Bạn vui lòng thử lại sau ít phút.";
}

window.createChatbotFallbackIcon = createFallbackIcon;
