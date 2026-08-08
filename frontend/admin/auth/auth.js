import { setButtonLoading } from "../components/loading/loading.js";
import { openModal } from "../components/modal/modal.js";
import { notifyError, notifyInfo, notifySuccess, notifyWarning } from "../../assets/js/notify.js";
import { bindValidation, validateForm } from "../components/validation/validation.js";
import { getRememberedEmail, loginAdminAccount, logoutAdminAccount } from "./auth-session.js";

const authCopy = {
  systemName: "N&L Store Admin"
};

export function createLoginPage() {
  return createAuthPage({
    variant: "login",
    title: "Đăng nhập",
    description: "Truy cập bảng điều khiển quản trị cửa hàng thời trang.",
    body: `
      <form class="auth-form" data-validate-form data-auth-form="login">
        <div class="validation-summary" data-validation-summary></div>
        ${createField("Email", "email", "email", "name@example.com", "required|email", `value="${getRememberedEmail()}"`)}
        ${createPasswordField()}
        <div class="auth-option-row">
          <label class="auth-checkbox">
            <input type="checkbox" name="remember" ${getRememberedEmail() ? "checked" : ""}>
            <span>Ghi nhớ đăng nhập</span>
          </label>
          <a class="auth-link" href="#forgot-password" data-page="forgot-password">Quên mật khẩu?</a>
        </div>
        <button class="auth-primary-button" type="submit">
          <i class="fa-solid fa-arrow-right-to-bracket" aria-hidden="true"></i>
          <span>Đăng nhập</span>
        </button>
      </form>
    `
  });
}

export function initLoginPage(root = document) {
  bindPasswordToggle(root);
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
      notifyError(result.message);
      return;
    }

    notifySuccess("Đăng nhập quản trị thành công.");
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
          <span>Gửi</span>
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
    notifySuccess("Đã gửi hướng dẫn đặt lại mật khẩu trên giao diện mẫu.");
  });
}

export function createResetPasswordPage() {
  return createAuthPage({
    title: "Đặt lại mật khẩu",
    description: "Nh?p OTP v? m?t kh?u m?i cho t?i kho?n qu?n tr?.",
    body: `
      <form class="auth-form" data-validate-form data-auth-form="reset">
        <div class="validation-summary" data-validation-summary></div>
        ${createField("OTP", "otp", "text", "123456", "required|regex:^[0-9]{6}$", 'data-regex-message="OTP g?m 6 ch? s?."')}
        ${createField("Password", "password", "password", "????????", "required|password")}
        ${createField("Confirm Password", "confirmPassword", "password", "????????", "required|min:8")}
        <button class="auth-primary-button" type="submit"><i class="fa-solid fa-key" aria-hidden="true"></i><span>Reset Password</span></button>
      </form>
    `
  });
}

export function initResetPasswordPage(root = document) {
  bindAuthForm(root, "reset", async (button, form) => {
    const password = form.querySelector('[name="password"]').value;
    const confirmPassword = form.querySelector('[name="confirmPassword"]').value;
    if (password !== confirmPassword) { notifyError("Confirm Password ch?a kh?p."); return; }
    setButtonLoading(button, true, "Đang đặt lại");
    await wait(520); setButtonLoading(button, false);
    notifySuccess("Đã đặt lại mật khẩu trên giao diện mẫu.");
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
        ${createField("Current Password", "currentPassword", "password", "⬢⬢⬢⬢⬢⬢⬢⬢", "required|min:6")}
        ${createField("New Password", "password", "password", "⬢⬢⬢⬢⬢⬢⬢⬢", "required|password")}
        ${createField("Confirm New Password", "confirmPassword", "password", "⬢⬢⬢⬢⬢⬢⬢⬢", "required|min:8")}
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
    if (form.querySelector('[name="password"]').value !== form.querySelector('[name="confirmPassword"]').value) { notifyError("Confirm New Password ch?a kh?p."); return; }
    setButtonLoading(button, true, "?ang c?p nh?t");
    await wait(520); setButtonLoading(button, false);
    notifySuccess("?? ??i m?t kh?u tr?n giao di?n m?u.");
  });
}

export function createLockScreenPage() {
  return createAuthPage({
    title: "Lock Screen",
    description: "X?c th?c l?i t?i kho?n qu?n tr? ?? ti?p t?c.",
    body: `
      <form class="auth-form" data-validate-form data-auth-form="lock">
        <div class="auth-logo" aria-hidden="true"><img src="../assets/images/nl-store-logo.png?v=20260729-logo" alt=""></div>
        <strong style="text-align:center;color:var(--color-text);">T?i kho?n qu?n tr?</strong>
        <div class="validation-summary" data-validation-summary></div>
        ${createField("Password", "password", "password", "????????", "required|min:6")}
        <button class="auth-primary-button" type="submit"><i class="fa-solid fa-lock-open" aria-hidden="true"></i><span>Unlock</span></button>
      </form>
    `
  });
}

export function initLockScreenPage(root = document) {
  bindAuthForm(root, "lock", async (button) => {
    setButtonLoading(button, true, "?ang m? kh?a");
    await wait(420); setButtonLoading(button, false);
    notifySuccess("?? m? kh?a m?n h?nh tr?n giao di?n m?u.");
    window.location.hash = "dashboard";
  });
}

export function createSessionExpiredPage() {
  return createErrorPage({ code: "PHIÊN ĐĂNG NHẬP", title: "Phiên đăng nhập đã hết hạn", description: "Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại để tiếp tục sử dụng trang quản trị.", icon: "fa-clock", tone: "warning", primaryHref: "#login", primaryLabel: "Đăng nhập lại" });
}

