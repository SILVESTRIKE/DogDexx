// @ts-nocheck
import type { ApiClient } from "./api-client";

/**
 * Lớp này chứa tất cả các phương thức gọi API dành riêng cho Admin.
 * Nó nhận một instance của ApiClient gốc để tái sử dụng logic request.
 */
export class AdminApiClient {
  private client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  // BFF-Admin endpoints
  async getAdminDashboard() {
    return this.client.request<any>("/bff/admin/dashboard", {}, true);
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
    return this.client.request<any>(
      `/bff/admin/feedback${query ? `?${query}` : ""}`,
      {},
      true
    );
  }

  async adminApproveFeedback(feedbackId: string) {
    return this.client.request<any>(
      `/bff/admin/feedback/${feedbackId}/approve`,
      {
        method: "POST",
      },
      true
    );
  }

  async adminRejectFeedback(feedbackId: string) {
    return this.client.request<any>(
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
    return this.client.request<any>(
      `/bff/admin/users${query ? `?${query}` : ""}`,
      {},
      true
    );
  }

  async getModelConfig() {
    return this.client.request<any>("/bff/admin/model/config", {}, true);
  }

  async updateModelConfig(config: any) {
    return this.client.request<any>(
      "/bff/admin/model/config",
      {
        method: "PUT",
        body: JSON.stringify(config),
      },
      true
    );
  }

  async getAlerts() {
    return this.client.request<any>("/bff/admin/alerts", {}, true);
  }

  async getAdminUsageStats() {
    return this.client.request<any>("/bff/admin/usage", {}, true);
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
    return this.client.request<any>(
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
    return this.client.request<any>(
      `/bff/admin/histories/browse?${queryParams.toString()}`,
      {},
      true
    );
  }

  async browseAdminMedia(path: string, options: RequestInit = {}) {
    const queryParams = new URLSearchParams();
    if (path) queryParams.append("path", path);
    return this.client.request<any>(
      `/bff/admin/media/browse?${queryParams.toString()}`,
      options,
      true
    );
  }

  async adminDeleteMedia(mediaId: string): Promise<{ message: string }> {
    return this.client.request<{ message: string }>(
      `/bff/admin/media/${mediaId}`,
      {
        method: "DELETE",
      },
      true
    );
  }

  // Core User Management (Admin)
  async deleteUser(userId: string) {
    return this.client.request<void>(
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
    return this.client.request<any>(
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
    return this.client.request<any>(
      `/bff/admin/users/${userId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
      true
    );
  }

  async adminUploadModel(formData: FormData) {
    return this.client.requestWithFormData<any>(
      "/bff/admin/models/upload",
      formData,
      true
    );
  }

  // Core AI Model Management (Admin)
  async getAIModels() {
    return this.client.request<any>("/api/ai-models", {}, true);
  }

  async activateAIModel(modelId: string) {
    return this.client.request<any>(
      `/api/ai-models/${modelId}/activate`,
      {
        method: "POST",
      },
      true
    );
  }
}