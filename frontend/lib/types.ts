export interface User {
  id: string;
  plan: "free" | "starter" | "professional" | "enterprise" | "guest";
  username: string;
  email?: string;
  role?: "user" | "de" | "admin";
  verify?: boolean;
  createdAt?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  country?: string;
  city?: string;
  phoneNumber?: string;
  remainingTokens: number;
  tokenAllotment: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
export type CollectionSource =
  | "image_upload"
  | "video_upload"
  | "stream_capture"
  | "url_input";

export interface UserCollectionItem {
  _id: string;
  user_id: string;
  breed_id: { _id: string; breed: string; slug: string; group: string };
  first_collected_at: string;
  collection_count: number;
  source: CollectionSource;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
  collection?: UserCollectionItem[];
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
  };
}

export interface RegisterResponse {
  message: string;
  user?: User;
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
  data: DogBreed[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface YoloPrediction {
  track_id?: number;
  box: number[];
  class: string;
  confidence: number;
  class_id?: number;
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
  success: boolean;
  predictions: YoloPrediction[];
  processedImageUrl?: string;
  history?: PredictionHistoryItem;
}

export interface FeedbackPayload {
  isCorrect: boolean;
  submittedLabel?: string;
  notes?: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string | null;
  requiredCount: number;
}

export interface CollectionStats {
  totalBreeds: number;
  collectedBreeds: number;
  progress: number;
  recentlyAdded?: DogBreed[];
}

export interface MediaUploadResponse {
  success: boolean;
  mediaPath: string;
  mediaId: string;
}

export interface ApiError {
  message: string;
  error?: any;
}


export interface WebSocketError {
  type: "error";
  code?: "INSUFFICIENT_TOKENS" | string; // Mã lỗi để xác định nguyên nhân
  message: string;
}

// Cấu trúc cho một con chó được phát hiện trong mảng 'detections'
export interface Detection {
  track_id?: number;
  detectedBreed: string; // slug
  confidence: number;
  boundingBox: BoundingBox;
  breedInfo: EnrichedDogBreed | null;
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
  hasFeedback?: boolean;
  message?: string;
  processed_base64?: string;
}

// Cấu trúc cho một sản phẩm được gợi ý

export interface RecommendedProduct {
  category: string;
  reason: string;
  shopeeUrl: string;
}

// Cấu trúc dữ liệu chi tiết của giống chó được làm giàu bởi BFF
export interface EnrichedDogBreed {
  slug: string;
  breed: string;
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
  pokedexNumber?: number;
}


export interface Plan {
  name: string;
  slug: "free" | "starter" | "professional" | "enterprise" | "guest";
  priceMonthly: number;
  priceYearly: number;
  tokenAllotment: number;
  apiAccess: boolean;
  description?: string;
  isFeatured?: boolean;
  features?: {
    name: string;
    included: boolean;
  }[];
}

export interface PaginatedPlansResponse {
  data: Plan[];
  total: number;
}


export interface Subscription {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
  };
  planId: {
    _id: string;
    name: string;
  };
  status:
  | "active"
  | "pending_approval"
  | "canceled"
  | "expired"
  | "past_due"
  | "unpaid";
  startDate: string;
  endDate: string | null;
  createdAt: string;
}
export interface LeaderboardEntry {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  country?: string;
  city?: string;
  totalCollected: number;
  rank: number;
  role?: string;
}

export interface LeaderboardResponse {
  success: boolean;
  scope: "global" | "country" | "city";
  filterValue: string;
  data: LeaderboardEntry[];
}

export interface DogProfile {
  id: string;
  owner_id: string;
  name: string;
  breed: string;
  birthday?: string;
  gender: "male" | "female";
  avatarPath?: string;
  avatarUrl?: string;
  photos: string[];
  isLost: boolean;
  lastSeenLocation?: {
    lat: number;
    lng: number;
    address?: string;
  };
  attributes: {
    color?: string;
    pattern?: string;
    size?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface HealthRecord {
  id: string;
  dog_id: string;
  type: "vaccine" | "checkup" | "medicine" | "surgery" | "hygiene" | "other";
  title: string;
  date: string;
  nextDueDate?: string;
  notes?: string;
  vetName?: string;
  cost?: number;
  weight?: number;
  symptoms?: string;
  diagnosis?: string;
  attachments?: string[];
  createdAt: string;
}

export interface Post {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar?: string;
  type: "discussion" | "image" | "review" | "lost_found" | "sale" | "adoption";
  title?: string;
  content: string;
  mediaUrls: string[];
  likes: number;
  comments_count: number;
  tags?: string[];
  related_dog_id?: string;
  sale_info?: {
    price: number;
    currency: string;
    location: string;
    is_verified_breeder: boolean;
    vaccination_status: boolean;
    age_months: number;
  };
  createdAt: string;
  isLiked?: boolean;
}
