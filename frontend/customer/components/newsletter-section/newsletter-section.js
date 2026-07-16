import { customerApi } from "../../assets/js/customer-auth.js";

export function createNewsletterSection(options = {}) {
  const {
    title = "Đăng ký nhận tin",
    description = "Nhận thông tin trước về ra mắt, ưu đãi và phong cách.",
    placeholder = "Nhập email của bạn",
    buttonText = "Đăng ký"
  } = options;

  return `
    <section class="newsletter-section" data-newsletter-section data-reveal>
      <div class="newsletter-content">
        <span class="hero-kicker">Bản tin</span>
        <h2>${title}</h2>
        <p>${description}</p>
      </div>
      <form class="newsletter-form" data-newsletter-form novalidate>
        <label class="sr-only" for="newsletter-email">Địa chỉ email</label>
        <input id="newsletter-email" name="email" type="email" placeholder="${placeholder}" required>
        <input type="hidden" name="fullName" value="">
        <button class="customer-button" type="submit">${buttonText}</button>
      </form>
      <p class="newsletter-feedback" data-newsletter-feedback aria-live="polite"></p>
    </section>
  `;
}

export function initNewsletterSection(root = document) {
  const form = root.querySelector("[data-newsletter-form]");
  const feedback = root.querySelector("[data-newsletter-feedback]");

  if (!form || !feedback) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const input = form.querySelector("input[type='email']");
    const fullNameInput = form.querySelector("input[name='fullName']");
    const email = input?.value?.trim() || "";
    const fullName = fullNameInput?.value?.trim() || "";
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!isValid) {
      setFeedback(feedback, "Vui lòng nhập email hợp lệ.", "error");
      form.classList.remove("is-success");
      return;
    }

    const button = form.querySelector("button[type='submit']");
    if (button) button.disabled = true;

    try {
      const response = await customerApi("/newsletter/subscribe", {
        method: "POST",
        auth: false,
        refreshOnUnauthorized: false,
        body: { email, fullName, source: "website" }
      });
      if (response?.success !== true) throw new Error(response?.message || "Newsletter subscribe failed.");
      setFeedback(feedback, response.message || "Đăng ký email thành công. Cảm ơn bạn!", "success");
      form.classList.add("is-success");
      form.reset();
    } catch (error) {
      setFeedback(feedback, getNewsletterErrorMessage(error), "error");
      form.classList.remove("is-success");
    } finally {
      if (button) button.disabled = false;
    }
  });
}

function setFeedback(target, message, type) {
  target.textContent = message;
  target.classList.toggle("is-success", type === "success");
  target.classList.toggle("is-error", type === "error");
}

function getNewsletterErrorMessage(error) {
  if (error?.status === 404) return "Không tìm thấy dịch vụ đăng ký email. Vui lòng thử lại sau.";
  if (error?.status === 422) return "Email không hợp lệ.";
  if (error?.status >= 500) return "Lỗi hệ thống. Vui lòng thử lại sau.";
  return error?.message || "Không thể đăng ký email lúc này.";
}

