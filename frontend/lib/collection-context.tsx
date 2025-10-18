"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { apiClient } from "./api-client"
import { useAuth } from "./auth-context"
import type { Achievement, CollectionStats } from "./types"

interface CollectionContextType {
  collectedDogs: Set<string>
  toggleCollected: (dogSlug: string) => Promise<void>
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

  useEffect(() => {
    const loadCollection = async () => {
      if (user) {
        try {
          // Optimized: Fetch Pokedex and Achievements in parallel.
          // The Pokedex endpoint already includes collection stats.
          const [pokedexResponse, achievementsResponse] = await Promise.all([
            apiClient.getPokedex(),
            apiClient.getAchievements(),
          ])

          // 1. Set collected dogs from the Pokedex response
          const collectedSlugs = new Set<string>(
            pokedexResponse.breeds.filter((breed: { isCollected: boolean }) => breed.isCollected).map((breed: { slug: string }) => breed.slug)
          )
          setCollectedDogs(collectedSlugs)

          // 2. Set stats from the Pokedex response
          setCollectionStats(pokedexResponse.stats)

          // 3. Set achievements
          setUnlockedAchievements(achievementsResponse.achievements || [])
        } catch (error) {
          console.error("[v0] Failed to load collection:", error)
        }
      } else {
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
      }
      setIsLoaded(true)
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
          // Optimized: Use the response from `addToCollection` to update state,
          // avoiding the need for a separate `refreshCollection` call.
          const response = await apiClient.addToCollection(dogSlug)
          setCollectedDogs((prev) => {
            const newSet = new Set(prev)
            newSet.add(dogSlug)
            return newSet
          })

          // Update stats and achievements directly from the API response
          if (response) {
            await refreshCollection() // Refresh to get the complete, updated list
          }
        } else {
          // TODO: Implement API call for removing a breed from the collection.
          // For now, this only updates local state and will be out of sync on page refresh.
          console.warn(`[v0] Removal for slug '${dogSlug}' is not implemented on the backend.`)
          // Example: await apiClient.removeFromCollection(dogSlug);
          // Then update state and refresh.
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
    if (user) {
      try {
        // This function can be used to force a full refresh of collection data.
        const [statsResponse, achievementsResponse, pokedexResponse] = await Promise.all([
          apiClient.getCollectionStats(),
          apiClient.getAchievements(),
          apiClient.getPokedex({ limit: 2000 }), // Fetch all to ensure collected set is accurate
        ])

        const collectedSlugs = new Set<string>(pokedexResponse.breeds.filter((b: { isCollected: boolean }) => b.isCollected).map((b: { slug: string }) => b.slug))

        setCollectedDogs(collectedSlugs)
        setCollectionStats(statsResponse)
        setUnlockedAchievements(achievementsResponse.achievements || [])
      } catch (error) {
        console.error("[v0] Failed to refresh collection:", error)
      }
    }
  }

  return (
    <CollectionContext.Provider
      value={{
        collectedDogs,
        toggleCollected,
        isCollected,
        collectionCount: collectedDogs.size,
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
