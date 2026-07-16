import { setButtonLoading } from "../components/loading/loading.js";
import { openModal } from "../components/modal/modal.js";
import { toast } from "../components/toast/toast.js";
import { bindValidation, validateForm } from "../components/validation/validation.js";
import { getRememberedEmail, loginAdminAccount, logoutAdminAccount } from "./auth-session.js";

const authCopy = {
  systemName: "N&L Store Admin"
};

export function createLoginPage() {
  return createAuthPage({
    title: "Đăng nhập",
    description: "Truy cập bảng điều khiển quản trị cửa hàng thời trang.",
    body: `
      <form class="auth-form" data-validate-form data-auth-form="login">
        <div class="validation-summary" data-validation-summary></div>
        ${createField("Email", "email", "email", "name@example.com", "required|email", `value="${getRememberedEmail()}"`)}
        ${createField("Password", "password", "password", "••••••••", "required|min:6")}
        <div class="auth-option-row">
          <label class="auth-checkbox">
            <input type="checkbox" name="remember" ${getRememberedEmail() ? "checked" : ""}>
            <span>Remember Me</span>
          </label>
          <a class="auth-link" href="#forgot-password" data-page="forgot-password">Forgot Password</a>
        </div>
        <button class="auth-primary-button" type="submit">
          <i class="fa-solid fa-arrow-right-to-bracket" aria-hidden="true"></i>
          <span>Login</span>
        </button>
      </form>
    `
  });
}

export function initLoginPage(root = document) {
  bindAuthForm(root, "login", async (button, form) => {
    const formData = new FormData(form);

    setButtonLoading(button, true, "Đang đăng nhập");
    const result = await loginAdminAccount({
      email: formData.get("email"),
      password: formData.get("password"),
      remember: formData.get("remember") === "on"
    });
    setButtonLoading(button, false);

    if (!result.ok) {
      showLoginError(form, result.message);
      toast.error(result.message);
      return;
    }

    toast.success("Đăng nhập quản trị thành công.");
    window.location.hash = "#dashboard";
  });
}

function showLoginError(form, message) {
  const summary = form.querySelector("[data-validation-summary]");
  if (!summary) return;
  summary.hidden = false;
  summary.textContent = message || "Đăng nhập thất bại.";
  summary.classList.add("is-visible");
}

export function createForgotPasswordPage() {
  return createAuthPage({
    title: "Quên mật khẩu",
    description: "Nhập email quản trị để nhận hướng dẫn đặt lại mật khẩu.",
    body: `
      <form class="auth-form" data-validate-form data-auth-form="forgot">
        <div class="validation-summary" data-validation-summary></div>
        ${createField("Email", "email", "email", "name@example.com", "required|email")}
        <button class="auth-primary-button" type="submit">
          <i class="fa-regular fa-paper-plane" aria-hidden="true"></i>
          <span>Send</span>
        </button>
        <a class="auth-link" href="#login" data-page="login">Quay lại đăng nhập</a>
      </form>
    `
  });
}

export function initForgotPasswordPage(root = document) {
  bindAuthForm(root, "forgot", async (button, form) => {
    setButtonLoading(button, true, "Đang gửi");
    await wait(520);
    setButtonLoading(button, false);
    form.outerHTML = createSuccessScreen({
      title: "Đã gửi email",
      description: "Kiểm tra hộp thư của bạn để lấy OTP đặt lại mật khẩu. Đây là màn hình mô phỏng, chưa gửi email thật.",
      href: "#reset-password",
      label: "Nhập OTP"
    });
    toast.success("Đã gửi hướng dẫn đặt lại mật khẩu trên giao diện mẫu.");
  });
}

