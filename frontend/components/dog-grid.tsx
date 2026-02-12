"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { DogCard } from "@/components/dog-card";
import { apiClient } from "@/lib/api-client";
// Import Type để fix lỗi 'dog implicitly has any type'
import type { DogBreed as DogBreedType } from "@/lib/types"; 
import { useI18n } from "@/lib/i18n-context";
import { SearchX } from "lucide-react";

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

  useEffect(() => {
    setDogBreeds([]);
    setPagination({ page: 1, totalPages: 1, total: 0 });
    setLoading(true); 
  }, [search, sort, filter, locale]);

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
          setDogBreeds((prev) => {
            if (pagination.page === 1) {
              return response.breeds;
            } 
            else {
              const existingSlugs = new Set(prev.map((dog: DogBreedType) => dog.slug));
              const newUniqueBreeds = response.breeds.filter((dog: DogBreedType) => !existingSlugs.has(dog.slug));
              
              return [...prev, ...newUniqueBreeds];
            }
          });

          onTotalCountChange(response.stats?.totalBreeds ?? 0);
          setPagination((prev) => ({
            ...prev,
            totalPages: response.pagination.totalPages,
            total: response.pagination.total,
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
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin"></div>
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">{t('common.loading') || "Loading collection..."}</p>
      </div>
    );
  }

  if (dogBreeds.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in zoom-in-95">
         <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mb-4 ring-1 ring-white/10">
           <SearchX className="h-8 w-8 text-muted-foreground" />
         </div>
         <h3 className="text-lg font-semibold mb-1">{t('dogdex.noResults')}</h3>
         <p className="text-muted-foreground text-sm max-w-xs">{search ? `"${search}"` : t('dogdex.emptyFilterDesc') || "Try adjusting your filters"}</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>{t('dogdex.showingCount', { count: dogBreeds.length, total: pagination.total })}</span>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {dogBreeds.map((dog, index) => (
          <div ref={dogBreeds.length === index + 1 ? lastDogElementRef : null} key={dog.slug} id={`dog-card-${dog.slug}`}>
            <DogCard dog={dog} index={index} isHighlighted={dog.slug === highlightedSlug} />
          </div>
        ))}
      </div>
      
      {loadingMore && (
        <div className="flex justify-center items-center py-8">
          <div className="h-6 w-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin"></div>
        </div>
      )}
    </div>
  );
}