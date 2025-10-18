"use client"

import { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from "react"
import { apiClient } from "./api-client"
import { useAuth } from "./auth-context"
import type { Achievement, CollectionStats } from "./types"
import { toast } from "sonner"

interface CollectionContextType {
  collectedDogs: Set<string>
  toggleCollected: (dogSlug: string) => Promise<void>
  setInitialCollection: (breeds: any[], stats: CollectionStats) => void
  isCollected: (dogSlug: string) => boolean
  collectionCount: number
  unlockedAchievements: Achievement[]
  collectionStats: CollectionStats | null
  refreshCollection: () => Promise<void>
}

const CollectionContext = createContext<CollectionContextType | undefined>(undefined)

export function CollectionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [collectedDogs, setCollectedDogs] = useState<Set<string>>(new Set())
  const [unlockedAchievements, setUnlockedAchievements] = useState<Achievement[]>([])
  const [collectionStats, setCollectionStats] = useState<CollectionStats | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  // Hàm này sẽ được gọi từ PokedexPage để khởi tạo dữ liệu
  const setInitialCollection = useCallback((breeds: any[], stats: CollectionStats) => {
    const collectedSlugs = new Set<string>(
      breeds.filter((breed: { isCollected: boolean }) => breed.isCollected).map((breed: { slug: string }) => breed.slug)
    )
    setCollectedDogs(collectedSlugs)
    setCollectionStats(stats)
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    const loadCollection = async () => {
      if (!user) { // Chỉ xử lý cho guest
        const stored = localStorage.getItem("dogdex-collection")
        if (stored) {
          try {
            const parsedData: unknown = JSON.parse(stored)
            // Ensure parsedData is an array of strings before creating a Set.
            if (Array.isArray(parsedData) && parsedData.every(item => typeof item === 'string')) {
              setCollectedDogs(new Set(parsedData as string[]))
            }
          } catch (e) {
            console.error("[v0] Failed to parse collection data", e)
          }
        }
        setIsLoaded(true)
      }
    }

    loadCollection()
  }, [user])

  useEffect(() => {
    if (isLoaded && !user) {
      localStorage.setItem("dogdex-collection", JSON.stringify(Array.from(collectedDogs)))
    }
  }, [collectedDogs, isLoaded, user])

  const toggleCollected = async (dogSlug: string) => {
    if (user) {
      try {
        const isCurrentlyCollected = collectedDogs.has(dogSlug)

        if (!isCurrentlyCollected) {
          await apiClient.addToCollection(dogSlug)
          toast.success("Breed added to your collection!")
          setCollectedDogs((prev) => {
            const newSet = new Set(prev)
            newSet.add(dogSlug)
            return newSet
          })
          // Tăng số lượng đã sưu tầm trong stats
          setCollectionStats(prev => prev ? { ...prev, collectedBreeds: (prev.collectedBreeds || 0) + 1 } : null)
        } else {
          // TODO: Implement API để xóa khỏi collection
          toast.warning("Removing from collection is not yet supported.")
          // setCollectedDogs((prev) => {
          //   const newSet = new Set(prev)
          //   newSet.delete(dogSlug)
          //   return newSet
          // })
          // setCollectionStats(prev => prev ? { ...prev, collectedBreeds: (prev.collectedBreeds || 1) - 1 } : null)
        }
      } catch (error) {
        console.error("[v0] Failed to toggle collection:", error)
      }
    } else {
      setCollectedDogs((prev) => {
        const newSet = new Set(prev)
        if (newSet.has(dogSlug)) {
          newSet.delete(dogSlug)
        } else {
          newSet.add(dogSlug)
        }
        return newSet
      })
    }
  }

  const isCollected = (dogSlug: string) => {
    return collectedDogs.has(dogSlug)
  }

  const refreshCollection = async () => {
    // Hàm này giờ chỉ cần để tải lại achievements nếu cần
    if (!user) return;
    try {
      const achievementsResponse = await apiClient.getAchievements();
      setUnlockedAchievements(achievementsResponse.achievements || []);
    } catch (error) {
      console.error("[v0] Failed to refresh achievements:", error);
    }
  }

  return (
    <CollectionContext.Provider
      value={{
        collectedDogs,
        toggleCollected,
        setInitialCollection,
        isCollected,
        collectionCount: collectionStats?.collectedBreeds ?? collectedDogs.size,
        unlockedAchievements,
        collectionStats,
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
