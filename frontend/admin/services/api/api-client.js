import { hidePageLoading, showPageLoading } from "../../components/loading/loading.js";
import { globalErrorManager } from "../../errors/index.js";
import { API_CONFIG } from "./api.config.js";
import { getCsrfToken } from "./csrf.service.js";
import { normalizeApiError } from "./api-error.js";
import { interceptors, runErrorInterceptors, runRequestInterceptors, runResponseInterceptors } from "./interceptors.js";
import { refreshAccessToken } from "./refresh-token.service.js";
import { handleDownloadResponse, handleResponse } from "./response-handler.js";
import { retryRequest } from "./retry.service.js";
import { tokenService } from "./token.service.js";
import { stateActions } from "../../state/index.js";
import { toast } from "../../components/toast/toast.js";
import { logoutAdminAccount } from "../../auth/auth-session.js";

// Single gateway for every backend request in the admin frontend.
export class ApiClient {
  constructor(config = {}) {
    this.config = {
      ...API_CONFIG,
      ...config,
      headers: {
        ...API_CONFIG.headers,
        ...(config.headers ?? {})
      }
    };

    this.interceptors = interceptors;
  }

  get(url, options = {}) {
    return this.request(url, { ...options, method: "GET" });
  }

  post(url, data, options = {}) {
    return this.request(url, { ...options, method: "POST", data });
  }

  put(url, data, options = {}) {
    return this.request(url, { ...options, method: "PUT", data });
  }

  patch(url, data, options = {}) {
    return this.request(url, { ...options, method: "PATCH", data });
  }

  delete(url, options = {}) {
    return this.request(url, { ...options, method: "DELETE" });
  }

  upload(url, formData, options = {}) {
    return this.request(url, {
      ...options,
      method: options.method ?? "POST",
      data: formData,
      isUpload: true
    });
  }

  download(url, options = {}) {
    return this.request(url, {
      ...options,
      method: "GET",
      isDownload: true
    });
  }

  async request(url, options = {}) {
    const requestConfig = await runRequestInterceptors(await this.createRequestConfig(url, options));
    let loadingToken = null;

    if (requestConfig.showLoading !== false) {
      loadingToken = showPageLoading(requestConfig.loadingMessage ?? "Dang xu ly yeu cau...");
    }

    stateActions.startRequest(requestConfig.loadingMessage ?? "");

    try {
      const response = await retryRequest(
        () => this.executeAndHandle(requestConfig),
        requestConfig.retry ?? this.config.retry
      );

      return runResponseInterceptors(response);
    } catch (error) {
      const normalizedError = normalizeApiError(error);
      await this.handleRequestError(normalizedError, requestConfig);
      return runErrorInterceptors(normalizedError);
    } finally {
      stateActions.finishRequest();

      if (loadingToken !== null) {
        hidePageLoading(loadingToken);
      }
    }
  }

  async executeAndHandle(requestConfig) {
    const response = await this.executeRequest(requestConfig);

    if (response.status === 401 && requestConfig.useRefreshToken !== false && !requestConfig._retriedWithRefreshToken) {
      const newToken = await refreshAccessToken();

      if (newToken) {
        return this.executeAndHandle({
          ...requestConfig,
          _retriedWithRefreshToken: true,
          headers: {
            ...requestConfig.headers,
            Authorization: `Bearer ${newToken}`
          }
        });
      }
    }

    return requestConfig.isDownload
      ? handleDownloadResponse(response)
      : handleResponse(response);
  }

  async executeRequest(requestConfig) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), requestConfig.timeout);

    try {
      return await fetch(requestConfig.url, {
        method: requestConfig.method,
        headers: requestConfig.headers,
        body: requestConfig.body,
        signal: controller.signal,
        credentials: requestConfig.credentials
      });
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async createRequestConfig(url, options) {
    const isFormData = options.data instanceof FormData;
    const headers = {
      ...this.config.headers,
      ...(options.headers ?? {})
    };
    const token = tokenService.getAccessToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (!isFormData && options.data !== undefined && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    if (isFormData) {
      delete headers["Content-Type"];
    }

    if (shouldAttachCsrfToken(options.method ?? "GET", this.config.csrf)) {
      const csrfToken = await getCsrfToken();

      if (csrfToken) {
        headers[this.config.csrf.headerName] = csrfToken;
      }
    }

    return {
      ...options,
      url: buildUrl(this.config.baseURL, url, options.params),
      timeout: options.timeout ?? this.config.timeout,
      method: options.method ?? "GET",
      headers,
      body: createBody(options.data, isFormData),
      credentials: options.credentials ?? "include"
    };
  }

  async handleRequestError(error, requestConfig) {
    this.dispatchStatusEvent(error);

    if (error.status === 401) {
      logoutAdminAccount("unauthorized");
      if (window.location.hash !== "#login") {
        toast.error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
        window.location.hash = "login";
      }
      return;
    }

    if (error.status === 403) {
      if (requestConfig.showErrorToast !== false) {
        toast.error("Bạn không có quyền thực hiện thao tác này.");
      }
      return;
    }

    if (requestConfig.showErrorToast !== false) {
      globalErrorManager.handle(error, {
        endpoint: requestConfig.url,
        method: requestConfig.method,
        retry: requestConfig.retryable === false
          ? null
          : () => this.request(requestConfig.url, {
            ...requestConfig,
            url: undefined,
            body: undefined,
            headers: undefined
          })
      });
    }
  }

  dispatchStatusEvent(error) {
    const eventName = getStatusEventName(error.status, this.config.events);

    if (!eventName) {
      return;
    }

    window.dispatchEvent(new CustomEvent(eventName, {
      detail: {
        status: error.status,
        code: error.code,
        message: error.message
      }
    }));
  }
}

function shouldAttachCsrfToken(method, csrfConfig) {
  return csrfConfig.enabled && csrfConfig.protectedMethods.includes(String(method).toUpperCase());
}

export const apiClient = new ApiClient();

function buildUrl(baseURL, url, params) {
  const isAbsoluteUrl = /^https?:\/\//i.test(url);
  const normalizedUrl = isAbsoluteUrl ? url : `${baseURL.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;

  if (!params) {
    return normalizedUrl;
  }

  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `${normalizedUrl}?${query}` : normalizedUrl;
}

function createBody(data, isFormData) {
  if (data === undefined || data === null) {
    return undefined;
  }

  return isFormData ? data : JSON.stringify(data);
}

function getStatusEventName(status, events) {
  if (status === 401) {
    return events.unauthorized;
  }

  if (status === 403) {
    return events.forbidden;
  }

  if (status >= 500) {
    return events.serverError;
  }

  return "";
}
