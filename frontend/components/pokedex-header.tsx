"use client";

import { memo, useState, useEffect } from "react";
import Link from "next/link";
import { Search, Award, ArrowUpDown, Filter, ChevronUp, ChevronDown, Sparkles, Trophy } from "lucide-react";
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
import { cn } from "@/lib/utils";

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
    // Changed: top values to match the new Navbar height (Mobile: ~56px, Desktop: ~69px)
    <header className="sticky top-[53px] md:top-[69px] z-40 border-b border-white/10 bg-background/60 backdrop-blur-xl shadow-sm transition-all duration-300">
      <div
        className={cn(
          "container mx-auto px-4 transition-all duration-300 ease-in-out relative",
          isExpanded ? "py-4 md:py-6" : "py-0"
        )}
      >
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              key="dogdex-header-content"
              initial="collapsed"
              animate="open"
              exit="collapsed"
              variants={{
                open: { opacity: 1, height: "auto", scale: 1 },
                collapsed: { opacity: 0, height: 0, scale: 0.98 },
              }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              {/* Stats & Achievements Section */}
              <div className="flex flex-row items-center justify-between gap-2 md:gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-4 py-1.5 rounded-full font-bold text-sm md:text-base shadow-sm shadow-primary/10">
                    <Sparkles className="h-4 w-4" />
                    {t("dogdex.collected")}: {collectionStats?.collectedBreeds ?? 0}/{totalCount}
                  </div>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <Link href="/achievements">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 rounded-full hover:bg-secondary/80 text-muted-foreground hover:text-foreground"
                    >
                      <Award className="h-4 w-4 text-amber-500" />
                      <span className="hidden sm:inline">{t("nav.achievements")}</span>
                    </Button>
                  </Link>
                  <Link href="/rank">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 rounded-full hover:bg-secondary/80 text-muted-foreground hover:text-foreground"
                    >
                      <Trophy className="h-4 w-4 text-slate-400" />
                      <span className="hidden sm:inline">{t("nav.rank")}</span>
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Search & Filters Section */}
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("dogdex.searchPlaceholder")}
                    className="pl-10 h-10 md:h-11 bg-secondary/50 border-transparent focus-visible:ring-primary/30 hover:bg-secondary/70 transition-colors rounded-xl"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
                  <Select value={sortBy} onValueChange={onSortChange}>
                    <SelectTrigger className="w-[160px] md:w-[180px] h-10 md:h-11 bg-secondary/50 border-transparent focus:ring-primary/30 hover:bg-secondary/70 rounded-xl">
                      <div className="flex items-center truncate">
                         <ArrowUpDown className="h-4 w-4 mr-2 flex-shrink-0" />
                         <SelectValue placeholder={t("common.sort")} />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name-asc">{t("dogdex.sort.nameAsc")}</SelectItem>
                      <SelectItem value="name-desc">{t("dogdex.sort.nameDesc")}</SelectItem>
                      <SelectItem value="rarity_level-desc">{t("dogdex.sort.rarityDesc")}</SelectItem>
                      <SelectItem value="rarity_level-asc">{t("dogdex.sort.rarityAsc")}</SelectItem>
                      {filterBy === 'collected' && (
                        <>
                          <SelectItem value="collectedAt-desc">{t("dogdex.sort.collectedAtDesc")}</SelectItem>
                          <SelectItem value="collectedAt-asc">{t("dogdex.sort.collectedAtAsc")}</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  
                  <Select value={filterBy} onValueChange={onFilterChange}>
                    <SelectTrigger className="w-[160px] md:w-[180px] h-10 md:h-11 bg-secondary/50 border-transparent focus:ring-primary/30 hover:bg-secondary/70 rounded-xl">
                       <div className="flex items-center truncate">
                        <Filter className="h-4 w-4 mr-2 flex-shrink-0" />
                        <SelectValue placeholder={t("common.filter")} />
                       </div>
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

      {/* Toggle Button - Styled as a Glass Tab */}
      <div className="absolute left-1/2 -bottom-6 transform -translate-x-1/2 z-50">
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-12 rounded-b-xl rounded-t-none bg-background/80 backdrop-blur-md border-b border-x border-white/10 hover:bg-background/90 hover:text-primary transition-all shadow-sm"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? 'Collapse header' : 'Expand header'}
          >
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
      </div>
    </header>
  );
});