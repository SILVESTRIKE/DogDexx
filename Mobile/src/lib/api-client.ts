// @ts-nocheck
import { AdminApiClient } from './admin-api-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://dogdex-api-backend.onrender.com';

// Token management
export const TokenManager = {
  getAccessToken: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem('accessToken');
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  },

  getRefreshToken: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem('refreshToken');
    } catch (error) {
      console.error('Error getting refresh token:', error);
      return null;
    }
  },

  setTokens: async (accessToken: string, refreshToken: string) => {
    try {
      await AsyncStorage.setItem('accessToken', accessToken);
      await AsyncStorage.setItem('refreshToken', refreshToken);
      // Khi người dùng đăng nhập, họ không còn là khách nữa.
      await TokenManager.clearGuestSession();
    } catch (error) {
      console.error('Error setting tokens:', error);
    }
  },

  clearTokens: async () => {
    try {
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  },

  hasGuestSession: async (): Promise<boolean> => {
    try {
      const value = await AsyncStorage.getItem('guestSession');
      return value === 'true';
    } catch (error) {
      console.error('Error checking guest session:', error);
      return false;
    }
  },

  setGuestSession: async () => {
    try {
      await AsyncStorage.setItem('guestSession', 'true');
    } catch (error) {
      console.error('Error setting guest session:', error);
    }
  },

  clearGuestSession: async () => {
    try {
      await AsyncStorage.removeItem('guestSession');
    } catch (error) {
      console.error('Error clearing guest session:', error);
    }
  },
};
// API Client with automatic token refresh
export class ApiClient {
  private baseUrl: string;
  // THAY ĐỔI 1: Tạo một callback duy nhất, mạnh mẽ hơn
  private onTokenUpdate:
    | ((tokens: { remaining: number; limit: number }) => void)
    | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
  async getHealthRecommendations(
    breedSlug: string,
    lang: 'vi' | 'en',
  ): Promise<{ recommendations: string }> {
    const headers = { 'Accept-Language': lang };
    return this.request<{ recommendations: string }>(
      `/bff/predict/${breedSlug}/health-recommendations`,
      {
        method: 'GET',
        headers: headers,
      },
      false,
    );
  }

  async getRecommendedProducts(
    breedSlug: string,
    lang: 'vi' | 'en',
  ): Promise<{ products: import('./types').RecommendedProduct[] }> {
    const headers = { 'Accept-Language': lang };
    return this.request<{ products: import('./types').RecommendedProduct[] }>(
      `/bff/predict/${breedSlug}/recommended-products`,
      {
        method: 'GET',
        headers: headers,
      },
      false,
    );
  }

