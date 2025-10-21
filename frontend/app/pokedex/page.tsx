"use client";

import { DogCard } from "@/components/dog-card";
import { Search, Award, ArrowUpDown, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCollection } from "@/lib/collection-context";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useState, useMemo, useEffect, useCallback, useRef, memo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProtectedRoute } from "@/components/protected-route";
import { apiClient } from "@/lib/api-client"
import type { DogBreed as DogBreedType } from "@/lib/types"
import { useI18n } from "@/lib/i18n-context";

// MODIFIED: PokedexHeader được bọc trong React.memo.
// Nó sẽ chỉ re-render nếu một trong các props của nó (như totalCount, searchQuery,...) thực sự thay đổi.
const PokedexHeader = memo(function PokedexHeader({
  collectionStats,
  totalCount,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  filterBy,
  onFilterChange,
  groups,
}: {
  collectionStats: { collectedBreeds: number } | null;
  totalCount: number;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  filterBy: string;
  onFilterChange: (value: string) => void;
  groups: string[];
}) {
  const { t } = useI18n();
  // Dùng console.log để kiểm tra việc re-render (bạn có thể xóa sau)
  console.log("PokedexHeader re-rendered");

  return (
    <header className="border-b-2 border-border bg-card/90 backdrop-blur-sm shadow-sm sticky top-[68px] z-10">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="hidden md:flex items-center gap-3">
            <div className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-bold">
              {t('pokedex.collected')}: {collectionStats?.collectedBreeds ?? 0}/{totalCount}
            </div>
            <Link href="/achievements">
              <Button
                variant="outline"
                size="lg"
                className="gap-2 bg-transparent hover:bg-primary hover:text-primary-foreground"
              >
                <Award className="h-4 w-4" />
                {t('nav.achievements')}
              </Button>
            </Link>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("pokedex.searchPlaceholder")}
              className="pl-10 bg-background border-2"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={onSortChange}>
              <SelectTrigger className="w-full md:w-[180px] bg-background border-2">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue placeholder={t("common.sort")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name-asc">{t("pokedex.sort.nameAsc")}</SelectItem>
                <SelectItem value="name-desc">{t("pokedex.sort.nameDesc")}</SelectItem>
                <SelectItem value="rarity_level-desc">{t("pokedex.sort.rarityDesc")}</SelectItem>
                <SelectItem value="rarity_level-asc">{t("pokedex.sort.rarityAsc")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterBy} onValueChange={onFilterChange}>
              <SelectTrigger className="w-full md:w-[180px] bg-background border-2">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder={t("common.filter")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("pokedex.filter.all")}</SelectItem>
                <SelectItem value="collected">{t("pokedex.filter.collected")}</SelectItem>
                <SelectItem value="uncollected">{t("pokedex.filter.notCollected")}</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group} value={group}>
                    {group}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </header>
  );
});

function PokedexContent() {
  const { t } = useI18n();
  // collectionStats từ đây đã được ổn định nhờ tối ưu trong CollectionProvider
  const { collectionStats, refreshCollection } = useCollection();

  const [dogBreeds, setDogBreeds] = useState<DogBreedType[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");
  const [filterBy, setFilterBy] = useState("all");

  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    refreshCollection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setPagination({ page: 1, totalPages: 1 });
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastDogElementRef = useCallback(
    (node: HTMLElement | null) => {
      if (loading || loadingMore) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (
          entries[0].isIntersecting &&
          pagination.page < pagination.totalPages
        ) {
          setLoadingMore(true);
          setPagination((prev) => ({ ...prev, page: prev.page + 1 }));
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, loadingMore, pagination.page, pagination.totalPages]
  );

  useEffect(() => {
    let isMounted = true;
    const fetchBreeds = async () => {
      if (pagination.page === 1) setLoading(true);

      try {
        const isCollectedParam =
          filterBy === "collected"
            ? "true"
            : filterBy === "uncollected"
            ? "false"
            : undefined;
        const response = await apiClient.getPokedex({
          limit: 20,
          page: pagination.page,
          search: debouncedSearchQuery || undefined,
          sort: sortBy,
          group:
            filterBy !== "all" &&
            filterBy !== "collected" &&
            filterBy !== "uncollected"
              ? filterBy
              : undefined,
          isCollected: isCollectedParam,
        });

        if (isMounted) {
          setDogBreeds((prev) =>
            pagination.page === 1
              ? response.breeds
              : [...prev, ...response.breeds]
          );
          setTotalCount(response.stats?.totalBreeds ?? 0);
          setPagination((prev) => ({
            ...prev,
            totalPages: response.pagination.totalPages,
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
    return () => {
      isMounted = false;
    };
  }, [pagination.page, debouncedSearchQuery, sortBy, filterBy]);

  // MODIFIED: Bọc các hàm handlers trong useCallback để chúng không được tạo lại
  // trên mỗi lần render, giúp memo của PokedexHeader hoạt động đúng.
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);
  
  const handleSortChange = useCallback((value: string) => {
    setSortBy(value);
    setPagination({ page: 1, totalPages: 1 });
  }, []);

  const handleFilterChange = useCallback((value: string) => {
    setFilterBy(value);
    setPagination({ page: 1, totalPages: 1 });
  }, []);

  const groups = useMemo(() => {
    return Array.from(
      new Set([
        "Herding", "Hound", "Non-Sporting", "Sporting",
        "Terrier", "Toy", "Working", "Miscellaneous",
      ])
    ).sort();
  }, []);

  if (loading && pagination.page === 1) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading breeds...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <PokedexHeader
        collectionStats={collectionStats as { collectedBreeds: number } | null}
        totalCount={totalCount}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        sortBy={sortBy}
        onSortChange={handleSortChange}
        filterBy={filterBy}
        onFilterChange={handleFilterChange}
        groups={groups}
      />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-4 text-sm text-muted-foreground">
          {t('pokedex.showingCount', { count: dogBreeds.length, total: totalCount })}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {dogBreeds.map((dog, index) => {
            if (dogBreeds.length === index + 1) {
              return (
                <div ref={lastDogElementRef} key={dog.slug}>
                  <DogCard dog={dog} index={index} />
                </div>
              );
            }
            return <DogCard key={dog.slug} dog={dog} index={index} />;
          })}
        </div>
        {loadingMore && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="ml-4 text-muted-foreground">{t('pokedex.loadingMore')}</p>
          </div>
        )}
        {dogBreeds.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">
              {t('pokedex.noResults')}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

export default function PokedexPage() {
  // Bỏ ProtectedRoute để cho phép khách truy cập
  return <PokedexContent />;
}