export function createResetPasswordPage() {
  return createAuthPage({
    title: "Đặt lại mật khẩu",
    description: "Nhập OTP và mật khẩu mới cho tài khoản quản trị.",
    body: `
      <form class="auth-form" data-validate-form data-auth-form="reset">
        <div class="validation-summary" data-validation-summary></div>
        ${createField("OTP", "otp", "text", "123456", "required|regex:^[0-9]{6}$", 'data-regex-message="OTP gồm 6 chữ số."')}
        ${createField("Password", "password", "password", "••••••••", "required|password")}
        ${createField("Confirm Password", "confirmPassword", "password", "••••••••", "required|min:8")}
        <button class="auth-primary-button" type="submit">
          <i class="fa-solid fa-key" aria-hidden="true"></i>
          <span>Reset Password</span>
        </button>
      </form>
    `
  });
}

export function initResetPasswordPage(root = document) {
  bindAuthForm(root, "reset", async (button, form) => {
    const password = form.querySelector('[name="password"]').value;
    const confirmPassword = form.querySelector('[name="confirmPassword"]').value;

    if (password !== confirmPassword) {
      toast.error("Confirm Password chưa khớp.");
      return;
    }

    setButtonLoading(button, true, "Đang đặt lại");
    await wait(520);
    setButtonLoading(button, false);
    toast.success("Đã đặt lại mật khẩu trên giao diện mẫu.");
    window.location.hash = "login";
  });
}

export function createChangePasswordPage() {
  return createAuthPage({
    title: "Đổi mật khẩu",
    description: "Cập nhật mật khẩu định kỳ để bảo vệ tài khoản quản trị.",
    body: `
      <form class="auth-form" data-validate-form data-auth-form="change">
        <div class="validation-summary" data-validation-summary></div>
        ${createField("Current Password", "currentPassword", "password", "••••••••", "required|min:6")}
        ${createField("New Password", "password", "password", "••••••••", "required|password")}
        ${createField("Confirm New Password", "confirmPassword", "password", "••••••••", "required|min:8")}
        <button class="auth-primary-button" type="submit">
          <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
          <span>Change Password</span>
        </button>
      </form>
    `
  });
}

export function initChangePasswordPage(root = document) {
  bindAuthForm(root, "change", async (button, form) => {
    if (form.querySelector('[name="password"]').value !== form.querySelector('[name="confirmPassword"]').value) {
      toast.error("Confirm New Password chưa khớp.");
      return;
    }

    setButtonLoading(button, true, "Đang cập nhật");
    await wait(520);
    setButtonLoading(button, false);
    toast.success("Đã đổi mật khẩu trên giao diện mẫu.");
  });
}

export function createLockScreenPage() {
  return createAuthPage({
    title: "Lock Screen",
    description: "Xác thực lại tài khoản quản trị để tiếp tục.",
    body: `
      <form class="auth-form" data-validate-form data-auth-form="lock">
        <div class="auth-logo" aria-hidden="true"><i class="fa-solid fa-user-shield"></i></div>
        <strong style="text-align:center;color:var(--color-text);">Tài khoản quản trị</strong>
        <div class="validation-summary" data-validation-summary></div>
        ${createField("Password", "password", "password", "••••••••", "required|min:6")}
        <button class="auth-primary-button" type="submit">
          <i class="fa-solid fa-lock-open" aria-hidden="true"></i>
          <span>Unlock</span>
        </button>
      </form>
    `
  });
}

export function initLockScreenPage(root = document) {
  bindAuthForm(root, "lock", async (button) => {
    setButtonLoading(button, true, "Đang mở khóa");
    await wait(420);
    setButtonLoading(button, false);
    toast.success("Đã mở khóa màn hình trên giao diện mẫu.");
    window.location.hash = "dashboard";
  });
}

export function createSessionExpiredPage() {
  return createErrorPage({
    code: "Session Expired",
    title: "Phiên đăng nhập đã hết hạn",
    description: "Vui lòng đăng nhập lại để tiếp tục quản trị hệ thống.",
    icon: "fa-clock",
    tone: "warning",
    primaryHref: "#login",
    primaryLabel: "Login Again"
  });
}

