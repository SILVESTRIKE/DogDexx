// @ts-nocheck
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
  // THAY ĐỔI 1: Tạo một callback duy nhất, mạnh mẽ hơn
  private onTokenUpdate:
    | ((tokens: { remaining: number; limit: number }) => void)
    | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // THAY ĐỔI 2: Đổi tên hàm callback để rõ ràng hơn
  public setTokenUpdateCallback(
    callback: (tokens: { remaining: number; limit: number }) => void
  ) {
    this.onTokenUpdate = callback;
  }
  
  private handleTokenHeaders(response: Response | XMLHttpRequest) {
    if (!this.onTokenUpdate) return;

    // Logic lấy header chung cho cả fetch Response và XHR
    const getHeader = (name: string) =>
      response instanceof Response
        ? response.headers.get(name)
        : response.getResponseHeader(name);

    // Ưu tiên đọc header của người dùng đã đăng nhập trước
    let limit = getHeader("X-User-Tokens-Limit");
    let remaining = getHeader("X-User-Tokens-Remaining");

    // Nếu không có, thì đọc header của khách
    if (!limit || !remaining) {
      limit = getHeader("X-Trial-Tokens-Limit");
      remaining = getHeader("X-Trial-Tokens-Remaining");
    }

    if (limit && remaining) {
      this.onTokenUpdate({
        remaining: parseInt(remaining, 10),
        limit: parseInt(limit, 10),
      });
    }
  }

  // SỬA LẠI: Hàm request<T>
  public async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requiresAuth = false
  ): Promise<T> {
    const url = new URL(endpoint, this.baseUrl).toString();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    const token = TokenManager.getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    } else if (requiresAuth) {
      throw new Error("Token is not provided for an authenticated request.");
    }

    try {
      const response = await fetch(url, { ...options, headers });

      this.handleTokenHeaders(response); // <-- GỌI HELPER Ở ĐÂY

      if (response.status === 401 && requiresAuth) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          const newToken = TokenManager.getAccessToken();
          if (newToken) {
            headers["Authorization"] = `Bearer ${newToken}`;
          }
          const retryResponse = await fetch(url, { ...options, headers });

          this.handleTokenHeaders(retryResponse); // <-- GỌI HELPER CHO LẦN RETRY

          if (!retryResponse.ok) {
            const retryErrorData = await retryResponse.json().catch(() => ({}));
            const retryErrorMessage =
              retryErrorData.errors?.[0]?.message ||
              retryErrorData.message ||
              `API Error: ${retryResponse.status} ${retryResponse.statusText} on ${url}`;
            throw new Error(retryErrorMessage);
          }

          return retryResponse.json();
        } else {
          TokenManager.clearTokens();
          throw new Error("Authentication failed: Unable to refresh token.");
        }
      }

      if (!response.ok) {
        if (response.status === 304) {
        } else {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage =
            errorData.errors?.[0]?.message ||
            errorData.message ||
            `API Error: ${response.status} ${response.statusText} on ${url}`;
          throw new Error(errorMessage);
        }
      }

      if (response.status === 204) {
        return Promise.resolve(null as T);
      }

      return response.json();
    } catch (error) {
      console.error("[ApiClient] Request failed:", error, `(URL: ${url})`);
      if (error instanceof TypeError && error.message === "Failed to fetch") {
        throw new Error(
          "Network error: Could not connect to the server. Please check your internet connection or contact support."
        );
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("An unexpected error occurred.");
    }
  }

  private async requestWithFormData<T>(
    endpoint: string,
    formData: FormData,
    requiresAuth = false
  ): Promise<T> {
    const url = new URL(endpoint, this.baseUrl).toString();
    const headers: Record<string, string> = {};

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
      
      this.handleTokenHeaders(response); // <-- GỌI HELPER Ở ĐÂY

      if (response.status === 401 && requiresAuth) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          const newToken = TokenManager.getAccessToken();
          if (newToken) {
            const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
            const retryOptions = { ...options, headers: retryHeaders };
            const retryResponse = await fetch(url, retryOptions);
            
            this.handleTokenHeaders(retryResponse); // <-- GỌI HELPER CHO LẦN RETRY

            if (!retryResponse.ok) {
              const retryErrorData = await retryResponse.json().catch(() => ({}));
              const retryErrorMessage = retryErrorData.errors?.[0]?.message || retryErrorData.message || `API Error: ${retryResponse.status} ${retryResponse.statusText} on ${url}`;
              throw new Error(retryErrorMessage);
            }
            return retryResponse.json();
          }
        }
        TokenManager.clearTokens();
        throw new Error("Authentication failed: Unable to refresh token.");
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.errors?.[0]?.message || errorData.message || `API Error: ${response.status} ${response.statusText} on ${url}`;
        throw new Error(errorMessage);
      }
      return response.json();
    } catch (error) {
      console.error("[ApiClient] FormData request failed:", error, `(URL: ${url})`);
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('Network error: Could not connect to the server. Please check your internet connection or contact support.');
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Something went wrong during the file upload.');
    }
  }

  private async requestWithUploadProgress<T>(
    endpoint: string,
    formData: FormData,
    onProgress: (progress: number) => void,
    requiresAuth = false
  ): Promise<T> {
    return new Promise(async (resolve, reject) => {
        const url = new URL(endpoint, this.baseUrl).toString();
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);

        const token = TokenManager.getAccessToken();
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            onProgress(percentComplete);
          }
        };

        xhr.onload = () => {
          this.handleTokenHeaders(xhr); // <-- GỌI HELPER Ở ĐÂY
          
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch (e) {
              reject(new Error("Failed to parse server response."));
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              const errorMessage = errorData.errors?.[0]?.message || errorData.message || `API Error: ${xhr.status} ${xhr.statusText}`;
              reject(new Error(errorMessage));
            } catch (e) {
              reject(new Error(`API Error: ${xhr.status} ${xhr.statusText}`));
            }
          }
        };

        xhr.onerror = () => {
          reject(new Error("Network error occurred during the upload."));
        };

        xhr.send(formData);
    });
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
  async register(data: {
    username: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    avatar?: File;
  }) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value) formData.append(key, value);
    });
    return this.requestWithFormData<any>("/bff/user/register", formData, false);
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
    // 1. Lấy refreshToken từ TokenManager
    const refreshToken = TokenManager.getRefreshToken();
    // 2. Gửi nó lên trong body của request
    return this.request<any>(
      "/bff/user/logout",
      {
        method: "POST",
        body: JSON.stringify({ refreshToken }), // Thêm body vào đây
      },
      true // Yêu cầu xác thực (để gửi accessToken nếu có)
    );
  }

  // THÊM MỚI: Hàm kiểm tra trạng thái phiên làm việc
  async getSessionStatus() {
    // Sử dụng optionalAuth ở backend, không cần token ở đây
    // Endpoint này sẽ trả về hoặc là profile người dùng, hoặc là trạng thái guest
    return this.request<any>("/bff/user/session-status", {
      cache: "no-cache",
    });
  }

  async getProfile() {
    return this.request<import("./types").ProfileResponse>(
      "/bff/user/profile",
      { cache: "no-cache" },
      true
    );
  }

  async updateProfile(formData: FormData) {
    return this.requestWithFormData<any>("/bff/user/profile", formData, true);
  }

  async updateAvatar(file: File) {
    const formData = new FormData();
    formData.append("avatar", file);
    return this.requestWithFormData<any>("/bff/user/avatar", formData, true);
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
    isCollected?: "true" | "false";
    lang?: "vi" | "en";
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
      !!params?.isCollected // Chỉ yêu cầu xác thực khi lọc theo trạng thái 'collected'
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

  async getAchievements(lang: "vi" | "en") {
    const queryParams = new URLSearchParams();
    queryParams.append("lang", lang);

    return this.request<any>(
      `/bff/collection/achievements?${queryParams.toString()}`,
      {},
      true
    );
  }

  async getCollectionStats() {
    return this.request<any>("/bff/collection/stats", {}, true);
  }

  // BFF-Content endpoints
  async getBreedBySlug(slug: string, lang: "vi" | "en") {
    const queryParams = new URLSearchParams();
    queryParams.append("lang", lang);
    return this.request<any>(
      `/bff/content/breed/${slug}?${queryParams.toString()}`,
      {},
      false
    );
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
  async predictImage(file: File, onProgress: (p: number) => void) {
    const formData = new FormData();
    formData.append("file", file);
    // SỬA LỖI: Chỉ yêu cầu xác thực khi người dùng đã đăng nhập (có token)
    const requiresAuth = !!TokenManager.getAccessToken();
    return this.requestWithUploadProgress<any>(
      "/bff/predict/image",
      formData,
      onProgress,
      requiresAuth
    );
  }

  async predictVideo(file: File, onProgress: (p: number) => void) {
    const formData = new FormData();
    formData.append("file", file);
    // SỬA LỖI: Chỉ yêu cầu xác thực khi người dùng đã đăng nhập (có token)
    const requiresAuth = !!TokenManager.getAccessToken();
    return this.requestWithUploadProgress<any>(
      "/bff/predict/video",
      formData,
      onProgress,
      requiresAuth
    );
  }

  async predictBatch(files: File[]) {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    return this.requestWithFormData<any>("/bff/predict/batch", formData, true); // Giữ lại true vì batch thường là tính năng cho user
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

  async chatWithBreed(
    breedSlug: string,
    message: string,
    lang: "vi" | "en"
  ): Promise<{ reply: string; initialMessage?: string }> {
    const headers = { "Accept-Language": lang };
    return this.request<{ reply: string; initialMessage?: string }>(
      `/bff/predict/chat/${breedSlug}`,
      {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ message }),
      },
      false // Không yêu cầu xác thực, vì nó có thể được sử dụng bởi khách
    );
  }

  async getPredictionHistory(params?: { page?: number; limit?: number }) {
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
      `/bff/predict/history${query ? `?${query}` : ""}`,
      {},
      true
    );
  }

  // ----- MODIFIED: HÀM MỚI ĐƯỢC THÊM VÀO ĐÂY -----
  async getPredictionHistoryById(
    id: string,
    lang: "vi" | "en"
  ): Promise<import("./types").BffPredictionResponse> {
    const queryParams = new URLSearchParams();
    queryParams.append("lang", lang);
    return this.request<import("./types").BffPredictionResponse>(
      `/bff/predict/history/${id}?${queryParams.toString()}`,
      {
        method: "GET",
      },
      false // Để public, ai có link cũng xem được
    );
  }
  // --------------------------------------------------

  async deletePredictionHistory(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      `/bff/predict/history/${id}`,
      {
        method: "DELETE",
      },
      true
    );
  }

  // Analytics endpoint
  async trackVisit(page: string) {
    return this.request<void>(
      "/api/analytics/track-visit",
      {
        method: "POST",
        body: JSON.stringify({ page }),
      },
      false // Sử dụng optionalAuth ở backend, không yêu cầu auth bắt buộc ở client
    );
  }

  /**
   * Ghi nhận một sự kiện tùy chỉnh (ví dụ: dự đoán thành công).
   * @param eventName Tên của sự kiện
   * @param eventData Dữ liệu bổ sung liên quan đến sự kiện
   */
  async trackEvent(eventName: string, eventData?: Record<string, any>) {
    return this.request<void>(
      "/api/analytics/track-event",
      {
        method: "POST",
        body: JSON.stringify({ eventName, eventData }),
      },
      false // Không yêu cầu auth bắt buộc
    );
  }
  // BFF-Admin endpoints
  async getAdminDashboard() {
    return this.request<any>("/bff/admin/dashboard", {}, true);
  }

  async getAdminFeedback(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, String(value));
      });
    }
    const query = queryParams.toString();
    return this.request<any>(
      `/bff/admin/feedback${query ? `?${query}` : ""}`,
      {},
      true
    );
  }

  async adminApproveFeedback(feedbackId: string) {
    return this.request<any>(
      `/bff/admin/feedback/${feedbackId}/approve`,
      {
        method: "POST",
      },
      true
    );
  }

  async adminRejectFeedback(feedbackId: string) {
    return this.request<any>(
      `/bff/admin/feedback/${feedbackId}/reject`,
      {
        method: "POST",
      },
      true
    );
  }

  async getAdminUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== "")
          queryParams.append(key, String(value));
      });
    }
    const query = queryParams.toString();
    return this.request<any>(
      `/bff/admin/users${query ? `?${query}` : ""}`,
      {},
      true
    );
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

  async getAdminUsageStats() {
    return this.request<any>("/bff/admin/usage", {}, true);
  }

  async getAdminHistories(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== "")
          queryParams.append(key, String(value));
      });
    }
    const query = queryParams.toString();
    return this.request<any>(
      `/bff/admin/histories${query ? `?${query}` : ""}`,
      {},
      true
    );
  }

  async browseAdminHistories(
    path: string,
    params?: { breed?: string; startDate?: string; endDate?: string }
  ) {
    const queryParams = new URLSearchParams();
    if (path) queryParams.append("path", path);
    if (params?.breed && params.breed !== "all")
      queryParams.append("breed", params.breed);
    if (params?.startDate) queryParams.append("startDate", params.startDate);
    if (params?.endDate) queryParams.append("endDate", params.endDate);
    return this.request<any>(
      `/bff/admin/histories/browse?${queryParams.toString()}`,
      {},
      true
    );
  }

  async browseAdminMedia(path: string, options: RequestInit = {}) {
    const queryParams = new URLSearchParams();
    if (path) queryParams.append("path", path);
    return this.request<any>(
      `/bff/admin/media/browse?${queryParams.toString()}`,
      options,
      true
    );
  }

  async adminDeleteMedia(mediaId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      `/bff/admin/media/${mediaId}`,
      {
        method: "DELETE",
      },
      true
    );
  }

  // Core User Management (Admin)
  async deleteUser(userId: string) {
    return this.request<void>(
      `/api/users/${userId}`,
      { method: "DELETE" },
      true
    );
  }

  async adminCreateUser(data: {
    username: string;
    email: string;
    password: string;
    role: string;
    verify: string;
  }) {
    return this.request<any>(
      "/bff/admin/users",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      true
    );
  }

  async adminUpdateUser(
    userId: string,
    data: { username?: string; email?: string; role?: string; status?: string }
  ) {
    return this.request<any>(
      `/bff/admin/users/${userId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
      true
    );
  }

  async adminUploadModel(formData: FormData) {
    return this.requestWithFormData<any>(
      "/bff/admin/models/upload",
      formData,
      true
    );
  }

  // Core AI Model Management (Admin)
  async getAIModels() {
    return this.request<any>("/api/ai-models", {}, true);
  }

  async activateAIModel(modelId: string) {
    return this.request<any>(
      `/api/ai-models/${modelId}/activate`,
      {
        method: "POST",
      },
      true
    );
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

  // Subscription endpoints
  async createCheckoutSession(
    planId: string,
    billingPeriod: "monthly" | "yearly"
  ) {
    return this.request<any>(
      "/bff/user/create-checkout-session",
      {
        method: "POST",
        body: JSON.stringify({ planId, billingPeriod }),
      },
      true
    );
  }

  // THÊM MỚI: Lấy danh sách các gói cước công khai
  async getPublicPlans() {
    return this.request<any>(
      "/bff/public/plans",
      {},
      false // Endpoint này là public
    );
  }

  // THÊM MỚI: Lấy chi tiết một gói cước công khai bằng slug
  async getPublicPlanBySlug(slug: string) {
    return this.request<any>(
      `/bff/public/plans/${slug}`,
      {},
      false // Endpoint này là public
    );
  }

  // THÊM MỚI: Các hàm quản lý Plan cho Admin
  async getAdminPlans(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== "")
          queryParams.append(key, String(value));
      });
    }
    const query = queryParams.toString();
    return this.request<any>(
      `/bff/admin/plans${query ? `?${query}` : ""}`,
      {},
      true
    );
  }

  async createAdminPlan(planData: any) {
    return this.request<any>(
      "/bff/admin/plans",
      { method: "POST", body: JSON.stringify(planData) },
      true
    );
  }

  async updateAdminPlan(planId: string, planData: any) {
    return this.request<any>(
      `/bff/admin/plans/${planId}`,
      { method: "PUT", body: JSON.stringify(planData) },
      true
    );
  }

  async deleteAdminPlan(planId: string) {
    return this.request<any>(
      `/bff/admin/plans/${planId}`,
      { method: "DELETE" },
      true
    );
  }

  async getAdminSubscriptions(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== "")
          queryParams.append(key, String(value));
      });
    }
    const query = queryParams.toString();
    return this.request<any>(
      `/bff/admin/subscriptions${query ? `?${query}` : ""}`,
      {},
      true
    );
  }

  async approveUserSubscription(subscriptionId: string) {
    return this.request<any>(
      `/bff/admin/subscriptions/${subscriptionId}/approve`,
      {
        method: "POST",
      },
      true
    );
  }
  async rejectUserSubscription(subscriptionId: string) {
    return this.request<any>(
      `/bff/admin/subscriptions/${subscriptionId}/reject`,
      {
        method: "POST",
      },
      true
    );
  }
  async updateUserSubscription(
    subscriptionId: string,
    data: { planSlug?: string; status?: string }
  ) {
    return this.request<any>(
      `/bff/admin/subscriptions/${subscriptionId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
      true
    );
  }
  async cancelUserSubscription(subscriptionId: string) {
    return this.request<any>(
      `/bff/admin/subscriptions/${subscriptionId}/cancel`,
      {
        method: "POST",
      },
      true
    );
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
