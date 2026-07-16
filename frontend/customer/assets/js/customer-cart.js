import { customerApi, customerAuth } from "./customer-auth.js";

let toastTimer = null;

export const customerCart = {
  async load() {
    if (!customerAuth.isAuthenticated()) {
      return createEmptyCart();
    }

    const response = await customerApi("/cart");
    return response.data.cart || createEmptyCart();
  },

  async addItem(payload) {
    const response = await customerApi("/cart/items", {
      method: "POST",
      body: payload
    });

    return response.data.cart || createEmptyCart();
  },

  async updateQuantity(itemId, quantity) {
    const response = await customerApi(`/cart/items/${itemId}`, {
      method: "PATCH",
      body: { quantity }
    });

    return response.data.cart || createEmptyCart();
  },

  async removeItem(itemId) {
    const response = await customerApi(`/cart/items/${itemId}`, {
      method: "DELETE"
    });

    return response.data.cart || createEmptyCart();
  },

  async selectItem(itemId, isSelected) {
    const response = await customerApi(`/cart/items/${itemId}/select`, {
      method: "PATCH",
      body: { isSelected }
    });

    return response.data.cart || createEmptyCart();
  },

  async selectAll(isSelected) {
    const response = await customerApi("/cart/items/select-all", {
      method: "PATCH",
      body: { isSelected }
    });

    return response.data.cart || createEmptyCart();
  },

  async checkout(payload) {
    const response = await customerApi("/cart/checkout", {
      method: "POST",
      body: payload
    });

    return response.data;
  }
};

export function createEmptyCart() {
  return {
    items: [],
    totalQuantity: 0,
    subtotal: 0
  };
}

export function showCustomerToast(message, type = "success") {
  let toast = document.querySelector("[data-customer-toast]");

  if (!toast) {
    toast = document.createElement("div");
    toast.dataset.customerToast = "";
    toast.style.position = "fixed";
    toast.style.right = "20px";
    toast.style.bottom = "20px";
    toast.style.zIndex = "9999";
    toast.style.maxWidth = "320px";
    toast.style.padding = "14px 16px";
    toast.style.borderRadius = "14px";
    toast.style.boxShadow = "0 18px 48px rgba(15, 23, 42, 0.18)";
    toast.style.fontWeight = "700";
    toast.style.transition = "opacity 180ms ease, transform 180ms ease";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.style.color = type === "success" ? "#166534" : "#991b1b";
  toast.style.background = type === "success" ? "#dcfce7" : "#fee2e2";
  toast.style.border = type === "success" ? "1px solid #86efac" : "1px solid #fecaca";
  toast.style.opacity = "1";
  toast.style.transform = "translateY(0)";

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
  }, 2400);
}

export function getCartErrorMessage(error) {
  const code = error?.code || "";

  if (error?.status === 401) {
    return "Vui long dang nhap de them san pham vao gio hang.";
  }

  if (code === "PRODUCT_OUT_OF_STOCK") {
    return "San pham da het hang.";
  }

  if (code === "CART_STOCK_EXCEEDED") {
    return "So luong vuot qua ton kho hien co.";
  }

  if (code === "CART_SIZE_REQUIRED") {
    return "Vui long chon size.";
  }

  if (code === "CART_COLOR_REQUIRED") {
    return "Vui long chon mau.";
  }

  if (code === "CART_VARIANT_REQUIRED") {
    return "Vui long chon day du phien ban san pham.";
  }

  if (code === "PRODUCT_NOT_AVAILABLE") {
    return "San pham khong kha dung.";
  }

  return error?.message || "Khong the them san pham vao gio hang.";
}
