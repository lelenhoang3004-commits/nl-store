import { apiClient } from "./api/index.js";

// Shared REST service. Feature services extend this class instead of calling fetch.
export class BaseService {
  constructor(endpoint, client = apiClient) {
    this.endpoint = endpoint;
    this.client = client;
  }

  list(params = {}, options = {}) {
    return this.client.get(this.endpoint, { ...options, params });
  }

  getById(id, options = {}) {
    return this.client.get(this.path(id), options);
  }

  create(payload, options = {}) {
    return this.client.post(this.endpoint, payload, options);
  }

  update(id, payload, options = {}) {
    return this.client.put(this.path(id), payload, options);
  }

  patch(id, payload, options = {}) {
    return this.client.patch(this.path(id), payload, options);
  }

  remove(id, options = {}) {
    return this.client.delete(this.path(id), options);
  }

  upload(path, formData, options = {}) {
    return this.client.upload(this.path(path), formData, options);
  }

  download(path = "", params = {}, options = {}) {
    return this.client.download(this.path(path), { ...options, params });
  }

  path(...segments) {
    const suffix = segments
      .filter((segment) => segment !== undefined && segment !== null && segment !== "")
      .map((segment) => String(segment).replace(/^\/|\/$/g, ""))
      .join("/");

    return suffix ? `${this.endpoint}/${suffix}` : this.endpoint;
  }
}
