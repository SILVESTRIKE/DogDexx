"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { View, FlatList, StyleSheet, ActivityIndicator, Text, type ListRenderItem } from "react-native"
import { apiClient } from "../lib/api-client"
import type { DogBreed } from "../lib/types"
import DogCard from "./DogCard"
import { theme } from "../styles/theme"

interface DogGridProps {
  search: string
  sort: string
  filter: string
  locale: "vi" | "en"
  onTotalCountChange: (count: number) => void
  onCardPress: (dog: DogBreed) => void
}

const DogGrid: React.FC<DogGridProps> = ({ search, sort, filter, locale, onTotalCountChange, onCardPress }) => {
  const [dogBreeds, setDogBreeds] = useState<DogBreed[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [highlightedSlug, setHighlightedSlug] = useState<string | null>(null)

  // Reset when filters change
  useEffect(() => {
    setDogBreeds([])
    setPage(1)
    setTotalPages(1)
    setLoading(true)
    setHighlightedSlug(null)
  }, [search, sort, filter, locale])

  // Fetch breeds
  useEffect(() => {
    let isMounted = true

    const fetchBreeds = async () => {
      if (page === 1) setLoading(true)
      else setLoadingMore(true)

      try {
        const isCollectedParam = filter === "collected" ? "true" : filter === "uncollected" ? "false" : undefined

        const response = await apiClient.getDogDex({
          limit: 20,
          page,
          search: search || undefined,
          sort,
          group: filter !== "all" && filter !== "collected" && filter !== "uncollected" ? filter : undefined,
          isCollected: isCollectedParam,
          lang: locale,
        })

        if (isMounted) {
          setDogBreeds((prev) => (page === 1 ? response.breeds : [...prev, ...response.breeds]))
          onTotalCountChange(response.stats?.totalBreeds ?? 0)
          setTotalCount(response.pagination.total)
          setTotalPages(response.pagination.totalPages)
        }
      } catch (error) {
        console.error("Failed to fetch breeds:", error)
      } finally {
        if (isMounted) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    }

    fetchBreeds()
    return () => {
      isMounted = false
    }
  }, [page, search, sort, filter, locale, onTotalCountChange])

  const handleLoadMore = useCallback(() => {
    if (!loading && !loadingMore && page < totalPages) {
      setPage((prev) => prev + 1)
    }
  }, [loading, loadingMore, page, totalPages])

  const renderItem: ListRenderItem<DogBreed> = useCallback(
    ({ item, index }) => (
      <View style={styles.cardWrapper}>
        <DogCard
          dog={item}
          index={index}
          isHighlighted={item.slug === highlightedSlug}
          onPress={() => onCardPress(item)}
        />
      </View>
    ),
    [highlightedSlug, onCardPress],
  )

  const renderFooter = () => {
    if (!loadingMore) return null
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={styles.loadingMoreText}>Loading more...</Text>
      </View>
    )
  }

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      )
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No results found for "{search}"</Text>
      </View>
    )
  }

  return (
    <>
      {dogBreeds.length > 0 && (
        <Text style={styles.countText}>
          Showing {dogBreeds.length} of {totalCount}
        </Text>
      )}
      <FlatList
        data={dogBreeds}
        renderItem={renderItem}
        keyExtractor={(item) => item.slug}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        scrollEnabled={true}
        nestedScrollEnabled={true}
        contentContainerStyle={styles.listContent}
      />
    </>
  )
}

const styles = StyleSheet.create({
  cardWrapper: {
    paddingHorizontal: 12,
  },
  listContent: {
    paddingVertical: 8,
  },
  countText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 12,
  },
  loadingMoreText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 16,
    textAlign: "center",
  },
})

export default DogGrid
