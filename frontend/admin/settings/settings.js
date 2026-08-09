import { notifyError, notifySuccess } from "../../assets/js/notify.js";
import { applyTheme, getStoredThemeMode } from "../components/theme/theme-manager.js";
import { userService } from "../services/user.service.js";
import { loadTemplate } from "../router/template-cache.js";

const NOTIFICATION_STORAGE_KEY = "fashion-admin-notification-preferences";

const DEFAULT_NOTIFICATIONS = Object.freeze({
  newOrders: true,
  payments: true,
  lowStock: true,
  system: true
});

let activeSectionKey = "general";
let notificationDraft = {};
let notificationInitial = {};

export async function createSettingsPage() {
  const templateUrl = new URL("./index.html", import.meta.url);
  return loadTemplate(templateUrl);
}

export function initSettingsPage(root = document) {
  notificationDraft = loadNotificationPreferences();
  notificationInitial = { ...notificationDraft };
  renderSettingsTabs(root);
  renderActiveSection(root);
  bindSettingsEvents(root);
}

function bindSettingsEvents(root) {
  root.querySelector("[data-settings-tabs]")?.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-settings-tab]");
    if (!tab) return;
    activeSectionKey = tab.dataset.settingsTab;
    renderSettingsTabs(root);
    renderActiveSection(root);
  });

  root.addEventListener("change", (event) => {
    const themeInput = event.target.closest("[data-theme-mode]");
    if (themeInput) {
      applyTheme(themeInput.value);
      renderActiveSection(root);
      notifySuccess("Đã cập nhật giao diện.");
      return;
    }

    const notificationInput = event.target.closest("[data-notification-pref]");
    if (notificationInput) {
      notificationDraft[notificationInput.name] = notificationInput.checked;
      updateNotificationActions(root);
    }
  });

  root.addEventListener("click", (event) => {
    const passwordToggle = event.target.closest("[data-password-toggle]");
    if (passwordToggle) {
      togglePasswordVisibility(passwordToggle);
      return;
    }

    if (event.target.closest("[data-settings-save-notifications]")) {
      saveNotificationPreferences(root);
    }

    if (event.target.closest("[data-settings-reset-notifications]")) {
      resetNotificationPreferences(root);
    }
  });

  root.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-settings-password-form]");
    if (!form) return;
    event.preventDefault();
    await submitPasswordChange(root, form);
  });
}

function renderSettingsTabs(root) {
  const sections = [
    { key: "general", label: "Chung", icon: "fa-sliders" },
    { key: "appearance", label: "Giao diện", icon: "fa-palette" },
    { key: "notifications", label: "Thông báo", icon: "fa-bell" },
    { key: "security", label: "Bảo mật", icon: "fa-shield-halved" }
  ];
  const container = root.querySelector("[data-settings-tabs]");
  if (!container) return;

  container.innerHTML = sections.map((section) => `
    <button type="button" class="${section.key === activeSectionKey ? "is-active" : ""}" data-settings-tab="${section.key}">
      <i class="fa-solid ${section.icon}" aria-hidden="true"></i>
      <span>${section.label}</span>
    </button>
  `).join("");
}

function renderActiveSection(root) {
  const content = root.querySelector("[data-settings-panel]");
  if (!content) return;

  const renderers = {
    general: renderGeneralSection,
    appearance: renderAppearanceSection,
    notifications: renderNotificationsSection,
    security: renderSecuritySection
  };

  content.innerHTML = (renderers[activeSectionKey] || renderGeneralSection)();
  updateNotificationActions(root);
}

function renderGeneralSection() {
  const rows = [
    ["Tên hệ thống", "N&L Store Admin"],
    ["Tên cửa hàng", "N&L Store"],
    ["Ngôn ngữ", "Tiếng Việt"],
    ["Múi giờ", "Asia/Ho_Chi_Minh"],
    ["Định dạng tiền", "VND"]
  ];

  return `
    ${renderSectionHeader("Cài đặt chung", "Thông tin cơ bản của hệ thống quản trị.", "Chỉ hiển thị")}
    <div class="settings-info-list">
      ${rows.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("")}
    </div>
  `;
}

