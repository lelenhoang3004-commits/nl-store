import { toast } from "../components/toast/toast.js";
import { loadTemplate } from "../router/template-cache.js";

const SETTINGS_STORAGE_KEY = "fashion-admin-settings-draft";

const settingsSections = [
  {
    key: "general",
    label: "General",
    icon: "fa-sliders",
    description: "Thông tin hệ thống quản trị.",
    fields: [
      { name: "systemName", label: "Tên hệ thống", type: "text", value: "N&L Store Admin" },
      { name: "adminEmail", label: "Email quản trị", type: "email", value: "" },
      { name: "maintenance", label: "Maintenance Mode", type: "toggle", value: false },
      { name: "autoSave", label: "Tự động lưu bản nháp", type: "toggle", value: true }
    ]
  },
  {
    key: "store",
    label: "Store",
    icon: "fa-store",
    description: "Cấu hình cửa hàng thời trang.",
    fields: [
      { name: "storeName", label: "Tên cửa hàng", type: "text", value: "N&L Store" },
      { name: "hotline", label: "Hotline", type: "tel", value: "0900 123 456" },
      { name: "address", label: "Địa chỉ", type: "textarea", value: "12 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh" },
      { name: "orderPrefix", label: "Tiền tố đơn hàng", type: "text", value: "FS" }
    ]
  },
  {
    key: "email",
    label: "Email",
    icon: "fa-envelope",
    description: "Thiết lập email thông báo.",
    fields: [
      { name: "senderName", label: "Tên người gửi", type: "text", value: "N&L Store" },
      { name: "senderEmail", label: "Email gửi", type: "email", value: "noreply@fashionstore.local" },
      { name: "smtpHost", label: "SMTP Host", type: "text", value: "smtp.example.local" },
      { name: "emailEnabled", label: "Bật email hệ thống", type: "toggle", value: true }
    ]
  },
  {
    key: "security",
    label: "Security",
    icon: "fa-shield-halved",
    description: "Chính sách bảo mật quản trị.",
    fields: [
      { name: "twoFactor", label: "Bật 2FA", type: "toggle", value: false },
      { name: "sessionMinutes", label: "Session timeout (phút)", type: "number", value: 30 },
      { name: "passwordMinLength", label: "Độ dài mật khẩu tối thiểu", type: "number", value: 8 },
      { name: "loginRateLimit", label: "Giới hạn đăng nhập/phút", type: "number", value: 5 }
    ]
  },
  {
    key: "upload",
    label: "Upload",
    icon: "fa-cloud-arrow-up",
    description: "Quy tắc upload media.",
    fields: [
      { name: "maxImageSize", label: "Dung lượng ảnh tối đa (MB)", type: "number", value: 5 },
      { name: "maxVideoSize", label: "Dung lượng video tối đa (MB)", type: "number", value: 50 },
      { name: "webpConvert", label: "Tự chuyển WebP", type: "toggle", value: true },
      { name: "allowedTypes", label: "Định dạng cho phép", type: "text", value: "jpg,png,webp,pdf,mp4" }
    ]
  },
  {
    key: "seo",
    label: "SEO",
    icon: "fa-magnifying-glass-chart",
    description: "Cấu hình SEO mặc định.",
    fields: [
      { name: "metaTitle", label: "Meta title", type: "text", value: "N&L Store - Thời trang hiện đại" },
      { name: "metaDescription", label: "Meta description", type: "textarea", value: "Cửa hàng thời trang trực tuyến với trải nghiệm mua sắm hiện đại." },
      { name: "robots", label: "Robots", type: "select", value: "index,follow", options: ["index,follow", "noindex,nofollow"] },
      { name: "canonical", label: "Canonical URL", type: "url", value: "https://fashionstore.local" }
    ]
  },
  {
    key: "backup",
    label: "Backup",
    icon: "fa-database",
    description: "Lịch backup dữ liệu.",
    fields: [
      { name: "backupEnabled", label: "Bật backup tự động", type: "toggle", value: true },
      { name: "backupFrequency", label: "Tần suất", type: "select", value: "daily", options: ["hourly", "daily", "weekly"] },
      { name: "retentionDays", label: "Lưu trữ (ngày)", type: "number", value: 14 },
      { name: "backupLocation", label: "Vị trí backup", type: "text", value: "local/uploads/backups" }
    ]
  },
  {
    key: "theme",
    label: "Theme",
    icon: "fa-palette",
    description: "Tùy chọn giao diện.",
    fields: [
      { name: "themeMode", label: "Theme mode", type: "select", value: "system", options: ["light", "dark", "system"] },
      { name: "density", label: "Mật độ hiển thị", type: "select", value: "comfortable", options: ["compact", "comfortable", "spacious"] },
      { name: "animations", label: "Bật animation", type: "toggle", value: true },
      { name: "glassEffect", label: "Glassmorphism nhẹ", type: "toggle", value: true }
    ]
  },
  {
    key: "language",
    label: "Language",
    icon: "fa-language",
    description: "Ngôn ngữ hệ thống.",
    fields: [
      { name: "defaultLanguage", label: "Ngôn ngữ mặc định", type: "select", value: "vi", options: ["vi", "en"] },
      { name: "fallbackLanguage", label: "Fallback language", type: "select", value: "en", options: ["vi", "en"] },
      { name: "adminLanguage", label: "Admin language", type: "select", value: "vi", options: ["vi", "en"] },
      { name: "multilingualStore", label: "Store đa ngôn ngữ", type: "toggle", value: false }
    ]
  },
  {
    key: "currency",
    label: "Currency",
    icon: "fa-money-bill-wave",
    description: "Tiền tệ và định dạng giá.",
    fields: [
      { name: "defaultCurrency", label: "Tiền tệ mặc định", type: "select", value: "VND", options: ["VND", "USD", "EUR"] },
      { name: "currencyPosition", label: "Vị trí ký hiệu", type: "select", value: "after", options: ["before", "after"] },
      { name: "decimalDigits", label: "Số chữ số thập phân", type: "number", value: 0 },
      { name: "taxIncluded", label: "Giá đã gồm thuế", type: "toggle", value: true }
    ]
  },
  {
    key: "timezone",
    label: "Timezone",
    icon: "fa-clock",
    description: "Múi giờ và định dạng thời gian.",
    fields: [
      { name: "timezone", label: "Timezone", type: "select", value: "Asia/Ho_Chi_Minh", options: ["Asia/Ho_Chi_Minh", "UTC", "America/New_York"] },
      { name: "dateFormat", label: "Định dạng ngày", type: "select", value: "dd/MM/yyyy", options: ["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"] },
      { name: "timeFormat", label: "Định dạng giờ", type: "select", value: "24h", options: ["24h", "12h"] },
      { name: "businessHours", label: "Giờ vận hành", type: "text", value: "08:00 - 22:00" }
    ]
  }
];

