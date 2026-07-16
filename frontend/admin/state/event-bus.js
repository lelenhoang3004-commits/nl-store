// Lightweight pub/sub bus for decoupled admin modules.
class EventBus {
  constructor() {
    this.events = new Map();
  }

  on(eventName, handler) {
    this.assertHandler(handler);

    if (!this.events.has(eventName)) {
      this.events.set(eventName, new Set());
    }

    this.events.get(eventName).add(handler);
    return () => this.off(eventName, handler);
  }

  once(eventName, handler) {
    this.assertHandler(handler);

    const unsubscribe = this.on(eventName, (payload) => {
      unsubscribe();
      handler(payload);
    });

    return unsubscribe;
  }

  off(eventName, handler) {
    this.events.get(eventName)?.delete(handler);
  }

  emit(eventName, payload = null) {
    const handlers = this.events.get(eventName);

    if (!handlers) {
      return;
    }

    handlers.forEach((handler) => {
      handler(payload);
    });
  }

  clear(eventName) {
    if (eventName) {
      this.events.delete(eventName);
      return;
    }

    this.events.clear();
  }

  assertHandler(handler) {
    if (typeof handler !== "function") {
      throw new TypeError("EventBus handler must be a function.");
    }
  }
}

export const eventBus = new EventBus();
export { EventBus };
