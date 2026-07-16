import { eventBus } from "../state/index.js";
import { normalizeAppError } from "./error-mapper.js";
import { errorLogger } from "./error-logger.js";
import { errorRenderer } from "./error-renderer.js";

export const ERROR_EVENTS = Object.freeze({
  captured: "error:captured",
  rendered: "error:rendered"
});

// Single entrypoint for all frontend errors.
class GlobalErrorManager {
  constructor() {
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) {
      return;
    }

    window.addEventListener("error", (event) => {
      this.handle(event.error ?? new Error(event.message), {
        source: "window.error",
        fileName: event.filename,
        lineNumber: event.lineno,
        columnNumber: event.colno
      });
    });

    window.addEventListener("unhandledrejection", (event) => {
      this.handle(event.reason, {
        source: "window.unhandledrejection"
      });
    });

    this.isInitialized = true;
  }

  handle(error, context = {}) {
    if (error?.__globalErrorHandled && !context.force) {
      return {
        error,
        logEntry: null,
        rendered: null
      };
    }

    if (error && typeof error === "object") {
      error.__globalErrorHandled = true;
    }

    const normalizedError = normalizeAppError(error, context);
    const logEntry = errorLogger.log(normalizedError);

    eventBus.emit(ERROR_EVENTS.captured, {
      error: normalizedError,
      logEntry
    });

    const rendered = errorRenderer.show(normalizedError);

    eventBus.emit(ERROR_EVENTS.rendered, {
      error: normalizedError,
      logEntry
    });

    return {
      error: normalizedError,
      logEntry,
      rendered
    };
  }

  retry(error, retryCallback) {
    return this.handle(error, {
      retry: retryCallback
    });
  }

  getLogs() {
    return errorLogger.getLogs();
  }

  clearLogs() {
    errorLogger.clear();
  }
}

export const globalErrorManager = new GlobalErrorManager();
export { GlobalErrorManager };
