// @ts-nocheck
import { AdminApiClient } from "./admin-api-client";

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
    TokenManager.clearGuestSession();
  },

  clearTokens: () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    TokenManager.setGuestSession();
  },

  hasGuestSession: (): boolean => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem("accessToken");
  },

  setGuestSession: () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.setItem("guestSession", "true");
  },

  clearGuestSession: () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("guestSession");
  },
};


export class ApiClient {
  private baseUrl: string;
  private onTokenUpdate:
    | ((tokens: { remaining: number; limit: number }) => void)
    | null = null;
  private refreshTokenPromise: Promise<boolean> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // THÊM MỚI: Cung cấp một phương thức công khai để lấy baseUrl.
  public getBaseUrl(): string {
    return this.baseUrl;
  }

  // THÊM MỚI: Cung cấp một phương thức công khai để lấy access token.
  public getAccessToken(): string | null {
    return TokenManager.getAccessToken();
  }

  public setTokenUpdateCallback(
    callback: (tokens: { remaining: number; limit: number }) => void
  ) {
    this.onTokenUpdate = callback;
  }
  
  // --- HÀM NÀY ĐƯỢC ĐỊNH NGHĨA Ở ĐÂY ĐỂ FIX LỖI 'this' ---
  private handleTokenHeaders(response: Response | XMLHttpRequest) {
    if (!this.onTokenUpdate) return;
    const getHeader = (name: string) =>
      response instanceof Response
        ? response.headers.get(name)
        : response.getResponseHeader(name);
    let limit = getHeader("X-User-Tokens-Limit");
    let remaining = getHeader("X-User-Tokens-Remaining");
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

  private async handleUnauthorized(): Promise<boolean> {
    if (!this.refreshTokenPromise) {
      this.refreshTokenPromise = this.refreshAccessToken();
    }
    return this.refreshTokenPromise;
  }

  private async refreshAccessToken(): Promise<boolean> {
    const refreshToken = TokenManager.getRefreshToken();
    if (!refreshToken) return false;

    try {
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
      }
      TokenManager.clearTokens();
      return false;
    } catch (error) {
      console.error("[ApiClient] refreshAccessToken: Network or other error during token refresh.", error);
      TokenManager.clearTokens();
      return false;
    } finally {
      this.refreshTokenPromise = null;
    }
  }

  // SỬA LẠI: Hàm request<T> phiên bản đơn giản, không có hàm lồng nhau
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

