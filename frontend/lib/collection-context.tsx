"use client"

import { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from "react"
import { apiClient } from "./api-client"
import { useAuth } from "./auth-context"
import type { CollectionSource } from "./types"
import { toast } from "sonner"
import { useI18n } from "./i18n-context"

interface CollectionContextType {
  collectedDogs: Map<string, { collectedAt: string | null; source: CollectionSource | null; }>
  toggleCollected: (dogSlug: string) => Promise<void>
  isCollected: (dogSlug: string) => boolean
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
  const { user, isAuthenticated } = useAuth()
  const { locale } = useI18n()
  const [collectedDogs, setCollectedDogs] = useState<Map<string, { collectedAt: string | null; source: CollectionSource | null; }>>(new Map())
  const [collectionStats, setCollectionStats] = useState<CollectionContextType['collectionStats']>(null)
  const [achievementStats, setAchievementStats] = useState<CollectionContextType['achievementStats']>(null)

  const loadCollectionData = useCallback(async () => {
    if (isAuthenticated && user) {
      try {
        // Load only stats for achievements, not full list
        const [dogdexResponse, achievementStatsResponse] = await Promise.all([
          apiClient.getDogDex({ limit: 9999, isCollected: 'true', lang: locale }),
          apiClient.getAchievementStats(locale) // Changed from getAchievements
        ]);

        const collectedMap = new Map<string, { collectedAt: string | null; source: CollectionSource | null; }>();
        dogdexResponse.breeds.forEach((b: any) => {
          collectedMap.set(b.slug, { collectedAt: b.collectedAt, source: b.source });
        });
        setCollectedDogs(collectedMap);
        setCollectionStats(dogdexResponse.stats);
        setAchievementStats(achievementStatsResponse);

      } catch (error) {
        console.error("Failed to load user collection:", error);
      }
    } else {
      setCollectedDogs(new Map());
      setCollectionStats(null);
      setAchievementStats(null);
    }
  }, [user, isAuthenticated, locale]);

  useEffect(() => {
    loadCollectionData();
  }, [loadCollectionData]);

  const toggleCollected = async (dogSlug: string) => {
    const isCurrentlyCollected = collectedDogs.has(dogSlug);

    if (user) {
      try {
        if (!isCurrentlyCollected) {
          await apiClient.addToCollection(dogSlug);
          toast.success("Breed added to your collection!");
          await refreshCollection();
          setCollectionStats(prev => prev ? { ...prev, collectedBreeds: prev.collectedBreeds + 1 } : null);
        } else {
          toast.warning("Removing from collection is not yet supported.");
        }
      } catch (error) {
        toast.error("Failed to update collection.");
      }
    } else {
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