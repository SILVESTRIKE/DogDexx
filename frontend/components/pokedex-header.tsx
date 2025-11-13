"use client";

import { memo, useState, useEffect } from "react";
import Link from "next/link";
import { Search, Award, ArrowUpDown, Filter, ChevronUp, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n-context";
import { motion, AnimatePresence } from "framer-motion";

export const DogDexHeader = memo(function DogDexHeader({
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
  const [isExpanded, setIsExpanded] = useState(true);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsExpanded(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="border-b-2 border-border bg-card/90 backdrop-blur-sm shadow-sm sticky top-[68px] z-10">
      <div
        className={`container mx-auto px-4 transition-all duration-300 ease-in-out ${
          isExpanded ? "pt-6 pb-8" : "pb-5"
        }`}
      >
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              key="dogdex-header-content"
              initial="collapsed"
              animate="open"
              exit="collapsed"
              variants={{
                open: { opacity: 1, height: "auto" },
                collapsed: { opacity: 0, height: 0 },
              }}
              transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="hidden md:flex items-center gap-3">
                  <div className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-bold">
                    {t("dogdex.collected")}: {collectionStats?.collectedBreeds ?? 0}/{totalCount}
                  </div>
                  <Link href="/achievements">
                    <Button
                      variant="outline"
                      size="lg"
                      className="gap-2 bg-transparent hover:bg-primary hover:text-primary-foreground"
                    >
                      <Award className="h-4 w-4" />
                      {t("nav.achievements")}
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("dogdex.searchPlaceholder")}
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
                      <SelectItem value="name-asc">{t("dogdex.sort.nameAsc")}</SelectItem>
                      <SelectItem value="name-desc">{t("dogdex.sort.nameDesc")}</SelectItem>
                      <SelectItem value="rarity_level-desc">{t("dogdex.sort.rarityDesc")}</SelectItem>
                      <SelectItem value="rarity_level-asc">{t("dogdex.sort.rarityAsc")}</SelectItem>
                      {/* Chỉ hiển thị tùy chọn sắp xếp theo ngày khi đang lọc các con đã sưu tầm */}
                      {filterBy === 'collected' && (
                        <>
                          <SelectItem value="collectedAt-desc">{t("dogdex.sort.collectedAtDesc")}</SelectItem>
                          <SelectItem value="collectedAt-asc">{t("dogdex.sort.collectedAtAsc")}</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <Select value={filterBy} onValueChange={onFilterChange}>
                    <SelectTrigger className="w-full md:w-[180px] bg-background border-2">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder={t("common.filter")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("dogdex.filter.all")}</SelectItem>
                      <SelectItem value="collected">{t("dogdex.filter.collected")}</SelectItem>
                      <SelectItem value="uncollected">{t("dogdex.filter.notCollected")}</SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group} value={group}>
                          {group}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* nút toggle gắn liền với header */}
      <div className="absolute left-1/2 -bottom-[14px] transform -translate-x-1/2">
        <div className="relative">
          <div className="absolute -top-[6px] left-1/2 -translate-x-1/2 w-0 h-0 border-transparent border-t-card" />
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 border-2 shadow-sm bg-card border-border rounded-md hover:bg-accent transition-all duration-300 ease-in-out"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? 'Collapse header' : 'Expand header'}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
});
