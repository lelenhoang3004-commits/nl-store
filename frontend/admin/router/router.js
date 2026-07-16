import { hidePageLoading, showPageLoading } from "../components/loading/loading.js";
import { DEFAULT_ADMIN_ROUTE, adminRoutes } from "./routes.js";
import { runRouteGuards } from "./guards.js";

export function createAdminRouter(options) {
  return new AdminRouter({
    routes: adminRoutes,
    defaultPath: DEFAULT_ADMIN_ROUTE,
    ...options
  });
}

class AdminRouter {
  constructor({ routes, defaultPath, outlet, onRouteChange, onAfterRouteChange }) {
    this.routes = routes;
    this.defaultPath = defaultPath;
    this.outlet = outlet;
    this.onRouteChange = onRouteChange;
    this.onAfterRouteChange = onAfterRouteChange;
    this.currentPath = "";
    this.currentCleanup = null;
    this.started = false;
    this.navigationId = 0;
    this.transitionTimer = null;
    this.boundLinkClick = (event) => this.handleLinkClick(event);
    this.boundHistoryChange = () => this.loadCurrentRoute({ historyEvent: true });
  }

  start() {
    if (this.started) {
      return this.loadCurrentRoute({ replace: true });
    }

    this.started = true;
    document.addEventListener("click", this.boundLinkClick);
    window.addEventListener("popstate", this.boundHistoryChange);
    window.addEventListener("hashchange", this.boundHistoryChange);

    return this.loadCurrentRoute({ replace: true });
  }

  navigate(path, options = {}) {
    const normalizedPath = normalizePath(path) || this.defaultPath;
    const targetHash = `#${normalizedPath}`;

    if (window.location.hash === targetHash) {
      return this.loadCurrentRoute(options);
    }

    if (options.replace) {
      window.history.replaceState(null, "", targetHash);
    } else {
      window.history.pushState(null, "", targetHash);
    }

    return this.loadCurrentRoute(options);
  }

  async loadCurrentRoute(options = {}) {
    const requestedPath = normalizePath(window.location.hash) || this.defaultPath;

    if (options.historyEvent && requestedPath === this.currentPath) {
      return true;
    }

    const navigationId = this.navigationId + 1;
    this.navigationId = navigationId;

    const route = this.matchRoute(requestedPath);
    const context = {
      requestedPath,
      route
    };

    const loadingToken = showPageLoading("Đang chuyển trang...");

    try {
      await wait(140);

      if (!this.isCurrentNavigation(navigationId)) {
        return false;
      }

      const guardResult = await runRouteGuards(route, context);

      if (guardResult !== true) {
        if (!this.isCurrentNavigation(navigationId)) {
          return false;
        }

        if (guardResult?.redirect) {
          return this.navigate(guardResult.redirect, { replace: true, requestedPath });
        }

        return false;
      }

      if (!this.isCurrentNavigation(navigationId)) {
        return false;
      }

      this.currentPath = requestedPath;
      this.onRouteChange?.(route, context);
      await this.renderRoute(route, context, navigationId);

      if (!this.isCurrentNavigation(navigationId)) {
        return false;
      }

      this.onAfterRouteChange?.(route, context);
      return true;
    } finally {
      hidePageLoading(loadingToken);
    }
  }

  async renderRoute(route, context, navigationId) {
    this.outlet.classList.add("router-content-leaving");
    await wait(90);

    if (!this.isCurrentNavigation(navigationId)) {
      return;
    }

    this.cleanupCurrentRoute();

    const html = await route.render({ ...context, route });

    if (!this.isCurrentNavigation(navigationId)) {
      return;
    }

    this.outlet.innerHTML = `<div class="router-page" data-router-page>${html}</div>`;

    const pageRoot = this.outlet.querySelector("[data-router-page]");

    const cleanup = route.init?.(pageRoot, route, context);
    this.currentCleanup = typeof cleanup === "function" ? cleanup : pageRoot?.__cleanup ?? null;
    this.outlet.classList.remove("router-content-leaving");
    this.outlet.classList.add("router-content-entering");

    window.clearTimeout(this.transitionTimer);
    this.transitionTimer = window.setTimeout(() => {
      this.outlet.classList.remove("router-content-entering");
    }, 220);

    this.outlet.focus({ preventScroll: true });
  }

  isCurrentNavigation(navigationId) {
    return navigationId === this.navigationId;
  }

  cleanupCurrentRoute() {
    cleanupNestedComponents(this.outlet);

    if (typeof this.currentCleanup !== "function") {
      this.currentCleanup = null;
      return;
    }

    try {
      this.currentCleanup();
    } finally {
      this.currentCleanup = null;
    }
  }

  matchRoute(path) {
    const route = this.routes.find((item) => item.path === path || item.aliases?.includes(path));

    if (route) {
      return route;
    }

    for (const item of this.routes) {
      const params = matchDynamicPath(item.path, path);
      if (params) return { ...item, params };
    }

    return {
      ...this.routes.find((item) => item.path === "404"),
      requestedPath: path
    };
  }

  handleLinkClick(event) {
    const link = event.target.closest("[data-page]");

    if (!link) {
      return;
    }

    event.preventDefault();
    this.navigate(link.dataset.page);
  }
}

function matchDynamicPath(pattern, path) {
  if (!pattern.includes(":")) return null;
  const patternParts = pattern.split("/");
  const pathParts = path.split("/");
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const expected = patternParts[index];
    const actual = pathParts[index];
    if (expected.startsWith(":")) params[expected.slice(1)] = decodeURIComponent(actual);
    else if (expected !== actual) return null;
  }
  return params;
}

function normalizePath(value) {
  return String(value ?? "")
    .replace(/^#/, "")
    .replace(/^\//, "")
    .trim();
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function cleanupNestedComponents(root) {
  root.querySelectorAll("*").forEach((element) => {
    [
      "__uploadManagerCleanup",
      "__fileManagerCleanup",
      "__imageManagerCleanup"
    ].forEach((cleanupKey) => {
      if (typeof element[cleanupKey] === "function") {
        element[cleanupKey]();
        element[cleanupKey] = null;
      }
    });
  });
}
