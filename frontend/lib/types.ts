// TypeScript types based on Swagger schemas

export interface User {
  id: string
  username: string
  email: string
  role: "user" | "admin"
  isVerified: boolean
  createdAt: string
  firstName?: string
  lastName?: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface LoginResponse {
  user: User
  tokens: AuthTokens
  collection?: CollectionStats
}

export interface ProfileResponse {
  message: string;
  data: {
    user: User;
    collection: CollectionStats;
    history: PredictionHistory[];
  }
}

export interface RegisterResponse {
  message: string
  user?: User
}

export interface DogBreedWiki {
  id: string
  slug: string
  display_name: string
  group?: string
  coat_type?: string
  coat_colors?: string[]
  description: string
  life_expectancy?: string
  temperament?: string[]
  height?: string
  weight?: string
  favorite_foods?: string[]
  common_health_issues?: string[]
  energy_level?: number
  trainability?: number
  shedding_level?: number
  good_with_children?: boolean
  good_with_other_pets?: boolean
  suitable_for?: string[]
  unsuitable_for?: string[]
  climate_preference?: string
  maintenance_difficulty?: number
  trainable_skills?: string[]
  fun_fact?: string
  createdAt?: string
  updatedAt?: string
  isCollected?: boolean
}

export interface PaginatedDogBreedResponse {
  data: DogBreedWiki[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface YoloPrediction {
  track_id?: number
  box: number[]
  class: string
  confidence: number
  class_id?: number
}

export interface PredictionHistory {
  id: string
  processedMediaPath: string
  modelUsed: string
  isCorrect?: boolean
  createdAt: string
  updatedAt: string
  detections?: YoloPrediction[]
}

export interface PredictionResponse {
  success: boolean
  predictions: YoloPrediction[]
  processedImageUrl?: string
  history?: PredictionHistory
}

export interface FeedbackPayload {
  isCorrect: boolean
  submittedLabel?: string
  notes?: string
}

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  unlocked: boolean
  progress?: number
  total?: number
}

export interface CollectionStats {
  totalCollected: number
  totalBreeds: number
  percentage: number
  recentlyAdded?: DogBreedWiki[]
}

export interface MediaUploadResponse {
  success: boolean
  mediaPath: string
  mediaId: string
}

export interface ApiError {
  message: string
  error?: any
}

// Cấu trúc cho một con chó được phát hiện trong mảng 'detections'
export interface Detection {
  detectedBreed: string; // slug
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  breedInfo: EnrichedDogBreed | null; // Cập nhật để khớp với dữ liệu được làm giàu từ BFF
}

// Cấu trúc response hoàn chỉnh từ BFF
export interface BffPredictionResponse {
  predictionId: string;
  processedMediaUrl: string;
  detections: Detection[];
  collectionStatus: {
    isNewBreed: boolean;
    totalCollected: number;
    achievementsUnlocked: string[];
  } | null;
}

// Cấu trúc dữ liệu chi tiết của giống chó được làm giàu bởi BFF
// Nó chứa các trường được chọn lọc từ DogBreedWiki
export interface EnrichedDogBreed {
  slug: string;
  display_name: string; // Thêm trường này
  group?: string;
  description: string;
  life_expectancy?: string;
  temperament?: string[];
  energy_level?: number;
  trainability?: number;
  shedding_level?: number;
  maintenance_difficulty?: number;
  height?: string;
  weight?: string;
  good_with_children?: boolean;
  suitable_for?: string[];
}