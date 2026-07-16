import { STATE_STORAGE_KEYS } from "./state-keys.js";
import { stateStorage } from "./storage.js";

// Initial state is centralized so modules share the same shape.
export function createInitialState() {
  return {
    selectedProduct: stateStorage.get(STATE_STORAGE_KEYS.selectedProduct, null),
    currentUser: stateStorage.get(STATE_STORAGE_KEYS.currentUser, null),
    notifications: {
      unreadCount: 0,
      items: []
    },
    theme: {
      mode: localStorage.getItem(STATE_STORAGE_KEYS.theme) ?? "system",
      effectiveMode: "light"
    },
    sidebar: stateStorage.get(STATE_STORAGE_KEYS.sidebar, {
      collapsed: false,
      mobileOpen: false,
      activePage: "dashboard"
    }),
    loading: {
      page: false,
      message: "",
      requests: 0
    }
  };
}

export const reducers = {
  setSelectedProduct(state, product) {
    return updateState(state, { selectedProduct: product ?? null });
  },

  clearSelectedProduct(state) {
    return updateState(state, { selectedProduct: null });
  },

  setCurrentUser(state, user) {
    return updateState(state, { currentUser: user ?? null });
  },

  clearCurrentUser(state) {
    return updateState(state, { currentUser: null });
  },

  setNotifications(state, notifications) {
    return updateState(state, {
      notifications: {
        ...state.notifications,
        ...notifications
      }
    });
  },

  addNotification(state, notification) {
    const item = {
      id: notification.id ?? createId(),
      read: false,
      createdAt: new Date().toISOString(),
      ...notification
    };

    return updateState(state, {
      notifications: {
        unreadCount: state.notifications.unreadCount + (item.read ? 0 : 1),
        items: [item, ...state.notifications.items]
      }
    });
  },

  markNotificationRead(state, notificationId) {
    let unreadDelta = 0;
    const items = state.notifications.items.map((item) => {
      if (item.id !== notificationId || item.read) {
        return item;
      }

      unreadDelta = 1;
      return { ...item, read: true };
    });

    return updateState(state, {
      notifications: {
        unreadCount: Math.max(0, state.notifications.unreadCount - unreadDelta),
        items
      }
    });
  },

  clearNotifications(state) {
    return updateState(state, {
      notifications: {
        unreadCount: 0,
        items: []
      }
    });
  },

  setTheme(state, theme) {
    return updateState(state, {
      theme: {
        ...state.theme,
        ...theme
      }
    });
  },

  setSidebar(state, sidebar) {
    return updateState(state, {
      sidebar: {
        ...state.sidebar,
        ...sidebar
      }
    });
  },

  setLoading(state, loading) {
    return updateState(state, {
      loading: {
        ...state.loading,
        ...loading
      }
    });
  },

  startRequest(state, message = "") {
    return updateState(state, {
      loading: {
        page: true,
        message,
        requests: state.loading.requests + 1
      }
    });
  },

  finishRequest(state) {
    const requests = Math.max(0, state.loading.requests - 1);

    return updateState(state, {
      loading: {
        page: requests > 0,
        message: requests > 0 ? state.loading.message : "",
        requests
      }
    });
  }
};

export function persistState(state) {
  stateStorage.set(STATE_STORAGE_KEYS.selectedProduct, state.selectedProduct);
  stateStorage.set(STATE_STORAGE_KEYS.currentUser, state.currentUser);
  stateStorage.set(STATE_STORAGE_KEYS.sidebar, state.sidebar);
  localStorage.setItem(STATE_STORAGE_KEYS.theme, state.theme.mode);
}

function updateState(state, patch) {
  return {
    ...state,
    ...patch
  };
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `notification-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
