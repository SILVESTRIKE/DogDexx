export interface User {
  id: string
  plan: 'free' | 'starter' | 'professional' | 'enterprise';
  username: string
  email: string
  role: "user" | "de" | "admin"
  verify: boolean
  createdAt: string
  firstName?: string
  lastName?: string
  avatarUrl?: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export type CollectionSource = 'image_upload' | 'video_upload' | 'stream_capture' | 'manual_add';

// Kiểu dữ liệu cho một item trong bộ sưu tập của người dùng
export interface UserCollectionItem {
  _id: string;
  user_id: string;
  breed_id: { _id: string; breed: string; slug: string; group: string; };
  first_collected_at: string;
  collection_count: number;
  source: CollectionSource;
}

export interface LoginResponse {
  user: User
  tokens: AuthTokens
  collection?: UserCollectionItem[]
}

export interface ProfileResponse {
  message: string;
  data: {
    user: User;
    collection: UserCollectionItem[];
    history: {
      histories: PredictionHistoryItem[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }
}

export interface RegisterResponse {
  message: string
  user?: User
}

/**
 * Kiểu dữ liệu chính cho một giống chó, bao gồm tất cả các trường từ DB
 * và các trường được làm giàu bởi BFF.
 */
export interface DogBreed {
  slug: string;
  breed: string;
  pokedexNumber?: number;
  group?: string;
  origin?: string;
  mediaUrl?: string;
  coat_type?: string;
  coat_colors?: string[];
  description: string;
  life_expectancy?: string;
  temperament?: string[];
  height?: string;
  weight?: string;
  favorite_foods?: string[];
  common_health_issues?: string[];
  energy_level?: number;
  trainability?: number;
  shedding_level?: number;
  rarity_level?: number;
  good_with_children?: boolean;
  good_with_other_pets?: boolean;
  suitable_for?: string[];
  unsuitable_for?: string[];
  climate_preference?: string;
  maintenance_difficulty?: number;
  trainable_skills?: string[];
  fun_fact?: string;
  isCollected?: boolean;
  collectedAt?: string | null;
  source?: CollectionSource | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedDogBreedResponse {
  data: DogBreed[]
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
interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PredictionHistoryItem {
  id: string;
  processedMediaUrl: string;
  modelUsed: string;
  isCorrect?: boolean | null;
  createdAt: string;
  updatedAt: string;
  // Detections đã được tinh gọn cho trang danh sách
  detections: {
    detectedBreed: string;
    breedName: string;
    confidence: number;
  }[];
  media: { name: string; mediaUrl: string; type: string };
  source: CollectionSource;
}

export interface PredictionResponse {
  success: boolean
  predictions: YoloPrediction[]
  processedImageUrl?: string
  history?: PredictionHistoryItem
}

export interface FeedbackPayload {
  isCorrect: boolean
  submittedLabel?: string
  notes?: string
}

export interface Achievement {
  title: string // Đổi từ name
  description: string
  icon: string
  unlocked: boolean
  unlockedAt?: string | null // Thêm trường này
  requiredCount: number // Thêm trường này
}

export interface CollectionStats {
  totalBreeds: number;
  collectedBreeds: number;
  progress: number;
  recentlyAdded?: DogBreed[]
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
  boundingBox: BoundingBox;
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
  breed: string; // Thêm trường này
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