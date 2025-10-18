const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// Token management
export const TokenManager = {
  getAccessToken: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("accessToken");
  },

  getRefreshToken: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("refreshToken");
  },

  setTokens: (accessToken: string, refreshToken: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    // Khi người dùng đăng nhập và có token, họ không còn là khách nữa.
    TokenManager.clearGuestSession();
  },

  clearTokens: () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  },

  hasGuestSession: (): boolean => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("guestSession") === "true";
  },

  setGuestSession: () => {
    if (typeof window === "undefined") return;
    localStorage.setItem("guestSession", "true");
  },

  clearGuestSession: () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("guestSession");
  },
};

// API Client with automatic token refresh
class ApiClient {
  private baseUrl: string;
  private guestSessionPromise: Promise<void> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // Đảm bảo người dùng khách có một session cookie từ backend
  ensureGuestSession(): Promise<void> {
    // Nếu đã có promise, tức là đang có một request chạy rồi, chỉ cần chờ nó hoàn thành.
    if (this.guestSessionPromise) {
      return this.guestSessionPromise;
    }

    // Nếu đã đăng nhập hoặc đã có cờ guest session, không cần làm gì.
    if (
      typeof window === "undefined" ||
      TokenManager.getAccessToken() ||
      TokenManager.hasGuestSession()
    ) {
      return Promise.resolve();
    }

    // Tạo một promise mới để ping server. Các lời gọi sau sẽ chờ promise này.
    this.guestSessionPromise = (async () => {
      console.log(
        "No user or guest session found. Pinging server to create guest session..."
      );
      try {
        // Gọi đến một endpoint công khai bất kỳ để kích hoạt middleware tạo session phía backend.
        // Chúng ta không cần dữ liệu trả về, chỉ cần request được gửi đi.
        await fetch(`${this.baseUrl}/bff/content/breeds`);
        TokenManager.setGuestSession();
        console.log("Guest session created and flag set in localStorage.");
      } catch (error) {
        console.error("Failed to ping server for guest session:", error);
        // Ném lỗi để promise được lưu là Rejected
        throw error;
      } finally {
        // QUAN TRỌNG: Luôn luôn xóa promise để lần gọi tiếp theo có thể thử lại
        this.guestSessionPromise = null;
      }
    })();

    // Thêm .catch() để tránh UnhandledPromiseRejection, nhưng vẫn re-throw lỗi cho caller
    return this.guestSessionPromise.catch((e) => {
      // Chúng ta không cần làm gì ở đây, chỉ cần ensureGuestSession re-throw lỗi.
      throw e;
    });
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requiresAuth = false
  ): Promise<T> {
    // FIX: Xử lý trường hợp có dấu '/' thừa. Sử dụng URL constructor là cách sạch nhất.
    const url = new URL(endpoint, this.baseUrl).toString();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    // Chờ cho việc kiểm tra/tạo guest session hoàn tất trước khi gửi request
    await this.ensureGuestSession();

    // Luôn đính kèm token nếu nó tồn tại
    const token = TokenManager.getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle 401 - try to refresh token
      if (response.status === 401 && requiresAuth) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // Retry the request with new token
          const newToken = TokenManager.getAccessToken();
          if (newToken) {
            headers["Authorization"] = `Bearer ${newToken}`;
          }
          const retryResponse = await fetch(url, { ...options, headers });

          if (!retryResponse.ok) {
            // Tái sử dụng logic xử lý lỗi chi tiết
            const retryErrorData = await retryResponse.json().catch(() => ({}));
            const retryErrorMessage =
              retryErrorData.errors?.[0]?.message ||
              retryErrorData.message ||
              `API Error: ${retryResponse.statusText}`;
            throw new Error(retryErrorMessage);
          }

          return retryResponse.json();
        } else {
          // Refresh failed, clear tokens and throw
          TokenManager.clearTokens();
          // Ném lỗi xác thực cụ thể, sẽ được bắt ở AuthContext để xử lý Logout
          throw new Error("Authentication failed");
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // { success: false, errors: [{ message: '...' }] }
        // Lấy message từ lỗi đầu tiên trong mảng errors, hoặc fallback về message chung
        const errorMessage =
          errorData.errors?.[0]?.message ||
          errorData.message ||
          `API Error: ${response.statusText}`;
        throw new Error(errorMessage);
      }
      if (response.status === 204 || response.status === 304) {
        return Promise.resolve(null as T);
      }
      return response.json();
    } catch (error) {
      console.error("[v0] API request failed:", error);
      throw error;
    }
  }

  private async requestWithFormData<T>(
    endpoint: string,
    formData: FormData,
    requiresAuth = false
  ): Promise<T> {
    const url = new URL(endpoint, this.baseUrl).toString();
    const headers: Record<string, string> = {};

    await this.ensureGuestSession();

    // luôn đính kèm token nếu tồn tại
    const token = TokenManager.getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const options: RequestInit = {
      method: "POST",
      body: formData,
      headers: headers,
    };

    try {
      const response = await fetch(url, options);

      // handle 401 - thử refresh token
      if (response.status === 401 && requiresAuth) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          const newToken = TokenManager.getAccessToken();
          if (newToken) {
            // tạo headers mới để tránh thêm Content-Type mặc định
            const retryHeaders = {
              ...headers,
              Authorization: `Bearer ${newToken}`,
            };
            const retryOptions = { ...options, headers: retryHeaders };

            const retryResponse = await fetch(url, retryOptions);

            // kiểm tra lỗi sau khi retry
            if (!retryResponse.ok) {
              const retryErrorData = await retryResponse
                .json()
                .catch(() => ({}));
              const retryErrorMessage =
                retryErrorData.errors?.[0]?.message ||
                retryErrorData.message ||
                `API Error: ${retryResponse.statusText}`;
              throw new Error(retryErrorMessage);
            }

            return retryResponse.json();
          }
        }

        // nếu refresh token thất bại
        TokenManager.clearTokens();
        throw new Error("Authentication failed");
      }

      // nếu response không ok
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.errors?.[0]?.message ||
          errorData.message ||
          `API Error: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error) {
      console.error("[v0] API FormData request failed:", error);
      throw error;
    }
  }

  private async refreshAccessToken(): Promise<boolean> {
    const refreshToken = TokenManager.getRefreshToken();
    if (!refreshToken) return false;

    try {
      // Sử dụng endpoint làm mới token của BFF để đảm bảo tính nhất quán
      const response = await fetch(`${this.baseUrl}/bff/user/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.accessToken && data.refreshToken) {
          TokenManager.setTokens(data.accessToken, data.refreshToken);
          return true;
        }
        return false; // Treat as failure if tokens are missing
      }
      return false;
    } catch {
      return false;
    }
  }

  // BFF-User endpoints
  async register(username: string, email: string, password: string) {
    return this.request<any>("/bff/user/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });
  }

  async verifyOtp(email: string, otp: string) {
    return this.request<any>("/bff/user/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp }),
    });
  }

  async login(email: string, password: string) {
    return this.request<any>("/bff/user/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async logout() {
    return this.request<any>(
      "/bff/user/logout",
      {
        method: "POST",
      },
      true
    );
  }

  async getProfile() {
    return this.request<import("./types").ProfileResponse>("/bff/user/profile", { cache: "no-cache" }, true);
  }

  async updateProfile(data: {
    username?: string;
    firstName?: string;
    lastName?: string;
  }) {
    return this.request<any>(
      "/bff/user/profile",
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
      true
    );
  }

  // BFF-Collection endpoints
  async getPokedex(params?: {
    page?: number;
    limit?: number;
    search?: string;
    group?: string;
    energy_level?: number;
    trainability?: number;
    shedding_level?: number;
    suitable_for?: string;
    sort?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return this.request<any>(
      `/bff/collection/pokedex${query ? `?${query}` : ""}`,
      {},
      false
    );
  }

  async addToCollection(slug: string) {
    return this.request<any>(
      `/bff/collection/add/${slug}`,
      {
        method: "POST",
      },
      true
    );
  }

  async getAchievements(userId?: string) {
    const query = userId ? `?userId=${userId}` : "";
    return this.request<any>(`/bff/collection/achievements${query}`, {}, true);
  }

  async getCollectionStats() {
    return this.request<any>("/bff/collection/stats", {}, true);
  }

  // BFF-Content endpoints
  async getBreedBySlug(slug: string) {
    return this.request<any>(`/bff/content/breed/${slug}`, {}, false);
  }

  async getBreeds() {
    return this.request<any>("/bff/content/breeds", {}, false);
  }

  async uploadMedia(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    // BFF route for media upload requires authentication
    return this.requestWithFormData<any>(
      "/bff/content/media/upload",
      formData,
      true
    );
  }

  // BFF-Prediction endpoints
  async predictImage(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    // Prediction can be done by guests, so requiresAuth is true to *try* and add the token if it exists.
    // The backend uses optionalAuthMiddleware.
    return this.requestWithFormData<any>("/bff/predict/image", formData, true);
  }

  async predictVideo(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return this.requestWithFormData<any>("/bff/predict/video", formData, true);
  }

  async predictBatch(files: File[]) {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    return this.requestWithFormData<any>("/bff/predict/batch", formData, true);
  }

  async submitPredictionFeedback(
    predictionId: string,
    feedback: {
      isCorrect: boolean;
      submittedLabel?: string;
      notes?: string;
    }
  ) {
    return this.request<any>(
      `/bff/predict/${predictionId}/feedback`,
      {
        method: "POST",
        body: JSON.stringify(feedback),
      },
      false
    );
  }

  async getPredictionHistory() {
    return this.request<any>("/bff/predict/history", {}, true);
  }

  // BFF-Admin endpoints
  async getAdminDashboard() {
    return this.request<any>("/bff/admin/dashboard", {}, true);
  }

  async getAdminFeedback() {
    return this.request<any>("/bff/admin/feedback", {}, true);
  }

  async getAdminUsers() {
    return this.request<any>("/bff/admin/users", {}, true);
  }

  async getModelConfig() {
    return this.request<any>("/bff/admin/model/config", {}, true);
  }

  async updateModelConfig(config: any) {
    return this.request<any>(
      "/bff/admin/model/config",
      {
        method: "PUT",
        body: JSON.stringify(config),
      },
      true
    );
  }

  async getAlerts() {
    return this.request<any>("/bff/admin/alerts", {}, true);
  }

  // WebSocket connection methods for real-time detection
  createWebSocketConnection(endpoint: string): WebSocket {
    const wsUrl = API_BASE_URL.replace(/^http/, "ws");
    const token = TokenManager.getAccessToken();

    // Add token as query parameter for WebSocket authentication
    const url = token
      ? `${wsUrl}${endpoint}?token=${token}`
      : `${wsUrl}${endpoint}`;

    return new WebSocket(url);
  }

  // Convenience method for live detection WebSocket
  connectLiveDetection(): WebSocket {
    return this.createWebSocketConnection("/bff/live");
  }

  // Convenience method for stream prediction WebSocket
  connectStreamPrediction(): WebSocket {
    return this.createWebSocketConnection("/bff/predict/stream");
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
