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

  // --- Dog Management ---
  async createDog(data: any) {
    if (data instanceof FormData) {
      return this.requestWithFormData<any>("/bff/dog", data, true);
    }
    return this.request<any>(
      "/bff/dog",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      true
    );
  }

  async getMyDogs() {
    return this.request<any>("/bff/dog/my-dogs", {}, true);
  }

  async getDog(id: string) {
    return this.request<any>(`/bff/dog/${id}`, {}, true);
  }

  async updateDog(id: string, data: any) {
    return this.request<any>(`/bff/dog/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }, true);
  }

  async deleteDog(id: string) {
    return this.request<any>(`/bff/dog/${id}`, {
      method: "DELETE",
    }, true);
  }

  async addHealthRecord(dogId: string, data: any) {
    // If data contains files (attachments), use FormData
    if (data.attachments && data.attachments.length > 0 && data.attachments[0] instanceof File) {
      const formData = new FormData();
      // Append basic fields
      Object.keys(data).forEach(key => {
        if (key !== 'attachments' && data[key] !== undefined && data[key] !== null) {
          formData.append(key, String(data[key]));
        }
      });
      // Append files
      data.attachments.forEach((file: File) => {
        formData.append('files', file);
      });

      return this.requestWithFormData<any>(`/bff/dog/${dogId}/health`, formData, true);
    }

    // JSON Fallback (if no files)
    return this.request<any>(`/bff/dog/${dogId}/health`, {
      method: "POST",
      body: JSON.stringify(data),
    }, true);
  }

  async updateHealthRecord(recordId: string, data: any) {
    if (data.newAttachments && data.newAttachments.length > 0) {
      const formData = new FormData();
      Object.keys(data).forEach(key => {
        if (key !== 'newAttachments' && data[key] !== undefined && data[key] !== null) {
          // Handle basic fields. If passing arrays/objects, strictly stringify or handle on backend.
          // Assuming simple fields for now.
          formData.append(key, String(data[key]));
        }
      });

      data.newAttachments.forEach((file: File) => {
        formData.append('files', file);
      });

      return this.requestWithFormData<any>(`/bff/dog/health/${recordId}`, formData, true, "PUT"); // Need to support PUT in requestWithFormData or just use custom
    }

    return this.request<any>(`/bff/dog/health/${recordId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }, true);
  }

  async deleteHealthRecord(recordId: string) {
    return this.request<any>(`/bff/dog/health/${recordId}`, {
      method: "DELETE",
    }, true);
  }

  async getHealthRecords(dogId: string) {
    return this.request<any>(`/bff/dog/${dogId}/health`, {}, true);
  }

  async searchLostDogs(params: any) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, String(value));
    });
    return this.request<any>(`/bff/dog/search/lost?${queryParams.toString()}`, {}, false);
  }

  // New methods for Dog Analysis and Public Contact
  async analyzeDogImage(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return this.requestWithFormData<any>("/bff/dog/analyze", formData, true);
  }

  async getPublicDog(id: string) {
    return this.request<any>(`/bff/dog/public/${id}`, {}, false);
  }

  async contactOwner(data: { dogId: string; finderName: string; finderPhone: string; message: string; location?: any }) {
    return this.request<any>("/bff/dog/public/contact-owner", {
      method: "POST",
      body: JSON.stringify(data),
    }, false);
  }

  // --- Community Post (Smart Search) ---

  async createCommunityPost(data: {
    type: "LOST" | "FOUND";
    title: string;
    content: string;
    photos: File[]; // Upload Files
    dog_id?: string;
    location: { lat: number; lng: number; address: string };
    contact_info: { name: string; phone?: string; email?: string };
  }) {
    const formData = new FormData();
    formData.append("type", data.type);
    formData.append("title", data.title);
    formData.append("content", data.content);
    if (data.dog_id) formData.append("dog_id", data.dog_id);

    // JSON stringify complex objects for FormData
    formData.append("location", JSON.stringify(data.location));
    formData.append("contact_info", JSON.stringify(data.contact_info));

    if (data.photos) {
      data.photos.forEach(file => formData.append("files", file));
    }

    return this.requestWithFormData<any>("/bff/post", formData, true);
  }

  // Create FOUND post from QR scan (no auth or photo required)
  async createQrFoundPost(data: {
    dog_id: string;
    title?: string;
    content?: string;
    location: { lat: number; lng: number; address: string };
    contact_info: { name: string; phone?: string; email?: string };
  }) {
    return this.request<any>("/bff/post/qr-found", {
      method: "POST",
      body: JSON.stringify(data),
    }, false); // No auth required
  }

  async getCommunityPosts(params: {
    type?: "LOST" | "FOUND";
    breed?: string;
    lat?: number;
    lng?: number;
    radius?: number; // km
    page?: number;
    limit?: number;
  }) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) queryParams.append(key, String(value));
    });
    return this.request<any>(`/bff/post?${queryParams.toString()}`, {}, false); // Public read
  }

  async getCommunityPost(id: string) {
    return this.request<any>(`/bff/post/${id}`, {}, false);
  }

  async resolveCommunityPost(id: string) {
    return this.request<any>(`/bff/post/${id}/resolve`, {
      method: "PATCH"
    }, true);
  }

  // Alias for usage in components
  async resolvePost(id: string) {
    return this.resolveCommunityPost(id);
  }

  // --- Lost & Found Radar API ---
  async reportLost(dogId: string, data: {
    location: { lat: number; lng: number; address: string };
    contact: { name: string; phone?: string; email?: string };
    title?: string;
    content?: string;
  }) {
    return this.request<any>(`/bff/dog/${dogId}/report-lost`, {
      method: "POST",
      body: JSON.stringify(data),
    }, true);
  }

  async reportFoundWithVerification(data: any, file?: File) {
    if (file) {
      const formData = new FormData();
      // Flatten data to formData
      formData.append("dogId", data.dogId);
      formData.append("verificationType", data.verificationType);
      formData.append("contact", JSON.stringify(data.contact));
      formData.append("location", JSON.stringify(data.location));
      if (data.verificationData) formData.append("verificationData", data.verificationData);

      formData.append("file", file);

      return this.requestWithFormData<any>("/bff/dog/report-found-verified", formData, false);
    } else {
      return this.request<any>("/bff/dog/report-found-verified", {
        method: "POST",
        body: JSON.stringify(data)
      }, false);
    }
  }

  /**
   * Get radar posts for bi-directional matching
   * @param sourceType - The type of the source post (LOST or FOUND)
   *                     If viewing a LOST post, will search for FOUND posts (clues)
   *                     If viewing a FOUND post, will search for LOST posts (matching owners)
   */
  async getRadarPosts(params: {
    lat: number;
    lng: number;
    radius?: number;
    breed?: string;
    sourceType?: "LOST" | "FOUND";
  }) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) queryParams.append(key, String(value));
    });
    return this.request<any>(`/bff/post/radar?${queryParams.toString()}`, {}, false);
  }




  public getBaseUrl(): string {
    return this.baseUrl;
  }


  public getAccessToken(): string | null {
    return TokenManager.getAccessToken();
  }

  public setTokenUpdateCallback(
    callback: (tokens: { remaining: number; limit: number }) => void
  ) {
    this.onTokenUpdate = callback;
  }

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
        body: JSON.stringify({ refreshToken }), // Đảm bảo gửi đúng key 'refreshToken'
      });

      if (response.ok) {
        const data = await response.json();
        // Backend trả về { accessToken, refreshToken }
        if (data.accessToken && data.refreshToken) {
          TokenManager.setTokens(data.accessToken, data.refreshToken);
          return true;
        }
      }

      // Nếu server trả về 401/403 tại endpoint refresh -> Token hết hạn thật sự
      // Lúc này mới xóa token ở Client
      TokenManager.clearTokens();
      return false;
    } catch (error) {
      // Nếu lỗi mạng (mất mạng), ĐỪNG xóa token ngay.
      // Hãy để user thử lại lần sau.
      console.error("[ApiClient] refreshAccessToken error:", error);
      return false;
    } finally {
      this.refreshTokenPromise = null;
    }
  }

  public async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requiresAuth = false
  ): Promise<T> {
    const url = new URL(endpoint, this.baseUrl).toString();
    const headers: Record<string, string> = { ...options.headers };

    const method = options.method ? options.method.toUpperCase() : "GET";
    const isBodyLess = method === "GET" || method === "HEAD";

    if (!(options.body instanceof FormData) && !isBodyLess) {
      headers["Content-Type"] = "application/json";
    }

    let token = TokenManager.getAccessToken();
    if (token && token !== "null" && token !== "undefined") {
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
          throw new Error(
            "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
          );
        }
      }

      this.handleTokenHeaders(response);

      if (!response.ok) {

        if (response.status >= 500) {
          throw new Error(
            `Server Error: ${response.status}. Please try again later or contact support.`
          );
        }
        if (response.status !== 304) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage =
            errorData.errors?.[0]?.message ||
            errorData.message ||
            `Request failed with status: ${response.status} ${response.statusText}`;
          throw new Error(errorMessage);
        }
      }

      const contentType = response.headers.get("content-type");
      if (response.status === 204 || !contentType || !contentType.includes("application/json")) {
        return Promise.resolve(undefined as T);
      }

      return response.json();
    } catch (error) {
      // BỎ QUA LỖI ABORT: Lỗi này xảy ra khi một request bị hủy bỏ,
      if (error instanceof Error && error.name === "AbortError")
        return Promise.reject(error);

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
    requiresAuth = false,
    method = "POST"
  ): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: method,
        body: formData,
      },
      requiresAuth
    );
  }

  private async requestWithUploadProgress<T>(
    endpoint: string,
    formData: FormData,
    onProgress: (progress: number) => void,
    requiresAuth = false,
    _isRetry = false
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

      xhr.onload = async () => {
        this.handleTokenHeaders(xhr);

        if (xhr.status === 401 && TokenManager.getRefreshToken() && !_isRetry) {
          try {
            const refreshed = await this.handleUnauthorized();
            if (refreshed) {
              const result = await this.requestWithUploadProgress<T>(
                endpoint,
                formData,
                onProgress,
                requiresAuth,
                true
              );
              resolve(result);
              return;
            }
          } catch (e) {
            reject(new Error(`API Error: ${xhr.status} ${xhr.statusText}`));
          }
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            reject(new Error("Failed to parse server response."));
          }
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText);
            const errorMessage =
              errorData.errors?.[0]?.message ||
              errorData.message ||
              `API Error: ${xhr.status}`;
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

  // BFF-User endpoints
  async register(data: {
    username: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    avatar?: File;
    captchaToken: string;
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

  async login(email: string, password: string, captchaToken: string) {
    return this.request<any>("/bff/user/login", {
      method: "POST",
      body: JSON.stringify({ email, password, captchaToken }),
    });
  }

  async logout() {
    const refreshToken = TokenManager.getRefreshToken();

    if (!refreshToken) {
      TokenManager.clearTokens();
      return Promise.resolve({ message: "Logged out locally." });
    }

    try {
      const response = await this.request<any>(
        "/bff/user/logout",
        {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        },
        true
      );
      return response;
    } finally {
      TokenManager.clearTokens();
    }
  }

  async getSessionStatus() {
    return this.request<any>("/bff/user/session-status", {
      cache: "no-cache",
    });
  }

  // Auth endpoints (non-BFF)
  async forgotPassword(email: string) {
    return this.request<any>("/bff/user/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(email: string, otp: string, password: string) {
    return this.request<any>("/bff/user/reset-password", {
      method: "POST",
      body: JSON.stringify({ email, otp, password }),
    });
  }

  // Delete current user (requires auth)
  async deleteCurrentUser(password: string) {
    return this.request<any>(
      "/bff/user/profile",
      {
        method: "DELETE",
        body: JSON.stringify({ password }),
      },
      true
    );
  }

  async getProfile() {
    return this.request<import("./types").ProfileResponse>(
      "/bff/user/profile",
      { cache: "no-cache" },
      true
    );
  }

  async updateProfile(formData: FormData) {
    return this.request<any>(
      "/bff/user/profile",
      {
        method: "PUT",
        body: formData,
      },
      true
    );
  }

  async updateAvatar(file: File) {
    const formData = new FormData();
    formData.append("avatar", file);
    return this.requestWithFormData<any>("/bff/user/avatar", formData, true);
  }

  async cancelSubscription() {
    return this.request('/bff/user/cancel-subscription', {
      method: 'POST',
    });
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

  async getAchievementStats(lang: "vi" | "en") {
    const queryParams = new URLSearchParams();
    queryParams.append("lang", lang);

    return this.request<{
      totalAchievements: number;
      totalBreeds: number;
      unlockedAchievements: number;
      totalCollected: number;
    }>(
      `/bff/collection/achievements/stats?${queryParams.toString()}`,
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

    const requiresAuth = !!TokenManager.getAccessToken();
    return this.requestWithUploadProgress<any>(
      "/bff/predict/video",
      formData,
      onProgress,
      requiresAuth
    );
  }

  async predictUrl(url: string) {

    const requiresAuth = !!TokenManager.getAccessToken();
    return this.request<any>(
      "/bff/predict/url",
      {
        method: "POST",
        body: JSON.stringify({ url }),
      },
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

  async getChatHistory(breedSlug: string): Promise<{
    history: { role: "user" | "model"; parts: { text: string }[] }[];
  }> {
    return this.request<{
      history: { role: "user" | "model"; parts: { text: string }[] }[];
    }>(
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

  async getPredictionStatus(id: string) {
    return this.request<any>(
      `/bff/predict/status/${id}`,
      { method: "GET" },
      false
    );
  }
  // --------------------------------------------------

  async deletePredictionHistory(id: string): Promise<void> {
    return this.request<void>(
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
      "/bff/analytics/track-visit",
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
      "/bff/analytics/track-event",
      {
        method: "POST",
        body: JSON.stringify({ eventName, eventData }),
      },
      false // Không yêu cầu auth bắt buộc
    );
  }

  private _createWebSocketConnection(
    token: string | null,
    endpoint: string
  ): WebSocket {
    const wsUrl = API_BASE_URL.replace(/^http/, "ws");
    const url = token
      ? `${wsUrl}${endpoint}?token=${token}`
      : `${wsUrl}${endpoint}`;
    return new WebSocket(url);
  }

  // Convenience method for stream prediction WebSocket
  async connectStreamPrediction(): Promise<WebSocket> {
    if (TokenManager.getRefreshToken()) {
      await this.refreshAccessToken();
    }
    const token = TokenManager.getAccessToken();
    return this._createWebSocketConnection(token, "/bff/predict/stream");
  }

  async saveStreamPrediction(payload: { processed_media_base64: string; detections: any[]; media_type: string }): Promise<{ id: string }> {
    return this.request<{ id: string }>(
      "/bff/predict/stream/save",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      false
    );
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


  async getPublicPlans() {
    return this.request<any>(
      "/bff/public/plans",
      {},
      false // Endpoint này là public
    );
  }

  async getPublicPlanBySlug(slug: string) {
    return this.request<any>(
      `/bff/public/plans/${slug}`,
      {},
      false // Endpoint này là public
    );
  }

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
    return this.request<any>(
      `/bff/admin/transactions${query ? `?${query}` : ""}`,
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
  async getLeaderboard(params?: {
    type?: string;
    value?: string;
    limit?: number;
  }) {
    const q = new URLSearchParams();
    if (params?.type) q.append("type", params.type);
    if (params?.value) q.append("value", params.value);
    if (params?.limit) q.append("limit", String(params.limit));

    return this.request<import("./types").LeaderboardResponse>(
      `/bff/public/leaderboard?${q.toString()}`,
      { cache: "no-cache" },
      false
    );
  }

  async getLeaderboardLocations(type: "country" | "city") {
    return this.request<{ data: string[] }>(
      `/bff/public/leaderboard/locations?type=${type}`,
      {},
      false
    );
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

// Tạo một instance riêng cho các API của Admin
export const adminApiClient = new AdminApiClient(apiClient);
