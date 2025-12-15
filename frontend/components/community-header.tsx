"use client";

import { memo, useState, useEffect } from "react";
import Link from "next/link";
import { Search, Plus, Sparkles, MapPin, ChevronUp, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n-context";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface CommunityHeaderProps {
    activeTab: "all" | "lost" | "found";
    onTabChange: (val: "all" | "lost" | "found") => void;
    breedFilter: string;
    onBreedFilterChange: (val: string) => void;
    sortByDistance: boolean;
    onSortByDistanceChange: () => void;
    userLocation: { lat: number; lng: number } | null;
    setUserLocation: (loc: { lat: number; lng: number } | null) => void;
}

export const CommunityHeader = memo(function CommunityHeader({
    activeTab,
    onTabChange,
    breedFilter,
    onBreedFilterChange,
    sortByDistance,
    onSortByDistanceChange,
    userLocation,
    setUserLocation,
}: CommunityHeaderProps) {
    const { t } = useI18n();
    const [isExpanded, setIsExpanded] = useState(true);
    const [localSearch, setLocalSearch] = useState(breedFilter);

    // Sync local search when prop changes (e.g. clear filters)
    useEffect(() => {
        setLocalSearch(breedFilter);
    }, [breedFilter]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (localSearch !== breedFilter) {
                onBreedFilterChange(localSearch);
            }
        }, 400); // 400ms debounce
        return () => clearTimeout(timer);
    }, [localSearch, breedFilter, onBreedFilterChange]);

    // Handle Location Click
    const handleLocationClick = () => {
        if (sortByDistance) {
            onSortByDistanceChange(); // Turn off
            setUserLocation(null);
        } else {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        setUserLocation({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                        });
                        onSortByDistanceChange(); // Turn on
                    },
                    (error) => alert(t("community.header.location.permissionError"))
                );
            } else {
                alert(t("community.header.location.unsupportedError"));
            }
        }
    };

    return (
        <header className="sticky top-[53px] md:top-[69px] z-40 border-b border-white/10 bg-background/60 backdrop-blur-xl shadow-md transition-all duration-300 px-4">
            <div
                className={cn(
                    "container mx-auto transition-all duration-300 ease-in-out relative",
                    isExpanded ? "py-6" : "py-0"
                )}
            >
                <AnimatePresence initial={false}>
                    {isExpanded && (
                        <motion.div
                            key="community-header-content"
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
                            {/* HERO SECTION */}
                            <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-6">
                                <div className="space-y-2">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20 mb-2">
                                        <Sparkles className="w-3 h-3" />
                                        <span>{t("community.header.aiBadge")}</span>
                                    </div>
                                    <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight">
                                        {t("community.header.title")}
                                    </h1>
                                    <p className="text-muted-foreground text-sm md:text-md max-w-xl leading-relaxed">
                                        {t("community.header.subtitle")}
                                    </p>
                                </div>
                            </div>

                            {/* CONTROLS BAR */}
                            <div className="bg-background/40 backdrop-blur-md border border-white/10 dark:border-white/5 p-2 rounded-2xl shadow-inner mb-2">
                                <div className="flex flex-col md:flex-row gap-2">
                                    {/* Tabs */}
                                    <Tabs
                                        value={activeTab}
                                        onValueChange={(v) => onTabChange(v as "all" | "lost" | "found")}
                                        className="w-full md:w-auto shrink-0"
                                    >
                                        <TabsList className="bg-muted/50 p-1 h-12 rounded-xl w-full md:w-auto grid grid-cols-3 md:flex">
                                            <TabsTrigger
                                                value="all"
                                                className="rounded-lg h-10 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                                            >
                                                {t("community.header.filters.all")}
                                            </TabsTrigger>
                                            <TabsTrigger
                                                value="lost"
                                                className="rounded-lg h-10 px-4 data-[state=active]:bg-red-50 dark:data-[state=active]:bg-red-900/20 data-[state=active]:text-red-600"
                                            >
                                                {t("community.header.filters.lost")}
                                            </TabsTrigger>
                                            <TabsTrigger
                                                value="found"
                                                className="rounded-lg h-10 px-4 data-[state=active]:bg-green-50 dark:data-[state=active]:bg-green-900/20 data-[state=active]:text-green-600"
                                            >
                                                {t("community.header.filters.found")}
                                            </TabsTrigger>
                                        </TabsList>
                                    </Tabs>

                                    <div className="flex-1 flex gap-2">
                                        {/* Breed Search */}
                                        <div className="relative flex-1 group">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <Input
                                                placeholder={t("community.header.searchPlaceholder")}
                                                value={localSearch}
                                                onChange={(e) => setLocalSearch(e.target.value)}
                                                className="pl-10 h-12 rounded-xl bg-muted/30 border-transparent hover:bg-muted/50 focus:bg-background focus:border-primary/50 transition-all font-medium"
                                            />
                                        </div>

                                        {/* Location Filter */}
                                        <Button
                                            variant={sortByDistance ? "default" : "outline"}
                                            className={cn(
                                                "h-12 px-4 rounded-xl border-transparent bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground shrink-0",
                                                sortByDistance &&
                                                "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                                            )}
                                            onClick={handleLocationClick}
                                        >
                                            <MapPin
                                                className={cn(
                                                    "h-4 w-4 md:mr-2",
                                                    sortByDistance && "animate-pulse"
                                                )}
                                            />
                                            <span className="hidden md:inline">
                                                {sortByDistance
                                                    ? t("community.header.location.nearMeActive")
                                                    : t("community.header.location.nearMe")}
                                            </span>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Toggle Button */}
            <div className="absolute left-1/2 -bottom-6 transform -translate-x-1/2 z-50">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-14 rounded-b-2xl rounded-t-none bg-background/60 backdrop-blur-xl border-b border-x border-white/10 hover:bg-background/80 hover:text-primary transition-all shadow-sm flex items-center justify-center p-0"
                    onClick={() => setIsExpanded(!isExpanded)}
                    title={isExpanded ? t("community.header.collapse") : t("community.header.expand")}
                >
                    {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                    ) : (
                        <ChevronDown className="h-4 w-4" />
                    )}
                </Button>
            </div>
        </header>
    );
});
