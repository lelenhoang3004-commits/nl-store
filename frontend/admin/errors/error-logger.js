const ERROR_LOG_KEY = "fashion-admin-error-log";
const MAX_LOG_ITEMS = 80;

// Frontend logger keeps recent errors for debugging without backend logging.
class ErrorLogger {
  log(error) {
    const entry = this.createEntry(error);
    const logs = this.getLogs();
    logs.unshift(entry);
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(logs.slice(0, MAX_LOG_ITEMS)));

    this.emitDebugEvent(entry);

    return entry;
  }

  getLogs() {
    try {
      return JSON.parse(localStorage.getItem(ERROR_LOG_KEY)) ?? [];
    } catch {
      return [];
    }
  }

  clear() {
    localStorage.removeItem(ERROR_LOG_KEY);
  }

  createEntry(error) {
    return {
      id: createId(),
      type: error.type,
      status: error.status,
      code: error.code,
      message: error.message,
      severity: error.severity,
      details: sanitizeDetails(error.details),
      stack: error.cause?.stack ?? error.stack ?? "",
      url: location.href,
      userAgent: navigator.userAgent,
      createdAt: error.createdAt ?? new Date().toISOString()
    };
  }

  emitDebugEvent(entry) {
    window.dispatchEvent(new CustomEvent("fashion-admin-error-logged", {
      detail: entry
    }));
  }
}

export const errorLogger = new ErrorLogger();
export { ErrorLogger };

function sanitizeDetails(details) {
  if (!details) {
    return null;
  }

  try {
    return JSON.parse(JSON.stringify(details));
  } catch {
    return String(details);
  }
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `error-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