export function initSessionExpiredPage() {
  logoutAdminAccount("session-expired");
  openModal({
    eyebrow: "Session",
    title: "Session Expired",
    saveText: "Login Again",
    cancelText: "Đóng",
    body: `
      <p class="modal-danger-copy">
        Phiên làm việc mẫu đã hết hạn. Hãy đăng nhập lại để tiếp tục thao tác trong Admin Panel.
      </p>
    `,
    onSave() {
      window.location.hash = "login";
    }
  });
}

export function createForbiddenPage() {
  return createErrorPage({
    code: "403",
    title: "Không có quyền truy cập",
    description: "Tài khoản hiện tại chưa có quyền xem khu vực này.",
    icon: "fa-ban",
    tone: "danger",
    primaryHref: "#dashboard",
    primaryLabel: "Về Dashboard"
  });
}

export function createNotFoundAuthPage(route = {}) {
  return createErrorPage({
    code: "404",
    title: "Không tìm thấy trang",
    description: `Route #${route.requestedPath ?? "unknown"} không tồn tại trong Admin Panel.`,
    icon: "fa-map-location-dot",
    tone: "warning",
    primaryHref: "#dashboard",
    primaryLabel: "Về Dashboard"
  });
}

export function createServerErrorPage() {
  return createErrorPage({
    code: "500",
    title: "Có lỗi hệ thống",
    description: "Đây là màn hình lỗi giả lập cho trạng thái server error.",
    icon: "fa-triangle-exclamation",
    tone: "danger",
    primaryHref: "#dashboard",
    primaryLabel: "Về Dashboard"
  });
}

function createAuthPage({ title, description, body }) {
  return `
    <section class="auth-page" aria-labelledby="auth-title">
      <article class="auth-card">
        <header class="auth-header">
          <div class="auth-logo" aria-hidden="true">
            <i class="fa-solid fa-bag-shopping"></i>
          </div>
          <h1 id="auth-title">${title}</h1>
          <p>${authCopy.systemName}</p>
          <p>${description}</p>
        </header>
        ${body}
      </article>
    </section>
  `;
}

function createErrorPage({ code, title, description, icon, tone = "", primaryHref, primaryLabel }) {
  return `
    <section class="auth-page" aria-labelledby="error-title">
      <article class="auth-card is-wide">
        <div class="auth-error-state">
          <i class="fa-solid ${icon} is-${tone}" aria-hidden="true"></i>
          <p class="auth-link">${code}</p>
          <h1 id="error-title">${title}</h1>
          <p>${description}</p>
          <div class="auth-inline-actions">
            <a class="auth-primary-button" href="${primaryHref}" data-page="${primaryHref.replace("#", "")}">${primaryLabel}</a>
            <a class="auth-secondary-button" href="#login" data-page="login">Login</a>
          </div>
        </div>
      </article>
    </section>
  `;
}

function createSuccessScreen({ title, description, href, label }) {
  return `
    <div class="auth-success">
      <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
      <h1>${title}</h1>
      <p>${description}</p>
      <a class="auth-primary-button" href="${href}" data-page="${href.replace("#", "")}">${label}</a>
    </div>
  `;
}

function createField(label, name, type, placeholder, rules, extra = "") {
  return `
    <label class="validation-field">
      <span>${label}</span>
      <input type="${type}" name="${name}" placeholder="${placeholder}" data-label="${label}" data-validate="${rules}" ${extra}>
    </label>
  `;
}

function bindAuthForm(root, formName, onSubmit) {
  const form = root.querySelector(`[data-auth-form="${formName}"]`);

  if (!form) {
    return;
  }

  bindValidation(form);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!validateForm(form).isValid) {
      toast.error("Vui lòng kiểm tra lại thông tin.");
      return;
    }

    await onSubmit(form.querySelector("button[type='submit']"), form);
  });
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}
