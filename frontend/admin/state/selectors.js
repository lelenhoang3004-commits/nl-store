import { store } from "./store.js";

// Selectors keep read logic consistent across admin modules.
export const stateSelectors = {
  selectedProduct() {
    return store.getSlice("selectedProduct");
  },

  currentUser() {
    return store.getSlice("currentUser");
  },

  notifications() {
    return store.getSlice("notifications");
  },

  unreadNotifications() {
    return store.getSlice("notifications").unreadCount;
  },

  theme() {
    return store.getSlice("theme");
  },

  sidebar() {
    return store.getSlice("sidebar");
  },

  loading() {
    return store.getSlice("loading");
  }
};
