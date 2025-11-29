"use client";

import { useCollection } from "@/lib/collection-context";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n-context";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { DogDexHeader } from "@/components/pokedex-header";
import { DogGrid } from "@/components/dog-grid";

export default function DogDexPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { collectionStats, refreshCollection } = useCollection();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || "");
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || "name-asc");
  const [filterBy, setFilterBy] = useState(searchParams.get('filter') || "all");

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);

  useEffect(() => {
    refreshCollection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // useEffect để debounce và cập nhật URL
  useEffect(() => {
    const handler = setTimeout(() => {
      // 1. Cập nhật state đã debounce để trigger DogGrid
      setDebouncedSearchQuery(searchQuery);

      // 2. Cập nhật URL một cách không đồng bộ
      const params = new URLSearchParams(searchParams);
      if (searchQuery) params.set('search', searchQuery); else params.delete('search');
      if (sortBy !== 'name-asc') params.set('sort', sortBy); else params.delete('sort');
      if (filterBy !== 'all') params.set('filter', filterBy); else params.delete('filter');
      // Không xóa highlight ở đây, để DogGrid tự xử lý
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 300);

    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, sortBy, filterBy]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const handleSortChange = useCallback((value: string) => {
    setSortBy(value);
  }, []);

  const handleFilterChange = useCallback((value: string) => {
    setFilterBy(value);
  }, []);

  const groups = useMemo(() => {
    return Array.from(
      new Set([
        "Herding", "Hound", "Non-Sporting", "Sporting",
        "Terrier", "Toy", "Working", "Wild", "Primitive"
      ])
    ).sort();
  }, []);

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <DogDexHeader
        collectionStats={collectionStats}
        totalCount={collectionStats?.totalBreeds ?? 0}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        sortBy={sortBy}
        onSortChange={handleSortChange}
        filterBy={filterBy}
        onFilterChange={handleFilterChange}
        groups={groups}
      />
      <div className="container mx-auto px-4 py-8">
        <DogGrid
          search={debouncedSearchQuery}
          sort={sortBy}
          filter={filterBy}
          locale={locale}
          onTotalCountChange={() => {}}
        />
      </div>
    </main>
  );
}