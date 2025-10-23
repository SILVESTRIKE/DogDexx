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
      } catch (error: any) {
        console.error("Failed to ping server for guest session:", error);
        // Cải thiện xử lý lỗi cho các lỗi mạng
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
          throw new Error('Network error: Could not connect to the backend server to create a guest session.');
        }
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

  public async request<T>(
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
    } else if (requiresAuth) {
      throw new Error("Token is not provided for an authenticated request.");
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
              retryErrorData.message || `API Error: ${retryResponse.status} ${retryResponse.statusText} on ${url}`;
            throw new Error(retryErrorMessage);
          }

          return retryResponse.json();
        } else {
          // Refresh failed, clear tokens and throw
          TokenManager.clearTokens();
          // Ném lỗi xác thực cụ thể, sẽ được bắt ở AuthContext để xử lý Logout.
          // Thêm thông tin về việc refresh token thất bại.
          throw new Error("Authentication failed: Unable to refresh token.");
        }
      }

      if (!response.ok) {
        if (response.status === 304) {
        } else {
            const errorData = await response.json().catch(() => ({})); // { success: false, errors: [{ message: '...' }] }
            // Lấy message từ lỗi đầu tiên trong mảng errors, hoặc fallback về message chung
            const errorMessage =
              errorData.errors?.[0]?.message ||
              errorData.message || `API Error: ${response.status} ${response.statusText} on ${url}`;
            throw new Error(errorMessage);
        }
      }
      
      // Xử lý 204 No Content (thường là từ các request DELETE), không có body để parse.
      if (response.status === 204) {
        return Promise.resolve(null as T);
      }
      
      // Đối với 200 OK hoặc 304 Not Modified, trình duyệt sẽ cung cấp body (mới hoặc từ cache)
      // nên chúng ta có thể gọi .json() một cách an toàn.
      return response.json();
    } catch (error) {
      console.error("[ApiClient] Request failed:", error, `(URL: ${url})`);

      // Cải thiện thông báo lỗi cho các lỗi mạng
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('Network error: Could not connect to the server. Please check your internet connection or contact support.');
      }

      // Ném lại lỗi gốc nếu nó đã là một Error object với message rõ ràng
      if (error instanceof Error) {
        throw error;
      }

      // Fallback cho các trường hợp khác
      throw new Error('An unexpected error occurred.');
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
                retryErrorData.message || `API Error: ${retryResponse.status} ${retryResponse.statusText} on ${url}`;
              throw new Error(retryErrorMessage);
            }

            return retryResponse.json();
          }
        }

        // nếu refresh token thất bại
        TokenManager.clearTokens();
        throw new Error("Authentication failed: Unable to refresh token.");
      }

      // nếu response không ok
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.errors?.[0]?.message || errorData.message || `API Error: ${response.status} ${response.statusText} on ${url}`;
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error) {
      console.error("[ApiClient] FormData request failed:", error, `(URL: ${url})`);
      
      // Cải thiện logic xử lý lỗi để cung cấp thông báo chi tiết hơn
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('Network error: Could not connect to the server. Please check your internet connection or contact support.');
      }

      if (error instanceof Error) {
        throw error;
      }
      // Fallback cho các trường hợp khác
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

      // Đảm bảo guest session (nếu cần)
      await this.ensureGuestSession().catch(reject);

      // Đính kèm token
      const token = TokenManager.getAccessToken();
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      } else if (requiresAuth) {
        return reject(new Error("Token is not provided for an authenticated request."));
      }

      // Theo dõi tiến trình upload
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      };

      // Xử lý khi hoàn thành
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const jsonResponse = JSON.parse(xhr.responseText);
            resolve(jsonResponse);
          } catch (e) {
            reject(new Error("Failed to parse server response."));
          }
        } else {
          // Xử lý lỗi tương tự như trong hàm request()
          try {
            const errorData = JSON.parse(xhr.responseText);
            const errorMessage = errorData.errors?.[0]?.message || errorData.message || `API Error: ${xhr.status} ${xhr.statusText}`;
            reject(new Error(errorMessage));
          } catch (e) {
            reject(new Error(`API Error: ${xhr.status} ${xhr.statusText}`));
          }
        }
      };

      // Xử lý lỗi mạng
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

  async getProfile() {
    return this.request<import("./types").ProfileResponse>("/bff/user/profile", { cache: "no-cache" }, true);
  }

  async updateProfile(formData: FormData) {
    return this.requestWithFormData<any>(
      "/bff/user/profile",
      formData,
      true
    );
  }

  async updateAvatar(file: File) {
    const formData = new FormData();
    formData.append("avatar", file);
    return this.requestWithFormData<any>(
      "/bff/user/avatar",
      formData,
      true);
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
    isCollected?: 'true' | 'false';
    lang?: 'vi' | 'en';
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

  async getAchievements(lang: 'vi' | 'en') {
    const queryParams = new URLSearchParams();
    queryParams.append('lang', lang);

    return this.request<any>(`/bff/collection/achievements?${queryParams.toString()}`, {}, true);
  }

  async getCollectionStats() {
    return this.request<any>("/bff/collection/stats", {}, true);
  }

  // BFF-Content endpoints
  async getBreedBySlug(slug: string, lang: 'vi' | 'en') {
    const queryParams = new URLSearchParams();
    queryParams.append('lang', lang);
    return this.request<any>(`/bff/content/breed/${slug}?${queryParams.toString()}`, {}, false);
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

  async chatWithBreed(breedSlug: string, message: string, lang: 'vi' | 'en'): Promise<{ reply: string; initialMessage?: string }> {
    const headers = { 'Accept-Language': lang };
    return this.request<{ reply: string; initialMessage?: string }>(
      `/bff/predict/chat/${breedSlug}`,
      {
        method: 'POST',
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
      `/bff/predict/history${query ? `?${query}` : ""}`, {}, true
    );
  }
  
  // ----- MODIFIED: HÀM MỚI ĐƯỢC THÊM VÀO ĐÂY -----
  async getPredictionHistoryById(id:string, lang: 'vi' | 'en'): Promise<import("./types").BffPredictionResponse> {
    const queryParams = new URLSearchParams();
    queryParams.append('lang', lang);
    return this.request<import("./types").BffPredictionResponse>(
        `/bff/predict/history/${id}?${queryParams.toString()}`,
        {
            method: 'GET',
        },
        false // Để public, ai có link cũng xem được
    );
  }
  // --------------------------------------------------

  async deletePredictionHistory(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      `/bff/predict/history/${id}`,
      {
        method: 'DELETE',
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

  async getAdminFeedback(params?: { page?: number; limit?: number; status?: string; search?: string }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, String(value));
      });
    }
    const query = queryParams.toString();
    return this.request<any>(`/bff/admin/feedback${query ? `?${query}` : ""}`, {}, true);
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

  async getAdminUsers(params?: { page?: number; limit?: number; search?: string }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== "") queryParams.append(key, String(value));
      });
    }
    const query = queryParams.toString();
    return this.request<any>(`/bff/admin/users${query ? `?${query}` : ""}`, {}, true);
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

  async getAdminHistories(params?: { page?: number; limit?: number; search?: string }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== "") queryParams.append(key, String(value));
      });
    }
    const query = queryParams.toString();
    return this.request<any>(`/bff/admin/histories${query ? `?${query}` : ""}`, {}, true);
  }

  async browseAdminHistories(path: string, params?: { breed?: string, startDate?: string, endDate?: string }) {
    const queryParams = new URLSearchParams();
    if (path) queryParams.append('path', path);
    if (params?.breed && params.breed !== 'all') queryParams.append('breed', params.breed);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    return this.request<any>(`/bff/admin/histories/browse?${queryParams.toString()}`, {}, true);
  }

  async browseAdminMedia(path: string, options: RequestInit = {}) {
    const queryParams = new URLSearchParams();
    if (path) queryParams.append('path', path);
    return this.request<any>(`/bff/admin/media/browse?${queryParams.toString()}`, options, true);
  }

  async adminDeleteMedia(mediaId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      `/bff/admin/media/${mediaId}`,
      {
        method: 'DELETE',
      },
      true
    );
  }

  // Core User Management (Admin)
  async deleteUser(userId: string) {
    return this.request<void>(`/api/users/${userId}`, { method: 'DELETE' }, true);
  }

  async adminCreateUser(data: { username: string; email: string; password: string; role: string, verify: string }) {
    return this.request<any>(
      "/bff/admin/users",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      true
    );
  }

  async adminUpdateUser(userId: string, data: { username?: string; email?: string; role?: string, status?: string }) {
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
    return this.requestWithFormData<any>("/bff/admin/models/upload", formData, true);
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
  async createCheckoutSession(planId: string, billingPeriod: "monthly" | "yearly") {
    return this.request<any>(
      "/bff/user/create-checkout-session",
      {
        method: "POST",
        body: JSON.stringify({ planId, billingPeriod }),
      },
      true
    );
  }

  async getAdminSubscriptions(params?: { page?: number; limit?: number; search?: string }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== "") queryParams.append(key, String(value));
      });
    }
    const query = queryParams.toString();
    return this.request<any>(`/bff/admin/subscriptions${query ? `?${query}` : ""}`, {}, true);
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
  async updateUserSubscription(subscriptionId: string, data: { planSlug?: string; status?: string }) {
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