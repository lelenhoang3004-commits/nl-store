// Observer helper used by the store and future UI bindings.
export class Observer {
  constructor() {
    this.subscribers = new Set();
  }

  subscribe(handler) {
    if (typeof handler !== "function") {
      throw new TypeError("Observer subscriber must be a function.");
    }

    this.subscribers.add(handler);
    return () => this.unsubscribe(handler);
  }

  unsubscribe(handler) {
    this.subscribers.delete(handler);
  }

  notify(payload) {
    this.subscribers.forEach((handler) => {
      handler(payload);
    });
  }

  clear() {
    this.subscribers.clear();
  }
}
