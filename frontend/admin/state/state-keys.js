// Storage and event keys shared by the state layer.
export const STATE_STORAGE_KEYS = Object.freeze({
  currentUser: "fashion-admin-state-current-user",
  selectedProduct: "fashion-admin-state-selected-product",
  theme: "fashion-admin-theme",
  sidebar: "fashion-admin-state-sidebar"
});

export const STATE_EVENTS = Object.freeze({
  changed: "state:changed",
  sliceChanged: "state:slice-changed",
  cacheCleared: "state:cache-cleared"
});