  // THAY ĐỔI 2: Đổi tên hàm callback để rõ ràng hơn
  public setTokenUpdateCallback(
    callback: (tokens: { remaining: number; limit: number }) => void,
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
    let limit = getHeader('X-User-Tokens-Limit');
    let remaining = getHeader('X-User-Tokens-Remaining');

    // Nếu không có, thì đọc header của khách
    if (!limit || !remaining) {
      limit = getHeader('X-Trial-Tokens-Limit');
      remaining = getHeader('X-Trial-Tokens-Remaining');
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
    const headers: Record<string, string> = { ...options.headers };

    // KHÔNG set Content-Type nếu body là FormData, trình duyệt sẽ tự làm.
    // Nếu không, nó sẽ bị thiếu 'boundary' và request sẽ bị treo.
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    let token = await TokenManager.getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    } else if (requiresAuth) {
      throw new Error("Token is not provided for an authenticated request.");
    }

    try {
      let response = await fetch(url, { ...options, headers });

      if (response.status === 401 && await TokenManager.getRefreshToken()) {
        const refreshed = await this.handleUnauthorized();

        if (refreshed) {
          // Lấy token mới và xây dựng lại header để thử lại
          const newToken = await TokenManager.getAccessToken();
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

   private async requestWithFormData<T>(
    endpoint: string,
    formData: FormData,
    requiresAuth = false
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: formData,
    }, requiresAuth);
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

        const token = await TokenManager.getAccessToken();
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
    const refreshToken = await TokenManager.getRefreshToken();
    if (!refreshToken) return false;

    try {
      // Sử dụng endpoint làm mới token của BFF để đảm bảo tính nhất quán
      const response = await fetch(`${this.baseUrl}/bff/user/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.accessToken && data.refreshToken) {
         await TokenManager.setTokens(data.accessToken, data.refreshToken);
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
    return this.requestWithFormData<any>('/bff/user/register', formData, false);
  }

  async verifyOtp(email: string, otp: string) {
    return this.request<any>('/bff/user/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  }

  async login(email: string, password: string) {
    return this.request<any>('/bff/user/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout() {
    // 1. Lấy refreshToken từ TokenManager
    const refreshToken = await TokenManager.getRefreshToken();
    // 2. Gửi nó lên trong body của request
    return this.request<any>(
      '/bff/user/logout',
      {
        method: 'POST',
        body: JSON.stringify({ refreshToken }), // Thêm body vào đây
      },
      true, // Yêu cầu xác thực (để gửi accessToken nếu có)
    );
  }

  // THÊM MỚI: Hàm kiểm tra trạng thái phiên làm việc
  async getSessionStatus() {
    // Sử dụng optionalAuth ở backend, không cần token ở đây
    // Endpoint này sẽ trả về hoặc là profile người dùng, hoặc là trạng thái guest
    return this.request<any>('/bff/user/session-status', {
      cache: 'no-cache',
    });
  }

  async getProfile() {
    return this.request<import('./types').ProfileResponse>(
      '/bff/user/profile',
      { cache: 'no-cache' },
      true,
    );
  }

  async updateProfile(formData: FormData) {
    return this.requestWithFormData<any>('/bff/user/profile', formData, true);
  }

  async updateAvatar(file: File) {
    const formData = new FormData();
    formData.append('avatar', file);
    return this.requestWithFormData<any>('/bff/user/avatar', formData, true);
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
      `/bff/collection/dogdex${query ? `?${query}` : ''}`,
      {},
      !!params?.isCollected, // Chỉ yêu cầu xác thực khi lọc theo trạng thái 'collected'
    );
  }

  async addToCollection(slug: string) {
    return this.request<any>(
      `/bff/collection/add/${slug}`,
      {
        method: 'POST',
      },
      true,
    );
  }

  async getAchievements(lang: 'vi' | 'en') {
    const queryParams = new URLSearchParams();
    queryParams.append('lang', lang);

    return this.request<any>(
      `/bff/collection/achievements?${queryParams.toString()}`,
      {},
      true,
    );
  }

  async getCollectionStats() {
    return this.request<any>('/bff/collection/stats', {}, true);
  }

  // BFF-Content endpoints
  async getBreedBySlug(slug: string, lang: 'vi' | 'en') {
    const queryParams = new URLSearchParams();
    queryParams.append('lang', lang);
    return this.request<any>(
      `/bff/content/breed/${slug}?${queryParams.toString()}`,
      {},
      false,
    );
  }

  async getBreeds() {
    return this.request<any>('/bff/content/breeds', {}, false);
  }

  async uploadMedia(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    // BFF route for media upload requires authentication
    return this.requestWithFormData<any>(
      '/bff/content/media/upload',
      formData,
      true,
    );
  }

  // BFF-Prediction endpoints
  async predictImage(formData: FormData, onProgress: (p: number) => void) {
    const requiresAuth = await TokenManager.getAccessToken();
    return this.requestWithUploadProgress<any>(
      '/bff/predict/image',
      formData,
      onProgress,
      requiresAuth,
    );
  }

  async predictVideo(formData: FormData, onProgress: (p: number) => void) {
    // const formData = new FormData();
    // formData.append("file", file);
    // SỬA LỖI: Chỉ yêu cầu xác thực khi người dùng đã đăng nhập (có token)
    const requiresAuth = !!await TokenManager.getAccessToken();
    return this.requestWithUploadProgress<any>(
      '/bff/predict/video',
      formData,
      onProgress,
      requiresAuth,
    );
  }

  async predictBatch(files: File[]) {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    return this.requestWithFormData<any>('/bff/predict/batch', formData, true); // Giữ lại true vì batch thường là tính năng cho user
  }

  async submitPredictionFeedback(
    predictionId: string,
    feedback: {
      isCorrect: boolean;
      user_submitted_label?: string;
      notes?: string;
    },
  ) {
    return this.request<any>(
      `/bff/predict/${predictionId}/feedback`,
      {
        method: 'POST',
        body: JSON.stringify(feedback),
      },
      false,
    );
  }

  async chatWithBreed(
    breedSlug: string,
    message: string,
    lang: 'vi' | 'en',
  ): Promise<{ reply: string; initialMessage?: string }> {
    const headers = { 'Accept-Language': lang };
    return this.request<{ reply: string; initialMessage?: string }>(
      `/bff/predict/chat/${breedSlug}`,
      {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ message }),
      },
      false, // Không yêu cầu xác thực, vì nó có thể được sử dụng bởi khách
    );
  }
  async getChatHistory(breedSlug: string): Promise<{
    history: { role: 'user' | 'model'; parts: { text: string }[] }[];
  }> {
    return this.request<{
      history: { role: 'user' | 'model'; parts: { text: string }[] }[];
    }>(
      `/bff/predict/chat/${breedSlug}/history`,
      {
        method: 'GET',
        cache: 'no-cache',
      },
      false, // Không yêu cầu xác thực, vì nó có thể được sử dụng bởi khách
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
      `/bff/predict/history${query ? `?${query}` : ''}`,
      {},
      true,
    );
  }
  

  // ----- MODIFIED: HÀM MỚI ĐƯỢC THÊM VÀO ĐÂY -----
  async getPredictionHistoryById(
    id: string,
    lang: 'vi' | 'en',
  ): Promise<import('./types').BffPredictionResponse> {
    const queryParams = new URLSearchParams();
    queryParams.append('lang', lang);
    return this.request<import('./types').BffPredictionResponse>(
      `/bff/predict/history/${id}?${queryParams.toString()}`,
      {
        method: 'GET',
      },
      false, // Để public, ai có link cũng xem được
    );
  }
  // --------------------------------------------------

  async deletePredictionHistory(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      `/bff/predict/history/${id}`,
      {
        method: 'DELETE',
      },
      true,
    );
  }

  // Analytics endpoint
  async trackVisit(page: string) {
    return this.request<void>(
      '/api/analytics/track-visit',
      {
        method: 'POST',
        body: JSON.stringify({ page }),
      },
      false, // Sử dụng optionalAuth ở backend, không yêu cầu auth bắt buộc ở client
    );
  }

  /**
   * Ghi nhận một sự kiện tùy chỉnh (ví dụ: dự đoán thành công).
   * @param eventName Tên của sự kiện
   * @param eventData Dữ liệu bổ sung liên quan đến sự kiện
   */
  async trackEvent(eventName: string, eventData?: Record<string, any>) {
    return this.request<void>(
      '/api/analytics/track-event',
      {
        method: 'POST',
        body: JSON.stringify({ eventName, eventData }),
      },
      false, // Không yêu cầu auth bắt buộc
    );
  }

  // WebSocket connection methods for real-time detection
  async createWebSocketConnection(endpoint: string): WebSocket {
    const wsUrl = API_BASE_URL.replace(/^http/, 'ws');
    const token = await TokenManager.getAccessToken();

    // Add token as query parameter for WebSocket authentication
    const url = token
      ? `${wsUrl}${endpoint}?token=${token}`
      : `${wsUrl}${endpoint}`;

    return new WebSocket(url);
  }
  async createWebSocketConnection1(endpoint: string): WebSocket {
    const wsUrl = API_BASE_URL.replace(/^http/, 'ws');
    const token = await TokenManager.getAccessToken(); // ✅ bây giờ hợp lệ

    const url = token
      ? `${wsUrl}${endpoint}?token=${token}`
      : `${wsUrl}${endpoint}`;

    return new WebSocket(url);
  }
  

  // Convenience method for live detection WebSocket
  connectLiveDetection(): WebSocket {
    return this.createWebSocketConnection('/bff/live');
  }

  // Convenience method for stream prediction WebSocket
  connectStreamPrediction(): WebSocket {
    return this.createWebSocketConnection('/bff/predict/stream');
  }
  connectStreamPrediction1(): WebSocket {
    return this.createWebSocketConnection1('/bff/predict/stream');
  }

  // Subscription endpoints
  async createCheckoutSession(
    planId: string,
    billingPeriod: 'monthly' | 'yearly',
  ) {
    return this.request<any>(
      '/bff/user/create-checkout-session',
      {
        method: 'POST',
        body: JSON.stringify({ planId, billingPeriod }),
      },
      true,
    );
  }

  // THÊM MỚI: Lấy danh sách các gói cước công khai
  async getPublicPlans() {
    return this.request<any>(
      '/bff/public/plans',
      {},
      false, // Endpoint này là public
    );
  }

  // THÊM MỚI: Lấy chi tiết một gói cước công khai bằng slug
  async getPublicPlanBySlug(slug: string) {
    return this.request<any>(
      `/bff/public/plans/${slug}`,
      {},
      false, // Endpoint này là public
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
        if (value !== undefined && value !== '')
          queryParams.append(key, String(value));
      });
    }
    const query = queryParams.toString();
    return this.request<any>(
      `/bff/admin/plans${query ? `?${query}` : ''}`,
      {},
      true,
    );
  }

  async createAdminPlan(planData: any) {
    return this.request<any>(
      '/bff/admin/plans',
      { method: 'POST', body: JSON.stringify(planData) },
      true,
    );
  }

  async updateAdminPlan(planId: string, planData: any) {
    return this.request<any>(
      `/bff/admin/plans/${planId}`,
      { method: 'PUT', body: JSON.stringify(planData) },
      true,
    );
  }

  async deleteAdminPlan(planId: string) {
    return this.request<any>(
      `/bff/admin/plans/${planId}`,
      { method: 'DELETE' },
      true,
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
        if (value !== undefined && value !== '')
          queryParams.append(key, String(value));
      });
    }
    const query = queryParams.toString();
    return this.request<any>(
      `/bff/admin/subscriptions${query ? `?${query}` : ''}`,
      {},
      true,
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
        if (value !== undefined && value !== '')
          queryParams.append(key, String(value));
      });
    }
    const query = queryParams.toString();
    // Giả sử route là /bff/admin/transactions
    return this.request<any>(
      `/bff/admin/transactions${query ? `?${query}` : ''}`,
      {},
      true,
    );
  }

  async approveUserSubscription(subscriptionId: string) {
    return this.request<any>(
      `/bff/admin/subscriptions/${subscriptionId}/approve`,
      {
        method: 'POST',
      },
      true,
    );
  }
  async rejectUserSubscription(subscriptionId: string) {
    return this.request<any>(
      `/bff/admin/subscriptions/${subscriptionId}/reject`,
      {
        method: 'POST',
      },
      true,
    );
  }
  async updateUserSubscription(
    subscriptionId: string,
    data: { planSlug?: string; status?: string },
  ) {
    return this.request<any>(
      `/bff/admin/subscriptions/${subscriptionId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      true,
    );
  }
  async deleteCurrentUser() {
    return this.request<any>("/bff/user/profile", {
      method: "DELETE",
    }, true);
  }
  async cancelUserSubscription(subscriptionId: string) {
    return this.request<any>(
      `/bff/admin/subscriptions/${subscriptionId}/cancel`,
      {
        method: 'POST',
      },
      true,
    );
  }
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
