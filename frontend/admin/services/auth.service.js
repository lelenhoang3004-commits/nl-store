import { apiClient, tokenService } from "./api/index.js";

// Authentication service. JWT storage can be swapped when backend auth is connected.
class AuthService {
  login(credentials, options = {}) {
    return apiClient.post("/auth/login", credentials, {
      ...options,
      useRefreshToken: false
    }).then((response) => {
      this.storeTokens(response.data);
      return response;
    });
  }

  logout(options = {}) {
    return apiClient.post("/auth/logout", null, options).finally(() => {
      tokenService.clearTokens();
    });
  }

  refresh(options = {}) {
    return apiClient.post("/auth/refresh", null, {
      ...options,
      useRefreshToken: false
    }).then((response) => {
      this.storeTokens(response.data);
      return response;
    });
  }

  getProfile(options = {}) {
    return apiClient.get("/auth/me", options);
  }

  storeTokens(payload = {}) {
    const accessToken = payload.accessToken || payload.tokens?.accessToken || payload.token;
    if (accessToken) {
      tokenService.setAccessToken(accessToken);
    }

    if (payload.refreshToken) {
      tokenService.setRefreshToken(payload.refreshToken);
    }
  }

  clearSession() {
    tokenService.clearTokens();
  }
}

export const authService = new AuthService();
export { AuthService };