    let token = TokenManager.getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    } else if (requiresAuth) {
      throw new Error("Token is not provided for an authenticated request.");
    }

    try {
      let response = await fetch(url, { ...options, headers });

      if (response.status === 401 && TokenManager.getRefreshToken()) {
        const refreshed = await this.handleUnauthorized();

        if (refreshed) {
          // Lấy token mới và xây dựng lại header để thử lại
          const newToken = TokenManager.getAccessToken();
          if (newToken) {
            headers["Authorization"] = `Bearer ${newToken}`;
          }
          response = await fetch(url, { ...options, headers }); // Thử lại
        } else {
          throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        }
      }

      this.handleTokenHeaders(response);

      if (!response.ok) {
        if (response.status !== 304) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage =
            errorData.errors?.[0]?.message ||
            errorData.message ||
            `API Error: ${response.status} ${response.statusText}`;
          throw new Error(errorMessage);
        }
      }

      if (response.status === 204) {
        return Promise.resolve(null as T);
      }

      return response.json();
    } catch (error) {
      // BỎ QUA LỖI ABORT: Lỗi này xảy ra khi một request bị hủy bỏ,
      // thường là do component unmount (ví dụ trong React Strict Mode).
      // Đây là hành vi mong muốn, không cần log ra console.
      if (error instanceof Error && error.name === 'AbortError') return Promise.reject(error);

      console.error("[ApiClient] Request failed:", error, `(URL: ${url})`);
      if (error instanceof TypeError && error.message === "Failed to fetch") {
        throw new Error(
          "Network error: Could not connect to the server. Please check your internet connection or contact support."
        );
      }
      if (error instanceof Error) throw error;
      throw new Error("An unexpected error occurred.");
    }
  }

  // SỬA ĐỔI: Hàm requestWithFormData<T>
  private async requestWithFormData<T>(
    endpoint: string,
    formData: FormData,
    requiresAuth = false
  ): Promise<T> {
     const makeRequest = async (isRetry = false): Promise<Response> => {
      const url = new URL(endpoint, this.baseUrl).toString();
      const headers: Record<string, string> = {};

      const token = TokenManager.getAccessToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const options: RequestInit = {
        method: "POST", // Mặc định cho FormData
        body: formData,
        headers: headers,
      };
      
      return fetch(url, options);
    };

    try {
      let response = await makeRequest();

      if (response.status === 401 && TokenManager.getRefreshToken()) {
        const refreshed = await this.handleUnauthorized();
        if (refreshed) {
          response = await makeRequest(true);
        } else {
           TokenManager.clearTokens();
           throw new Error("Authentication failed: Unable to refresh token.");
        }
      }

      this.handleTokenHeaders(response);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.errors?.[0]?.message || errorData.message || `API Error: ${response.status} ${response.statusText}`;
        throw new Error(errorMessage);
      }
      return response.json();

    } catch (error) {
      console.error("[ApiClient] FormData request failed:", error);
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

    console.log("[ApiClient] refreshAccessToken: Attempting to refresh access token.");
    try {
      const response = await fetch(`${this.baseUrl}/bff/user/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.accessToken && data.refreshToken) {
          console.log("[ApiClient] refreshAccessToken: Successfully received new tokens.");
          TokenManager.setTokens(data.accessToken, data.refreshToken);
          return true;
        }
      }
      console.error("[ApiClient] refreshAccessToken: Failed to refresh token, server response not OK or data invalid.");
      TokenManager.clearTokens();
      return false;
    } catch {
      console.error("[ApiClient] refreshAccessToken: Network or other error during token refresh.");
      TokenManager.clearTokens();
      return false;
    } finally {
      this.refreshTokenPromise = null;
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
    const refreshToken = TokenManager.getRefreshToken();

    if (!refreshToken) {
      TokenManager.clearTokens();
      return Promise.resolve({ message: "Logged out locally." });
    }

    try {
      // Gửi yêu cầu logout đến server với refreshToken
      const response = await this.request<any>(
        "/bff/user/logout",
        {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        },
        true // Yêu cầu xác thực để gửi accessToken nếu có
      );
      return response;
    } finally {
      // Quan trọng: Luôn xóa token ở client sau khi gọi API, bất kể thành công hay thất bại.
      TokenManager.clearTokens();
    }
  }

  // THÊM MỚI: Hàm kiểm tra trạng thái phiên làm việc
  async getSessionStatus() {
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
  async getDogDex(params?: {
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
      `/bff/collection/dogdex${query ? `?${query}` : ""}`,
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
      user_submitted_label?: string;
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

  async getChatHistory(
    breedSlug: string
  ): Promise<{ history: { role: "user" | "model"; parts: { text: string }[] }[] }> {
    return this.request<{ history: { role: "user" | "model"; parts: { text: string }[] }[] }>(
      `/bff/predict/chat/${breedSlug}/history`,
      {
        method: "GET",
        cache: "no-cache",
      },
      false // Không yêu cầu xác thực, vì nó có thể được sử dụng bởi khách
    );
  }


  async getHealthRecommendations(
    breedSlug: string,
    lang: "vi" | "en"
  ): Promise<{ recommendations: string }> {
    const headers = { "Accept-Language": lang };
    return this.request<{ recommendations: string }>(
      `/bff/predict/${breedSlug}/health-recommendations`,
      {
        method: "GET",
        headers: headers,
      },
      false
    );
  }

  async getRecommendedProducts(
    breedSlug: string,
    lang: "vi" | "en"
  ): Promise<{ products: import("./types").RecommendedProduct[] }> {
    const headers = { "Accept-Language": lang };
    return this.request<{ products: import("./types").RecommendedProduct[] }>(
      `/bff/predict/${breedSlug}/recommended-products`,
      {
        method: "GET",
        headers: headers,
      },
      false
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

  // THÊM MỚI: Lấy danh sách GIAO DỊCH cho Admin
  async getAdminTransactions(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    planId?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== "")
          queryParams.append(key, String(value));
      });
    }
    const query = queryParams.toString();
    // Giả sử route là /bff/admin/transactions
    return this.request<any>(`/bff/admin/transactions${query ? `?${query}` : ""}`, {}, true);
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

  // THÊM MỚI: Gửi form liên hệ
  async submitContactForm(payload: {
    email: string;
    message: string;
    captchaToken: string;
  }): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      "/bff/public/contact",
      { method: "POST", body: JSON.stringify(payload) },
      false
    );
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

// Tạo một instance riêng cho các API của Admin
export const adminApiClient = new AdminApiClient(apiClient);