function renderAppearanceSection() {
  const mode = getStoredThemeMode();
  const options = [
    ["light", "Giao diện sáng", "Nền sáng, dễ đọc trong môi trường văn phòng.", "fa-sun"],
    ["dark", "Giao diện tối", "Giảm chói khi làm việc trong điều kiện thiếu sáng.", "fa-moon"],
    ["system", "Theo hệ thống", "Tự đồng bộ với chế độ hiển thị của thiết bị.", "fa-display"]
  ];

  return `
    ${renderSectionHeader("Giao diện", "Chọn chế độ hiển thị cho khu vực quản trị.", "Local preference")}
    <div class="settings-choice-grid" role="radiogroup" aria-label="Chế độ giao diện">
      ${options.map(([value, label, description, icon]) => `
        <label class="settings-choice ${mode === value ? "is-active" : ""}">
          <input type="radio" name="themeMode" value="${value}" data-theme-mode ${mode === value ? "checked" : ""}>
          <i class="fa-solid ${icon}" aria-hidden="true"></i>
          <span><strong>${label}</strong><small>${description}</small></span>
        </label>
      `).join("")}
    </div>
  `;
}

function renderNotificationsSection() {
  const options = [
    ["newOrders", "Thông báo đơn hàng mới", "Nhận cảnh báo khi có đơn hàng mới."],
    ["payments", "Thông báo thanh toán", "Nhận cảnh báo khi thanh toán thay đổi."],
    ["lowStock", "Tồn kho thấp", "Nhận cảnh báo khi sản phẩm sắp hết."],
    ["system", "Thông báo hệ thống", "Nhận cập nhật quan trọng trong trang quản trị."]
  ];

  return `
    ${renderSectionHeader("Thông báo", "Tùy chọn cảnh báo hiển thị trong khu vực quản trị.", "Local preference")}
    <div class="settings-switch-list">
      ${options.map(([name, label, description]) => `
        <label class="settings-toggle">
          <span><strong>${label}</strong><small>${description}</small></span>
          <input type="checkbox" name="${name}" data-notification-pref ${notificationDraft[name] ? "checked" : ""}>
          <i aria-hidden="true"></i>
        </label>
      `).join("")}
    </div>
    <div class="settings-actions">
      <button class="settings-secondary-button" type="button" data-settings-reset-notifications>Khôi phục</button>
      <button class="settings-save-button" type="button" data-settings-save-notifications>
        <i class="fa-regular fa-floppy-disk" aria-hidden="true"></i>
        <span>Lưu thay đổi</span>
      </button>
    </div>
  `;
}

function renderSecuritySection() {
  return `
    ${renderSectionHeader("Bảo mật", "Cập nhật mật khẩu đăng nhập cho tài khoản quản trị.", "Backend")}
    <form class="settings-password-form" data-settings-password-form>
      ${renderPasswordField("Mật khẩu hiện tại", "current_password", "current-password")}
      ${renderPasswordField("Mật khẩu mới", "newPassword", "new-password")}
      ${renderPasswordField("Xác nhận mật khẩu mới", "confirmPassword", "new-password")}
      <div class="settings-form-message" data-settings-password-message></div>
      <div class="settings-actions">
        <button class="settings-save-button" type="submit" data-settings-password-submit>
          <i class="fa-solid fa-key" aria-hidden="true"></i>
          <span>Đổi mật khẩu</span>
        </button>
      </div>
    </form>
  `;
}

function renderSectionHeader(title, description, pill) {
  return `
    <div class="settings-content-header">
      <div>
        <p>${title}</p>
        <h2>${description}</h2>
      </div>
      <span class="settings-pill">${pill}</span>
    </div>
  `;
}

