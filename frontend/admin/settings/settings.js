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
  return loadTemplate(new URL("./index.html", import.meta.url));
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
    { key: "general", label: "Chung", description: "Cấu hình cơ bản", icon: "fa-sliders" },
    { key: "appearance", label: "Giao diện", description: "Hiển thị quản trị", icon: "fa-palette" },
    { key: "notifications", label: "Thông báo", description: "Cảnh báo hệ thống", icon: "fa-bell" },
    { key: "security", label: "Bảo mật", description: "Tài khoản & bảo mật", icon: "fa-shield-halved" }
  ];
  const container = root.querySelector("[data-settings-tabs]");
  if (!container) return;

  container.innerHTML = sections.map((section) => `
    <button type="button" class="settings-nav-item ${section.key === activeSectionKey ? "is-active" : ""}" data-settings-tab="${section.key}">
      <span class="settings-nav-icon"><i class="fa-solid ${section.icon}" aria-hidden="true"></i></span>
      <span class="settings-nav-copy"><strong>${section.label}</strong><small>${section.description}</small></span>
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
    ["Tên hệ thống", "N&L Store Admin", false],
    ["Tên cửa hàng", "N&L Store", false],
    ["Ngôn ngữ", "Tiếng Việt", true],
    ["Múi giờ", "Asia/Ho_Chi_Minh", true],
    ["Định dạng tiền", "VND", true]
  ];

  return `
    ${renderPageSectionIntro("Cài đặt chung", "Quản lý thông tin cơ bản của hệ thống quản trị.")}
    <section class="settings-section-card" aria-labelledby="settings-system-info-title">
      <div class="settings-section-card-header">
        <p>THÔNG TIN HỆ THỐNG</p>
        <h3 id="settings-system-info-title">Thông tin cơ bản của hệ thống quản trị.</h3>
      </div>
      <div class="settings-info-list">
        ${rows.map(([label, value, badge]) => `
          <div class="setting-row">
            <div class="setting-label">${label}</div>
            <div class="setting-value">${badge ? `<span class="settings-neutral-badge">${value}</span>` : value}</div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderAppearanceSection() {
  const mode = getStoredThemeMode();
  const options = [
    ["light", "Sáng", "Giao diện sáng cho môi trường văn phòng.", "fa-sun"],
    ["dark", "Tối", "Giảm chói khi làm việc thiếu sáng.", "fa-moon"],
    ["system", "Theo hệ thống", "Tự đồng bộ với thiết bị.", "fa-display"]
  ];

  return `
    ${renderPageSectionIntro("Giao diện", "Chọn chế độ hiển thị của trang quản trị.")}
    <section class="settings-section-card">
      <div class="settings-choice-grid" role="radiogroup" aria-label="Chế độ giao diện">
        ${options.map(([value, label, description, icon]) => `
          <label class="settings-choice ${mode === value ? "is-active" : ""}">
            <input type="radio" name="themeMode" value="${value}" data-theme-mode ${mode === value ? "checked" : ""}>
            <span class="settings-choice-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></span>
            <span class="settings-choice-copy"><strong>${label}</strong><small>${description}</small></span>
          </label>
        `).join("")}
      </div>
    </section>
  `;
}

function renderNotificationsSection() {
  const options = [
    ["newOrders", "Đơn hàng mới", "Thông báo khi hệ thống nhận đơn hàng mới."],
    ["payments", "Thanh toán", "Thông báo khi trạng thái thanh toán thay đổi."],
    ["lowStock", "Tồn kho thấp", "Cảnh báo khi sản phẩm gần hết hàng."],
    ["system", "Hệ thống", "Nhận cập nhật quan trọng trong trang quản trị."]
  ];

  return `
    ${renderPageSectionIntro("Thông báo", "Tùy chọn cảnh báo hiển thị trong khu vực quản trị.")}
    <section class="settings-section-card">
      <div class="settings-switch-list">
        ${options.map(([name, label, description]) => `
          <label class="settings-toggle setting-row">
            <span class="setting-copy"><strong>${label}</strong><small>${description}</small></span>
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
    </section>
  `;
}

function renderSecuritySection() {
  return `
    ${renderPageSectionIntro("Bảo mật", "Cập nhật mật khẩu đăng nhập cho tài khoản quản trị.")}
    <section class="settings-section-card">
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
    </section>
  `;
}

function renderPageSectionIntro(title, description) {
  return `
    <div class="settings-content-header">
      <div>
        <p>${title}</p>
        <h2>${description}</h2>
      </div>
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
  const buttonLabel = button?.querySelector("span");
  const payload = {
    current_password: String(form.elements.current_password.value || ""),
    newPassword: String(form.elements.newPassword.value || ""),
    confirmPassword: String(form.elements.confirmPassword.value || "")
  };

  if (!payload.current_password) {
    showPasswordMessage(message, "Vui lòng nhập mật khẩu hiện tại.", true);
    return;
  }

  if (!payload.newPassword) {
    showPasswordMessage(message, "Vui lòng nhập mật khẩu mới.", true);
    return;
  }

  if (!payload.confirmPassword) {
    showPasswordMessage(message, "Vui lòng xác nhận mật khẩu mới.", true);
    return;
  }

  if (payload.newPassword === payload.current_password) {
    showPasswordMessage(message, "Mật khẩu mới phải khác mật khẩu hiện tại.", true);
    return;
  }

  if (payload.newPassword !== payload.confirmPassword) {
    showPasswordMessage(message, "Xác nhận mật khẩu mới không khớp.", true);
    return;
  }

  if (!isStrongSettingsPassword(payload.newPassword)) {
    showPasswordMessage(message, "Mật khẩu mới cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.", true);
    return;
  }

  button.disabled = true;
  if (buttonLabel) buttonLabel.textContent = "Đang xử lý...";
  showPasswordMessage(message, "", false);

  try {
    await userService.changePassword(payload);
    form.reset();
    showPasswordMessage(message, "Đổi mật khẩu thành công.", false);
    notifySuccess("Đổi mật khẩu thành công.");
  } catch (error) {
    const text = getPasswordChangeErrorMessage(error);
    showPasswordMessage(message, text, true);
    notifyError(text);
  } finally {
    button.disabled = false;
    if (buttonLabel) buttonLabel.textContent = "Đổi mật khẩu";
  }
}

function isStrongSettingsPassword(password) {
  return /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^\dA-Za-z]).{8,}$/.test(password);
}

function getPasswordChangeErrorMessage(error) {
  if (error?.code === "CURRENT_PASSWORD_INVALID" || error?.status === 401) {
    return "Mật khẩu hiện tại không chính xác.";
  }
  if (error?.code === "PASSWORD_REUSED" || error?.status === 409) {
    return "Mật khẩu mới phải khác mật khẩu hiện tại.";
  }
  if (error?.code === "PASSWORD_CONFIRMATION_MISMATCH") {
    return "Xác nhận mật khẩu mới không khớp.";
  }
  if (error?.code === "PASSWORD_POLICY_INVALID" || error?.code === "PASSWORD_TOO_SHORT") {
    return error.message || "Mật khẩu mới không hợp lệ.";
  }
  return "Không thể đổi mật khẩu. Vui lòng thử lại.";
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