export function initSessionExpiredPage() {
  logoutAdminAccount("session-expired");
  openModal({ variant: "session-expired", eyebrow: "PHIÊN ĐĂNG NHẬP", title: "Phiên đăng nhập đã hết hạn", saveText: "Đăng nhập lại", cancelText: "Đóng", closeLabel: "Đóng thông báo hết phiên đăng nhập", loadingDelay: 0, body: `<div class="modal-session-expired-icon" aria-hidden="true"><i class="fa-regular fa-clock"></i></div><p class="modal-session-expired-copy">Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại để tiếp tục sử dụng trang quản trị.</p>`, onSave() { logoutAdminAccount("session-expired-login-again"); window.location.hash = "login"; } });
}

export function createForbiddenPage() {
  return createErrorPage({
    code: "403",
    title: "Kh?ng c? quy?n truy c?p",
    description: "T?i kho?n hi?n t?i ch?a c? quy?n xem khu v?c n?y.",
    icon: "fa-ban",
    tone: "danger",
    primaryHref: "#dashboard",
    primaryLabel: "Về Dashboard"
  });
}

export function createNotFoundAuthPage(route = {}) {
  return createErrorPage({ code: "404", title: "Không tìm thấy trang", description: `Route #${route.requestedPath ?? "unknown"} không tồn tại trong Admin Panel.`, icon: "fa-map-location-dot", tone: "warning", primaryHref: "#dashboard", primaryLabel: "Về Dashboard" });
}

export function createServerErrorPage() {
  return createErrorPage({ code: "500", title: "Có lỗi hệ thống", description: "Đây là màn hình lỗi giả lập cho trạng thái server error.", icon: "fa-triangle-exclamation", tone: "danger", primaryHref: "#dashboard", primaryLabel: "Về Dashboard" });
}

function createAuthPage({ title, description, body, variant = "default" }) {
  const isLogin = variant === "login";
  const intro = isLogin ? `
      <aside class="admin-auth-intro" aria-label="N&amp;L Store Admin">
        <p class="admin-auth-eyebrow">N&amp;L STORE ADMIN</p>
        <h2>Qu&#7843;n tr&#7883; c&#7917;a h&#224;ng<br>nhanh ch&#243;ng v&#224; tr&#7921;c quan.</h2>
        <p class="admin-auth-description">Theo d&#245;i s&#7843;n ph&#7849;m, &#273;&#417;n h&#224;ng, kh&#225;ch h&#224;ng v&#224; ho&#7841;t &#273;&#7897;ng kinh doanh trong m&#7897;t h&#7879; th&#7889;ng duy nh&#7845;t.</p>
        <ul class="admin-auth-benefits">
          <li>Qu&#7843;n l&#253; &#273;&#417;n h&#224;ng t&#7853;p trung</li>
          <li>Theo d&#245;i doanh thu tr&#7921;c quan</li>
          <li>B&#7843;o m&#7853;t truy c&#7853;p qu&#7843;n tr&#7883;</li>
        </ul>
      </aside>` : "";

  return `
    <section class="auth-page${isLogin ? " admin-auth-login-page" : ""}" aria-labelledby="auth-title">
      <div class="admin-auth-shell">
        ${intro}
        <article class="auth-card${isLogin ? " admin-auth-login-card" : ""}">
          <header class="auth-header">
            <div class="auth-logo" aria-hidden="true">
              <img src="../assets/images/nl-store-logo.png?v=20260729-logo" alt="">
            </div>
            <h1 id="auth-title">${title}</h1>
            <p class="auth-system-name">${authCopy.systemName}</p>
            <p>${description}</p>
          </header>
          ${body}
        </article>
      </div>
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

function createPasswordField() {
  return `
    <label class="validation-field auth-password-field">
      <span>M&#7853;t kh&#7849;u</span>
      <span class="auth-password-control">
        <input type="password" name="password" placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;" data-label="M&#7853;t kh&#7849;u" data-validate="required|min:6">
        <button class="auth-password-toggle" type="button" aria-label="\u0048\u0069\u1ec7\u006e \u006d\u1ead\u0074 \u006b\u0068\u1ea9\u0075" title="\u0048\u0069\u1ec7\u006e \u006d\u1ead\u0074 \u006b\u0068\u1ea9\u0075" aria-pressed="false" data-password-toggle>
          <i class="fa-regular fa-eye" aria-hidden="true"></i>
        </button>
      </span>
    </label>
  `;
}

function bindPasswordToggle(root = document) {
  root.querySelectorAll("[data-password-toggle]").forEach((button) => {
    if (button.dataset.passwordToggleBound === "true") return;
    button.dataset.passwordToggleBound = "true";
    button.addEventListener("click", () => {
      const input = button.closest(".auth-password-control")?.querySelector("input");
      if (!input) return;
      const shouldShow = input.type === "password";
      input.type = shouldShow ? "text" : "password";
      button.setAttribute("aria-label", shouldShow ? "\u1ea8\u006e \u006d\u1ead\u0074 \u006b\u0068\u1ea9\u0075" : "\u0048\u0069\u1ec7\u006e \u006d\u1ead\u0074 \u006b\u0068\u1ea9\u0075");
      button.setAttribute("title", shouldShow ? "\u1ea8\u006e \u006d\u1ead\u0074 \u006b\u0068\u1ea9\u0075" : "\u0048\u0069\u1ec7\u006e \u006d\u1ead\u0074 \u006b\u0068\u1ea9\u0075");
      button.setAttribute("aria-pressed", String(shouldShow));
      button.querySelector("i")?.classList.toggle("fa-eye", !shouldShow);
      button.querySelector("i")?.classList.toggle("fa-eye-slash", shouldShow);
      input.focus({ preventScroll: true });
    });
  });
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
      notifyError("Vui l?ng ki?m tra l?i th?ng tin.");
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