function renderPasswordField(label, name, autocomplete) {
  return `
    <label>
      <span>${label}</span>
      <span class="settings-password-control">
        <input type="password" name="${name}" autocomplete="${autocomplete}" minlength="8" required>
        <button type="button" aria-label="Hiện mật khẩu" data-password-toggle>
          <i class="fa-regular fa-eye" aria-hidden="true"></i>
        </button>
      </span>
    </label>
  `;
}

function saveNotificationPreferences(root) {
  localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(notificationDraft));
  notificationInitial = { ...notificationDraft };
  updateNotificationActions(root);
  notifySuccess("Đã lưu cài đặt.");
}

function resetNotificationPreferences(root) {
  if (!window.confirm("Khôi phục mặc định cho tùy chọn thông báo?")) return;
  notificationDraft = { ...DEFAULT_NOTIFICATIONS };
  notificationInitial = { ...notificationDraft };
  localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(notificationDraft));
  renderActiveSection(root);
  notifySuccess("Đã khôi phục cài đặt thông báo.");
}

async function submitPasswordChange(root, form) {
  const message = root.querySelector("[data-settings-password-message]");
  const button = root.querySelector("[data-settings-password-submit]");
  const payload = {
    current_password: form.elements.current_password.value,
    newPassword: form.elements.newPassword.value,
    confirmPassword: form.elements.confirmPassword.value
  };

  if (!payload.current_password || !payload.newPassword || !payload.confirmPassword) {
    showPasswordMessage(message, "Vui lòng nhập đầy đủ thông tin.", true);
    return;
  }

  if (payload.newPassword !== payload.confirmPassword) {
    showPasswordMessage(message, "Xác nhận mật khẩu mới không khớp.", true);
    return;
  }

  button.disabled = true;
  button.querySelector("span").textContent = "Đang lưu";
  showPasswordMessage(message, "", false);

  try {
    await userService.changePassword(payload);
    form.reset();
    showPasswordMessage(message, "Đã đổi mật khẩu.", false);
    notifySuccess("Đã đổi mật khẩu.");
  } catch (error) {
    const text = error?.status === 403
      ? "Mật khẩu hiện tại không đúng."
      : "Không thể đổi mật khẩu. Vui lòng thử lại.";
    showPasswordMessage(message, text, true);
    notifyError(text);
  } finally {
    button.disabled = false;
    button.querySelector("span").textContent = "Đổi mật khẩu";
  }
}

function togglePasswordVisibility(button) {
  const input = button.closest(".settings-password-control")?.querySelector("input");
  const icon = button.querySelector("i");
  if (!input || !icon) return;

  const visible = input.type === "text";
  input.type = visible ? "password" : "text";
  button.setAttribute("aria-label", visible ? "Hiện mật khẩu" : "Ẩn mật khẩu");
  icon.className = `fa-regular ${visible ? "fa-eye" : "fa-eye-slash"}`;
}

function updateNotificationActions(root) {
  const saveButton = root.querySelector("[data-settings-save-notifications]");
  const resetButton = root.querySelector("[data-settings-reset-notifications]");
  const changed = JSON.stringify(notificationDraft) !== JSON.stringify(notificationInitial);
  if (saveButton) saveButton.disabled = !changed;
  if (resetButton) resetButton.disabled = JSON.stringify(notificationDraft) === JSON.stringify(DEFAULT_NOTIFICATIONS);
}

function showPasswordMessage(element, text, isError) {
  if (!element) return;
  element.textContent = text;
  element.classList.toggle("is-error", Boolean(isError));
}

function loadNotificationPreferences() {
  try {
    return {
      ...DEFAULT_NOTIFICATIONS,
      ...JSON.parse(localStorage.getItem(NOTIFICATION_STORAGE_KEY) || "{}")
    };
  } catch {
    return { ...DEFAULT_NOTIFICATIONS };
  }
}
