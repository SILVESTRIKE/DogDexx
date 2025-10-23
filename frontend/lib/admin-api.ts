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
  role: "user" | "de" | "admin"
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
  id: string;
  predictionId: string;
  feedbackTimestamp: string;
  predictionTimestamp: string;
  user: {
    name: string;
    email: string | null;
  };
  feedbackContent: {
    isCorrect: boolean;
    userSubmittedLabel?: string;
    notes?: string;
  };
  aiPrediction: { class: string; confidence: number } | null;
  originalMediaUrl: string;
  processedMediaUrl: string;
  status: "pending_review" | "approved_for_training" | "rejected";
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

export const getAdminFeedback = async (params: { 
  page: number; 
  limit: number; 
  status?: string; 
  search?: string;
  startDate?: string;
  endDate?: string;
}): Promise<AdminFeedbackResponse> => {
  return apiClient.getAdminFeedback(params)
}

export const approveAdminFeedback = async (feedbackId: string): Promise<{ message: string; data: Feedback }> => {
  return apiClient.adminApproveFeedback(feedbackId);
}

export const rejectAdminFeedback = async (feedbackId: string): Promise<{ message: string; data: Feedback }> => {
  return apiClient.adminRejectFeedback(feedbackId);
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

// --- History Management ---
export interface AdminHistoryItem {
  id: string;
  user: {
    id: string | null;
    name: string;
    email: string | null;
  };
  media: {
    type: string;
    url: string;
    name: string;
  };
  predictions: {
    class: string;
    confidence: number;
  }[];
  createdAt: string;
  source: 'image_upload' | 'video_upload' | 'stream_capture';
  processedMediaUrl?: string;
  feedback: { id: string } | null;
}

export interface PaginatedAdminHistoryResponse {
  data: AdminHistoryItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const getAdminHistories = async (params: { page: number; limit: number; search?: string }): Promise<PaginatedAdminHistoryResponse> => {
  return apiClient.getAdminHistories(params);
}

export interface DirectoryItem {
  id?: string;
  name: string | number;
  type: 'user' | 'year' | 'month' | 'day';
}

export interface BrowseHistoryResponse {
  directories: DirectoryItem[];
  histories: AdminHistoryItem[];
}

export const browseAdminHistories = async (path: string, params?: { startDate?: string, endDate?: string }): Promise<BrowseHistoryResponse> => {
  return apiClient.browseAdminHistories(path, params);
}