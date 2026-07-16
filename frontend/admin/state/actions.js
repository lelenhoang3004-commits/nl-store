import { cacheStore } from "./cache.js";
import { eventBus } from "./event-bus.js";
import { store } from "./store.js";
import { STATE_EVENTS } from "./state-keys.js";

// Typed action facade for common admin state updates.
export const stateActions = {
  setSelectedProduct(product) {
    return store.dispatch("setSelectedProduct", product);
  },

  clearSelectedProduct() {
    return store.dispatch("clearSelectedProduct");
  },

  setCurrentUser(user) {
    return store.dispatch("setCurrentUser", user);
  },

  clearCurrentUser() {
    return store.dispatch("clearCurrentUser");
  },

  setNotifications(notifications) {
    return store.dispatch("setNotifications", notifications);
  },

  addNotification(notification) {
    return store.dispatch("addNotification", notification);
  },

  markNotificationRead(notificationId) {
    return store.dispatch("markNotificationRead", notificationId);
  },

  clearNotifications() {
    return store.dispatch("clearNotifications");
  },

  setTheme(mode, effectiveMode = mode) {
    return store.dispatch("setTheme", { mode, effectiveMode });
  },

  setSidebar(sidebar) {
    return store.dispatch("setSidebar", sidebar);
  },

  setActivePage(activePage) {
    return store.dispatch("setSidebar", { activePage });
  },

  setLoading(loading) {
    return store.dispatch("setLoading", loading);
  },

  startRequest(message = "") {
    return store.dispatch("startRequest", message);
  },

  finishRequest() {
    return store.dispatch("finishRequest");
  },

  clearCache(prefix = "") {
    cacheStore.clear(prefix);
    eventBus.emit(STATE_EVENTS.cacheCleared, { prefix });
  }
};
