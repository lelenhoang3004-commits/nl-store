import { notifyError, notifySuccess } from "../../assets/js/notify.js";
import { updateAuthenticatedUser } from "../auth/auth-session.js";
import { setButtonLoading } from "../components/loading/loading.js";
import { getCurrentUser } from "../permissions/user-session.js";
import { userService } from "../services/user.service.js";

let profileState = {
  profile: null,
  initialForm: null,
  isLoading: false,
  error: ""
};

export function createProfilePage() {
  return `
    <section class="admin-profile-page" aria-labelledby="admin-profile-title">
      <header class="admin-profile-heading">
        <div>
          <p class="admin-profile-eyebrow">Hồ sơ quản trị</p>
          <h1 id="admin-profile-title">Thông tin tài khoản</h1>
          <span>Quản lý thông tin cá nhân của tài khoản đang đăng nhập.</span>
        </div>
      </header>
      <div data-admin-profile-root>
        ${createLoadingCard()}
      </div>
    </section>
  `;
}

export async function initProfilePage(root) {
  await loadProfile(root);
  return () => {};
}

async function loadProfile(root) {
  profileState = { ...profileState, isLoading: true, error: "" };
  renderProfile(root);

  try {
    const response = await userService.getProfile({ showLoading: false, showErrorToast: false });
    const profile = normalizeProfile(readUserPayload(response));
    profileState = {
      profile,
      initialForm: createEditableSnapshot(profile),
      isLoading: false,
      error: ""
    };
  } catch (error) {
    profileState = {
      ...profileState,
      profile: normalizeProfile(getCurrentUser()),
      isLoading: false,
      error: error?.message || "Không thể tải hồ sơ. Vui lòng thử lại."
    };
  }

  renderProfile(root);
  bindProfileForm(root);
}

