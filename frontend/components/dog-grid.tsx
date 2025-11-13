"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { DogCard } from "@/components/dog-card";
import { apiClient } from "@/lib/api-client";
import type { DogBreed as DogBreedType } from "@/lib/types";
import { useI18n } from "@/lib/i18n-context";

interface DogGridProps {
  search: string;
  sort: string;
  filter: string;
  locale: 'vi' | 'en';
  onTotalCountChange: (count: number) => void;
}

export function DogGrid({ search, sort, filter, locale, onTotalCountChange }: DogGridProps) {
  const { t } = useI18n();
  const [dogBreeds, setDogBreeds] = useState<DogBreedType[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loadingMore, setLoadingMore] = useState(false);
  const [highlightedSlug, setHighlightedSlug] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('highlight');
    }
    return null;
  });

  // Reset state when filters change
  useEffect(() => {
    setDogBreeds([]);
    setPagination({ page: 1, totalPages: 1, total: 0 });
    setLoading(true);
  }, [search, sort, filter, locale]);

  // Fetching effect
  useEffect(() => {
    let isMounted = true;
    const fetchBreeds = async () => {
      if (pagination.page === 1) setLoading(true);
      else setLoadingMore(true);

      try {
        const isCollectedParam = filter === "collected" ? "true" : filter === "uncollected" ? "false" : undefined;
        const response = await apiClient.getDogDex({
          limit: 20,
          page: pagination.page,
          search: search || undefined,
          sort: sort,
          group: filter !== "all" && filter !== "collected" && filter !== "uncollected" ? filter : undefined,
          isCollected: isCollectedParam,
          lang: locale,
        });

        if (isMounted) {
          setDogBreeds((prev) => pagination.page === 1 ? response.breeds : [...prev, ...response.breeds]);
          onTotalCountChange(response.stats?.totalBreeds ?? 0);
          setPagination((prev) => ({
            ...prev,
            totalPages: response.pagination.totalPages,
            total: response.pagination.total, // Lấy tổng số kết quả từ API
          }));
        }
      } catch (error) {
        console.error("Failed to fetch breeds:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    };

    fetchBreeds();
    return () => { isMounted = false; };
  }, [pagination.page, search, sort, filter, locale, onTotalCountChange]);

  // Infinite scroll observer
  const observer = useRef<IntersectionObserver | null>(null);
  const lastDogElementRef = useCallback((node: HTMLElement | null) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && pagination.page < pagination.totalPages) {
        setPagination((prev) => ({ ...prev, page: prev.page + 1 }));
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, pagination.page, pagination.totalPages]);

  // Highlight effect
  useEffect(() => {
    if (highlightedSlug && !loading && dogBreeds.length > 0) {
      const element = document.getElementById(`dog-card-${highlightedSlug}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const timer = setTimeout(() => setHighlightedSlug(null), 2500);
        return () => clearTimeout(timer);
      }
    }
  }, [highlightedSlug, loading, dogBreeds]);

  if (loading && pagination.page === 1) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (dogBreeds.length === 0 && !loading) {
    return <div className="text-center py-12"><p className="text-muted-foreground text-lg">{t('dogdex.noResults')} {search}</p></div>;
  }

  return (
    <>
      <div className="mb-4 text-sm text-muted-foreground">{t('dogdex.showingCount', { count: dogBreeds.length, total: pagination.total })}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {dogBreeds.map((dog, index) => (
          <div ref={dogBreeds.length === index + 1 ? lastDogElementRef : null} key={dog.slug} id={`dog-card-${dog.slug}`}>
            <DogCard dog={dog} index={index} isHighlighted={dog.slug === highlightedSlug} />
          </div>
        ))}
      </div>
      {loadingMore && (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="ml-4 text-muted-foreground">{t('dogdex.loadingMore')}</p>
        </div>
      )}
    </>
  );
}