import { adminApiClient } from "./api-client"

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
  return adminApiClient.getAdminDashboard()
}

export const getSystemAlerts = async (): Promise<{ alerts: SystemAlert[] }> => {
  // Sử dụng phương thức đã được định nghĩa sẵn trong apiClient
  return adminApiClient.getAlerts()
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
  return adminApiClient.getAdminUsers(params)
}

export const adminCreateUser = async (data: { username: string; email: string; password: string; role: string, verify: string }) => {
  return adminApiClient.adminCreateUser(data);
}

export const deleteUser = async (userId: string): Promise<void> => {
  return adminApiClient.deleteUser(userId)
}

export const adminUpdateUser = async (userId: string, data: { username?: string; email?: string; role?: string; status?: string }) => {
  return adminApiClient.adminUpdateUser(userId, data);
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
  return adminApiClient.getAdminFeedback(params)
}

export const approveAdminFeedback = async (feedbackId: string, payload: { correctedLabel?: string }): Promise<{ message: string; data: Feedback }> => {
  return adminApiClient.adminApproveFeedback(feedbackId, payload);
}

export const rejectAdminFeedback = async (feedbackId: string, payload: { reason?: string }): Promise<{ message: string; data: Feedback }> => {
  return adminApiClient.adminRejectFeedback(feedbackId, payload);
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
  return adminApiClient.getModelConfig()
}

export const updateAIConfig = async (config: AIConfigurationUpdatePayload): Promise<any> => {
  return adminApiClient.updateModelConfig(config)
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
  return adminApiClient.getAIModels();
}

export const activateAIModel = async (modelId: string): Promise<any> => {
  return adminApiClient.activateAIModel(modelId);
}

export const adminUploadModel = async (formData: FormData): Promise<any> => {
  return adminApiClient.adminUploadModel(formData);
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
  return adminApiClient.getAdminHistories(params);
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
  return adminApiClient.browseAdminHistories(path, params);
}

// --- Media Management ---
export interface AdminMediaItem {
  id: string;
  name: string;
  type: 'folder' | 'image' | 'video';
  url: string;
  createdAt?: string;
  size?: number;
}

export interface BrowseMediaResponse {
  directories: { id: string; name: string; type: 'folder'; url: string; }[];
  media: AdminMediaItem[];
}

export const browseAdminMedia = async (path: string, options: RequestInit = {}): Promise<BrowseMediaResponse> => {
  return adminApiClient.browseAdminMedia(path, options);
}

export const deleteAdminMedia = async (mediaId: string): Promise<{ message: string }> => {
  return adminApiClient.adminDeleteMedia(mediaId);
}
export interface UserUsageData {
  userId: string;
  userName: string;
  email: string;
  tokensUsed: number;
  tokensLimit: number;
  plan: string;
  lastActive: string;
}

// [THÊM MỚI] Interface cho Cloudinary Stats
export interface CloudinaryResourceUsage {
  used_bytes: number;
  limit_bytes: number;
  usage_percent: number;
}

export interface CloudinaryObjectUsage {
  total_files: number;
  limit: number;
}

export interface CloudinaryUsageItem {
    usage: number;
    limit: number;
    usage_percent: number;
}

export interface CloudinaryStats {
  credits: CloudinaryUsageItem;         // MỚI
  transformations: CloudinaryUsageItem; // MỚI
  storage: CloudinaryResourceUsage;
  bandwidth: CloudinaryResourceUsage;
  objects: CloudinaryObjectUsage;
  plan: string;
  last_updated: string;
}

// [CẬP NHẬT] Interface response tổng
export interface AdminUsageResponse {
  usageData: UserUsageData[];
  tokensChartData: any[];
  plansChartData: any[];
  storageStats?: CloudinaryStats; // Thêm field này (optional vì có thể null)
}

export const getAdminUsageStats = async (): Promise<AdminUsageResponse> => {
  return adminApiClient.getAdminUsageStats();
};

// --- THÊM MỚI: Interface cho Dataset Management ---
export interface AdminFileItem {
  id: string;
  name: string;
  type: 'folder' | 'image' | 'video' | 'file';
  url: string;
  createdAt?: string;
  size?: number;
}
export interface BrowseDatasetResponse {
  directories: { id: string; name: string; type: 'folder' }[];
  files: AdminFileItem[];
}

// --- Dataset Management ---
export const browseAdminDatasets = async (path: string, options: RequestInit = {}): Promise<BrowseDatasetResponse> => {
  return adminApiClient.browseAdminDatasets(path, options);
}
export const downloadAdminDataset = async (): Promise<{ downloadUrl: string }> => {
  return adminApiClient.downloadAdminDataset();
}

export interface ReportPreviewData {
  overview: {
    totalRevenue: number;
    arpu: number;
    newUsers: number;
    totalUsers: number;
    totalPredictions: number;
    activeUsers: number;
    accuracy: number;
  };
  charts: {
    dailyActivity: { _id: string; count: number }[];
    topBreeds: { breed: string; count: number }[];
    usersByPlan: { planName: string; count: number }[];
  };
  infra: {
    plan: string;
    credits: { used: number; limit: number; percent: number };
    storage: { used: string; raw: number };
    bandwidth: { used: string; raw: number };
    objects: number;
  } | null;
}

export const getAdminReportPreview = async (payload: {
  startDate: string;
  endDate: string;
}): Promise<ReportPreviewData> => {
  return adminApiClient.getAdminReportPreview(payload);
};
export const exportAdminReport = async (params: {
  startDate: string;
  endDate: string;
  format: "excel" | "word";
}): Promise<Blob> => {
  return adminApiClient.exportAdminReport(params);
};

// --- Database Backup & Restore ---
export const backupDatabase = async (): Promise<Blob> => {
  return adminApiClient.backupDatabase();
};

export const restoreDatabase = async (file: File): Promise<{ message: string; filename: string }> => {
  return adminApiClient.restoreDatabase(file);
};
