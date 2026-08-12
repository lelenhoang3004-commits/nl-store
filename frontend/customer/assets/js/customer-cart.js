import { customerApi, customerAuth } from "./customer-auth.js";

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

  async removeItems(itemIds) {
    const response = await customerApi("/cart/items", {
      method: "DELETE",
      body: { itemIds }
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