let activeSectionKey = "general";
let settingsDraft = {};

export async function createSettingsPage() {
  const templateUrl = new URL("./index.html", import.meta.url);
  return loadTemplate(templateUrl);
}

export function initSettingsPage(root = document) {
  settingsDraft = loadSettingsDraft();
  renderSettingsTabs(root);
  renderActiveSection(root);
  bindSettingsEvents(root);
}

function bindSettingsEvents(root) {
  root.querySelector("[data-settings-tabs]")?.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-settings-tab]");

    if (!tab) {
      return;
    }

    activeSectionKey = tab.dataset.settingsTab;
    renderSettingsTabs(root);
    renderActiveSection(root);
  });

  root.querySelector("[data-settings-form]")?.addEventListener("input", (event) => {
    const field = event.target.closest("[name]");

    if (!field) {
      return;
    }

    settingsDraft[field.name] = field.type === "checkbox" ? field.checked : field.value;
  });

  root.querySelector("[data-settings-save]")?.addEventListener("click", () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsDraft));
    toast.success("Đã lưu cài đặt mẫu vào LocalStorage.");
  });
}

function renderSettingsTabs(root) {
  const container = root.querySelector("[data-settings-tabs]");

  container.innerHTML = settingsSections.map((section) => `
    <button type="button" class="${section.key === activeSectionKey ? "is-active" : ""}" data-settings-tab="${section.key}">
      <i class="fa-solid ${section.icon}" aria-hidden="true"></i>
      <span>${section.label}</span>
    </button>
  `).join("");
}

function renderActiveSection(root) {
  const section = getActiveSection();
  const form = root.querySelector("[data-settings-form]");

  root.querySelector("[data-settings-active-eyebrow]").textContent = section.label;
  root.querySelector("[data-settings-active-title]").textContent = section.description;

  form.innerHTML = `
    <div class="settings-section-grid">
      ${section.fields.map(createFieldTemplate).join("")}
    </div>
  `;
}

function createFieldTemplate(field) {
  const value = settingsDraft[field.name] ?? field.value;

  if (field.type === "toggle") {
    return `
      <label class="settings-field settings-toggle">
        <span>${field.label}</span>
        <input type="checkbox" name="${field.name}" ${value ? "checked" : ""}>
        <i aria-hidden="true"></i>
      </label>
    `;
  }

  if (field.type === "textarea") {
    return `
      <label class="settings-field is-full">
        <span>${field.label}</span>
        <textarea name="${field.name}" rows="4">${escapeHtml(value)}</textarea>
      </label>
    `;
  }

  if (field.type === "select") {
    return `
      <label class="settings-field">
        <span>${field.label}</span>
        <select name="${field.name}">
          ${field.options.map((option) => `<option value="${option}" ${option === value ? "selected" : ""}>${option}</option>`).join("")}
        </select>
      </label>
    `;
  }

  return `
    <label class="settings-field">
      <span>${field.label}</span>
      <input type="${field.type}" name="${field.name}" value="${escapeHtml(value)}">
    </label>
  `;
}

function getActiveSection() {
  return settingsSections.find((section) => section.key === activeSectionKey) ?? settingsSections[0];
}

function loadSettingsDraft() {
  const defaults = settingsSections.reduce((result, section) => {
    section.fields.forEach((field) => {
      result[field.name] = field.value;
    });
    return result;
  }, {});

  try {
    return {
      ...defaults,
      ...JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "{}")
    };
  } catch {
    return defaults;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
