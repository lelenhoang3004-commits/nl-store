// In-memory cache with optional TTL for API responses and computed state.
class CacheStore {
  constructor() {
    this.items = new Map();
  }

  set(key, value, ttl = 0) {
    this.items.set(key, {
      value,
      expiresAt: ttl > 0 ? Date.now() + ttl : 0
    });

    return value;
  }

  get(key, fallback = null) {
    const item = this.items.get(key);

    if (!item) {
      return fallback;
    }

    if (this.isExpired(item)) {
      this.items.delete(key);
      return fallback;
    }

    return item.value;
  }

  has(key) {
    return this.get(key, undefined) !== undefined;
  }

  remove(key) {
    this.items.delete(key);
  }

  remember(key, factory, ttl = 0) {
    if (this.has(key)) {
      return this.get(key);
    }

    const value = factory();
    this.set(key, value, ttl);
    return value;
  }

  clear(prefix = "") {
    if (!prefix) {
      this.items.clear();
      return;
    }

    Array.from(this.items.keys())
      .filter((key) => String(key).startsWith(prefix))
      .forEach((key) => this.items.delete(key));
  }

  isExpired(item) {
    return item.expiresAt > 0 && Date.now() > item.expiresAt;
  }
}

export const cacheStore = new CacheStore();
export { CacheStore };