function renderProfile(root) {
  const container = root.querySelector("[data-admin-profile-root]");

  if (!container) {
    return;
  }

  if (profileState.isLoading) {
    container.innerHTML = createLoadingCard();
    return;
  }

  const profile = profileState.profile || normalizeProfile(getCurrentUser());
  const avatarMarkup = profile.avatarUrl
    ? `<img src="${escapeHtml(resolveAssetUrl(profile.avatarUrl))}" alt="Avatar ${escapeHtml(profile.fullName)}">`
    : `<span>${escapeHtml(createInitials(profile.fullName || profile.email))}</span>`;

  container.innerHTML = `
    <div class="admin-profile-grid">
      <section class="admin-profile-card admin-profile-summary" aria-label="Tóm tắt tài khoản">
        <div class="admin-profile-avatar ${profile.avatarUrl ? "has-image" : ""}">${avatarMarkup}</div>
        <div>
          <h2>${escapeHtml(profile.fullName || "Quản trị viên")}</h2>
          <p>${escapeHtml(profile.email || "Chưa có email")}</p>
        </div>
        <div class="admin-profile-badges">
          <span><i class="fa-solid fa-user-shield" aria-hidden="true"></i>${escapeHtml(formatRole(profile.role))}</span>
          <span class="${profile.status === "active" ? "is-active" : ""}"><i class="fa-solid fa-circle-check" aria-hidden="true"></i>${escapeHtml(formatStatus(profile.status))}</span>
        </div>
      </section>

      <section class="admin-profile-card admin-profile-form-card" aria-labelledby="admin-profile-form-title">
        <div class="admin-profile-card-header">
          <div>
            <p>Thông tin tài khoản</p>
            <h2 id="admin-profile-form-title">Hồ sơ quản trị</h2>
          </div>
        </div>
        ${profileState.error ? `<div class="admin-profile-alert" role="alert"><span>${escapeHtml(profileState.error)}</span><button type="button" data-profile-retry>Thử lại</button></div>` : ""}
        <form class="admin-profile-form" data-admin-profile-form>
          <label>
            <span>Họ và tên</span>
            <input type="text" name="fullName" value="${escapeHtml(profile.fullName)}" maxlength="120" autocomplete="name" required>
          </label>
          <label>
            <span>Email</span>
            <input type="email" value="${escapeHtml(profile.email)}" readonly>
          </label>
          <label>
            <span>Số điện thoại</span>
            <input type="tel" name="phone" value="${escapeHtml(profile.phone)}" autocomplete="tel" inputmode="tel" placeholder="Chưa cập nhật">
          </label>
          <label>
            <span>Vai trò</span>
            <input type="text" value="${escapeHtml(formatRole(profile.role))}" readonly>
          </label>
          <label>
            <span>Trạng thái</span>
            <input type="text" value="${escapeHtml(formatStatus(profile.status))}" readonly>
          </label>
          <div class="admin-profile-actions">
            <button class="admin-profile-save" type="submit" data-admin-profile-save disabled>
              <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>
              <span>Lưu thay đổi</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function bindProfileForm(root) {
  const form = root.querySelector("[data-admin-profile-form]");
  const saveButton = root.querySelector("[data-admin-profile-save]");

  if (!form || !saveButton) {
    return;
  }

  const syncDirtyState = () => {
    syncPasswordRequirement(form);
    saveButton.disabled = !hasFormChanged(form);
  };

  syncPasswordRequirement(form);
  root.querySelector("[data-profile-retry]")?.addEventListener("click", () => loadProfile(root));
  form.addEventListener("input", syncDirtyState);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!hasFormChanged(form)) {
      return;
    }

    const validationMessage = validateProfileForm(form);
    if (validationMessage) {
      notifyError(validationMessage);
      return;
    }

    const payload = createProfilePayload(form);
    setButtonLoading(saveButton, true, "Đang cập nhật...");

    try {
      const response = await userService.updateProfile(payload, {
        showLoading: false,
        showErrorToast: false
      });
      const profile = normalizeProfile(readUserPayload(response));
      profileState.profile = profile;
      profileState.initialForm = createEditableSnapshot(profile);
      profileState.error = "";
      updateAuthenticatedUser(createSessionUserPatch(profile));
      notifySuccess("Cập nhật hồ sơ thành công.");
      renderProfile(root);
      bindProfileForm(root);
    } catch (error) {
      notifyError(error?.message || "Không thể cập nhật hồ sơ. Vui lòng thử lại.");
      saveButton.disabled = false;
    } finally {
      setButtonLoading(saveButton, false);
      const nextButton = root.querySelector("[data-admin-profile-save]");
      const nextForm = root.querySelector("[data-admin-profile-form]");
      if (nextButton) {
        nextButton.disabled = !hasFormChanged(nextForm);
      }
    }
  });
}

function createLoadingCard() {
  return `
    <div class="admin-profile-card admin-profile-loading" aria-label="Đang tải hồ sơ">
      <span class="loading-spinner loading-spinner-md" aria-hidden="true"></span>
      <strong>Đang tải hồ sơ...</strong>
    </div>
  `;
}

function hasFormChanged(form) {
  if (!form || !profileState.initialForm) {
    return false;
  }
  const current = createProfilePayload(form);
  return current.fullName !== profileState.initialForm.fullName || current.phone !== profileState.initialForm.phone;
}

function validateProfileForm(form) {
  const fullName = String(form.elements.fullName?.value || "").trim();
  const phone = String(form.elements.phone?.value || "").trim();
  const passwordRequired = Boolean(form.elements.current_password?.required);
  const currentPassword = String(form.elements.current_password?.value || "");

  if (!fullName) {
    return "Họ và tên không được để trống.";
  }

  if (fullName.length > 120) {
    return "Họ và tên không được vượt quá 120 ký tự.";
  }

  if (phone && !isValidVietnamPhone(phone)) {
    return "Số điện thoại không hợp lệ.";
  }

  if (passwordRequired && !currentPassword) {
    return "Vui lòng nhập mật khẩu hiện tại để đổi số điện thoại.";
  }

  return "";
}

function createProfilePayload(form) {
  const payload = {
    fullName: String(form.elements.fullName?.value || "").trim(),
    phone: String(form.elements.phone?.value || "").trim()
  };

  const currentPassword = String(form.elements.current_password?.value || "");
  if (currentPassword) {
    payload.current_password = currentPassword;
  }

  return payload;
}

function syncPasswordRequirement(form) {
  const field = form?.querySelector("[data-phone-password-field]");
  const input = form?.elements.current_password;

  if (!field || !input || !profileState.initialForm) {
    return;
  }

  const phoneChanged = String(form.elements.phone?.value || "").trim() !== profileState.initialForm.phone;
  field.hidden = !phoneChanged;
  input.required = phoneChanged;

  if (!phoneChanged) {
    input.value = "";
  }
}

function isValidVietnamPhone(value) {
  const digits = String(value || "").replace(/[\s.-]/g, "");
  return /^(0|\+84)(3|5|7|8|9)\d{8}$/.test(digits);
}

function createEditableSnapshot(profile) {
  return {
    fullName: String(profile.fullName || "").trim(),
    phone: String(profile.phone || "").trim()
  };
}

function readUserPayload(response) {
  return response?.data?.user || response?.user || response?.data || response || {};
}

function normalizeProfile(rawProfile = {}) {
  const currentUser = getCurrentUser();
  const fullName = rawProfile.fullName || rawProfile.full_name || rawProfile.name || currentUser.name || "";
  const avatarUrl = rawProfile.avatarUrl || rawProfile.avatar_url || rawProfile.avatar || currentUser.avatarUrl || "";

  return {
    id: rawProfile.id ?? currentUser.id ?? null,
    fullName,
    name: fullName,
    email: rawProfile.email || currentUser.email || "",
    phone: rawProfile.phone || rawProfile.phone_number || "",
    role: String(rawProfile.role || currentUser.role || "").toUpperCase(),
    status: String(rawProfile.status || "active").toLowerCase(),
    avatarUrl,
    permissions: Array.isArray(rawProfile.permissions) ? rawProfile.permissions : currentUser.permissions || []
  };
}

function createSessionUserPatch(profile) {
  return {
    id: profile.id,
    name: profile.fullName,
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone,
    role: profile.role,
    status: profile.status,
    avatarUrl: profile.avatarUrl,
    permissions: profile.permissions
  };
}

function formatRole(role) {
  const normalized = String(role || "").toUpperCase();
  if (normalized === "ADMIN") return "ADMIN";
  if (normalized === "STAFF") return "STAFF";
  return normalized || "Chưa xác định";
}

function formatStatus(status) {
  const normalized = String(status || "").toLowerCase();
  const labels = {
    active: "Đang hoạt động",
    inactive: "Tạm khóa",
    locked: "Đã khóa"
  };
  return labels[normalized] || "Chưa xác định";
}

function createInitials(name) {
  return String(name || "AD").trim().split(/\s+/).slice(-2).map((part) => part[0] || "").join("").toUpperCase() || "AD";
}

function resolveAssetUrl(value) {
  if (typeof globalThis.normalizeImageUrl === "function") {
    return globalThis.normalizeImageUrl(value);
  }
  return value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
