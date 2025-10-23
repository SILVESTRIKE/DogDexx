"use client"

import { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from "react"
import { apiClient } from "./api-client"
import { useAuth } from "./auth-context"
import type { Achievement, CollectionSource } from "./types"
import { toast } from "sonner"
import { useI18n } from "./i18n-context"

interface CollectionContextType {
  collectedDogs: Map<string, { collectedAt: string | null; source: CollectionSource | null; }>
  toggleCollected: (dogSlug: string) => Promise<void>
  isCollected: (dogSlug: string) => boolean
  unlockedAchievements: Achievement[]
  collectionStats: {
    totalBreeds: number;
    collectedBreeds: number;
    progress: number;
  } | null
  achievementStats: {
    totalAchievements: number;
    unlockedAchievements: number;
    totalCollected: number;
    totalBreeds: number;
  } | null
  refreshCollection: () => Promise<void>
}

const CollectionContext = createContext<CollectionContextType | undefined>(undefined)

export function CollectionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth() // Dùng user từ auth context
  const { locale } = useI18n()
  const [collectedDogs, setCollectedDogs] = useState<Map<string, { collectedAt: string | null; source: CollectionSource | null; }>>(new Map())
  const [unlockedAchievements, setUnlockedAchievements] = useState<Achievement[]>([]) // Giữ lại để có thể dùng ở đâu đó khác
  const [collectionStats, setCollectionStats] = useState<CollectionContextType['collectionStats']>(null)
  const [achievementStats, setAchievementStats] = useState<CollectionContextType['achievementStats']>(null)

  // Hàm tải dữ liệu có thể tái sử dụng
  const loadCollectionData = useCallback(async () => {
    if (user) {
      try {
        // Sử dụng Promise.all để tải song song
        const [pokedexResponse, achievementsResponse] = await Promise.all([
          apiClient.getPokedex({ limit: 9999, isCollected: 'true', lang: locale }),
          apiClient.getAchievements(locale)
        ]);

        // Xử lý Pokedex
        const collectedMap = new Map<string, { collectedAt: string | null; source: CollectionSource | null; }>();
        pokedexResponse.breeds.forEach((b: any) => {
          collectedMap.set(b.slug, { collectedAt: b.collectedAt, source: b.source });
        });
        setCollectedDogs(collectedMap);
        setCollectionStats(pokedexResponse.stats);

        // Xử lý Achievements
        setUnlockedAchievements(achievementsResponse.achievements || []);
        setAchievementStats(achievementsResponse.stats);

      } catch (error) {
        console.error("[v0] Failed to load user collection:", error);
      }
    } else { // Guest
      // Guest logic can be simplified or removed if not needed
      setCollectedDogs(new Map());
      setCollectionStats(null);
      setAchievementStats(null);
    }
  }, [user, locale]);

  // FIX: useEffect này sẽ tự động chạy lại khi user thay đổi (đăng nhập/đăng xuất) HOẶC khi ngôn ngữ (locale) thay đổi.
  useEffect(() => {
    loadCollectionData();
  }, [loadCollectionData, user, locale]);

  const toggleCollected = async (dogSlug: string) => {
    // Logic này về cơ bản đã đúng, chỉ cần đảm bảo nó cập nhật state một cách nhất quán
    const isCurrentlyCollected = collectedDogs.has(dogSlug);

    if (user) {
      try {
        if (!isCurrentlyCollected) {
          await apiClient.addToCollection(dogSlug);
          toast.success("Breed added to your collection!");
          // Refresh data to get the latest state from the server
          await refreshCollection();
          setCollectionStats(prev => prev ? { ...prev, collectedBreeds: prev.collectedBreeds + 1 } : null);
        } else {
          // Logic để xóa (khi API được implement)
          toast.warning("Removing from collection is not yet supported.");
        }
      } catch (error) {
        toast.error("Failed to update collection.");
        console.error("[v0] Failed to toggle collection:", error);
      }
    } else { // Guest user
      toast.info("Please log in to manage your collection.");
    }
  };
  
  const isCollected = (dogSlug: string) => collectedDogs.has(dogSlug);
  
  const refreshCollection = useCallback(async () => {
    await loadCollectionData();
  }, [loadCollectionData]);

  return (
    <CollectionContext.Provider
      value={{
        collectedDogs,
        toggleCollected,
        isCollected,
        unlockedAchievements,
        collectionStats,
        achievementStats,
        refreshCollection,
      }}
    >
      {children}
    </CollectionContext.Provider>
  )
}

export function useCollection() {
  const context = useContext(CollectionContext)
  if (!context) {
    throw new Error("useCollection must be used within CollectionProvider")
  }
  return context
}