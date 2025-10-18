import { apiClient } from "./api-client"

export interface DashboardStats {
  totalUsers: number
  totalPredictions: number
  totalFeedback: number
  accuracy: number
  todayVisits: number
  todayPredictions: number
}

export interface WeeklyActivity {
  day: string
  predictions: number
  visits: number
}

export interface TopBreed {
  breed: string
  count: number
}

export interface DashboardData {
  stats: DashboardStats
  charts: {
    weeklyActivity: WeeklyActivity[]
    topBreeds: TopBreed[]
    accuracyTrend: any[]
  }
}

export interface SystemAlert {
  id: string
  type: string
  message: string
  lastReported: string
}

export const getAdminDashboardData = async (): Promise<DashboardData> => {
  // Sử dụng phương thức đã được định nghĩa sẵn trong apiClient
  return apiClient.getAdminDashboard()
}

export const getSystemAlerts = async (): Promise<{ alerts: SystemAlert[] }> => {
  // Sử dụng phương thức đã được định nghĩa sẵn trong apiClient
  return apiClient.getAlerts()
}

// --- User Management ---
export interface EnrichedUser {
  id: string
  name: string
  email: string
  role: "user" | "premium" | "admin"
  createdAt: string
  stats: {
    predictions: number
    collected: number
    accuracy: number
  }
  status: "active" | "pending_verification"
}

export interface PaginatedUsersResponse {
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
  users: EnrichedUser[]
}

export const getAdminUsers = async (params: { page: number; limit: number; search?: string }): Promise<PaginatedUsersResponse> => {
  return apiClient.getAdminUsers(params)
}

export const adminCreateUser = async (data: { username: string; email: string; password: string; role: string, verify: string }) => {
  return apiClient.adminCreateUser(data);
}

export const deleteUser = async (userId: string): Promise<void> => {
  return apiClient.deleteUser(userId)
}

// --- Feedback Management ---
export interface Feedback {
  _id: string
  prediction_id: string
  user_id: {
    _id: string
    username: string
  }
  original_prediction: {
    class: string
    confidence: number
  }
  is_correct: boolean
  user_submitted_label?: string
  notes?: string
  status: "pending_review" | "approved_for_training" | "rejected"
  image_url: string
  createdAt: string
  updatedAt: string
}

export interface FeedbackStats {
  pending_review: number
  approved_for_training: number
  rejected: number
}

export interface FeedbackUserStats {
  userId: string
  username: string
  totalSubmissions: number
  approvedCount: number
  rejectedCount: number
}

export interface AdminFeedbackResponse {
  stats: FeedbackStats
  userStats: FeedbackUserStats[]
  feedbacks: {
    data: Feedback[]
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export const getAdminFeedback = async (params: { page: number; limit: number; status?: string; search?: string }): Promise<AdminFeedbackResponse> => {
  return apiClient.getAdminFeedback(params)
}

// --- AI Model Configuration ---
export interface AIConfiguration {
  _id: string
  key: string
  image_conf: number
  video_conf: number
  stream_conf: number
  stream_high_conf: number
  device: "cpu" | "cuda"
  model_path: string
  huggingface_repo: string
  createdAt: string
  updatedAt: string
}

export type AIConfigurationUpdatePayload = Partial<Omit<AIConfiguration, "_id" | "key" | "createdAt" | "updatedAt">>

export const getAIConfig = async (): Promise<{ data: AIConfiguration }> => {
  return apiClient.getModelConfig()
}

export const updateAIConfig = async (config: AIConfigurationUpdatePayload): Promise<any> => {
  return apiClient.updateModelConfig(config)
}

export interface AIModel {
  id: string;
  name: string;
  description: string;
  taskType: string;
  format: string;
  huggingFaceRepo: string;
  fileName: string;
  version: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  tags: string[];
  creator_id: string;
  createdAt: string;
  updatedAt: string;
}

export const getAIModels = async (): Promise<AIModel[]> => {
  return apiClient.getAIModels();
}

export const activateAIModel = async (modelId: string): Promise<any> => {
  return apiClient.activateAIModel(modelId);
}