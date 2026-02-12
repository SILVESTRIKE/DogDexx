"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Radar, MapPin, RefreshCw, ScanSearch, ChevronRight } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useI18n } from "@/lib/i18n-context";
import { cn } from "@/lib/utils";

// Dynamic import to avoid SSR issues with Leaflet
const RadarMap = dynamic(() => import("@/components/maps/RadarMap"), {
    ssr: false,
    loading: () => (
        <div className="h-full w-full flex flex-col items-center justify-center bg-muted/30 text-muted-foreground gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
            <span className="text-xs font-medium">Đang tải bản đồ...</span>
        </div>
    ),
});

interface FoundPost {
    _id: string;
    type: "LOST" | "FOUND";
    photos: string[];
    ai_metadata?: {
        breed: string;
        confidence: number;
    };
    location?: {
        type: "Point";
        coordinates: [number, number]; // [lng, lat]
        address?: string;
    };
    createdAt: string;
}

interface DogRadarProps {
    center: [number, number];
    breed: string;
    sourceType?: "LOST" | "FOUND";
    variant?: "full" | "minimal";
    radius?: number;
    initialRadius?: number;
    showRadiusControls?: boolean;
    showResultsGrid?: boolean;
    excludePostId?: string;
}

export function DogRadar({
    center,
    breed,
    sourceType = "LOST",
    variant = "minimal",
    radius: radiusProp,
    initialRadius = 10,
    showRadiusControls = true,
    showResultsGrid = true,
    excludePostId,
}: DogRadarProps) {
    const { t } = useI18n();
    const [loading, setLoading] = useState(false);
    const [foundPosts, setFoundPosts] = useState<FoundPost[]>([]);
    const [radius, setRadius] = useState(radiusProp ?? initialRadius);
    const [error, setError] = useState<string | null>(null);

    const fetchRadarData = useCallback(async function () {
        if (!center || (center[0] === 0 && center[1] === 0)) {
            setError(t("radar.noLocation"));
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const posts = await apiClient.getRadarPosts({
                lat: center[0],
                lng: center[1],
                radius: radius,
                breed: breed,
                sourceType: sourceType,
            });

            let results = Array.isArray(posts) ? posts : posts?.data || [];

            if (excludePostId) {
                results = results.filter((p: FoundPost) => p._id !== excludePostId);
            }

            setFoundPosts(results);
        } catch (err) {
            console.error("Radar fetch error:", err);
            setError(t("common.error"));
        } finally {
            setLoading(false);
        }
    }, [center, radius, breed, sourceType, excludePostId, t]);

    useEffect(() => {
        if (center && center[0] !== 0) {
            fetchRadarData();
        }
    }, [center, radius, fetchRadarData]);

    if (!center || (center[0] === 0 && center[1] === 0)) {
        if (variant === "full") {
            return (
                <Card className="border-dashed shadow-none bg-muted/20">
                    <CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center">
                        <div className="p-4 bg-muted rounded-full mb-3">
                            <Radar className="h-8 w-8 opacity-40" />
                        </div>
                        <p>{t("radar.noLocation")}</p>
                    </CardContent>
                </Card>
            );
        }
        return null;
    }

    // --- LEGEND COMPONENT (Shared) ---
    const RadarLegend = () => (
        <div className="absolute top-3 right-3 z-[400] bg-background/80 backdrop-blur-md border border-border/50 p-2.5 rounded-xl shadow-lg text-[10px] font-medium space-y-1.5 pointer-events-none select-none">
            <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50"></span>
                <span className="opacity-80">{t("radar.lostCenter")}</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-sm shadow-yellow-500/50"></span>
                <span className="opacity-80">AI Match</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm shadow-green-500/50"></span>
                <span className="opacity-80">Verified (QR)</span>
            </div>
        </div>
    );

    // --- MINIMAL VARIANT (Used inside PostDetail cards) ---
    if (variant === "minimal") {
        return (
            <div className="relative w-full h-full min-h-[300px] bg-muted/20 group isolate">
                <RadarLegend />
                <div className="absolute inset-0 z-0 rounded-b-xl overflow-hidden">
                    <RadarMap center={center} radius={radius} foundPosts={foundPosts} />
                </div>

                {/* Minimal Overlay Info */}
                <div className="absolute bottom-3 left-3 right-3 z-[400]">
                    <div className="bg-background/90 backdrop-blur-md border border-border/50 p-2 rounded-lg shadow-sm flex items-center justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1">
                            <ScanSearch className="h-3 w-3" />
                            Bán kính: <b>{radius}km</b>
                        </span>
                        {foundPosts.length > 0 && (
                            <span className="text-green-600 font-bold bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                                {foundPosts.length} matches
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // --- FULL VARIANT (Standalone Tool) ---
    return (
        <Card className="overflow-hidden border-border/60 shadow-lg rounded-2xl flex flex-col">
            <CardHeader className="pb-3 border-b bg-muted/10">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-xl font-bold">
                            <Radar className="h-5 w-5 text-primary" />
                            {t("radar.title")}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>Scanning for: <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{breed}</Badge></span>
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 rounded-full"
                            onClick={fetchRadarData}
                            disabled={loading}
                        >
                            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-0 flex-1 flex flex-col">
                {/* Map Area */}
                <div className="h-[400px] relative w-full bg-muted/20 isolate">
                    <RadarLegend />
                    {loading && (
                        <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] z-[500] flex items-center justify-center">
                            <div className="bg-background shadow-xl rounded-2xl p-4 flex flex-col items-center gap-2 border">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                <span className="text-xs font-semibold">AI is scanning area...</span>
                            </div>
                        </div>
                    )}
                    <RadarMap center={center} radius={radius} foundPosts={foundPosts} />
                </div>

                {/* Radius Controls Toolbar */}
                {showRadiusControls && (
                    <div className="px-4 py-3 border-b bg-background flex items-center justify-between gap-4">
                        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{t("radar.expandRadius")}</span>
                        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
                            {[5, 10, 20, 50].map((r) => (
                                <button
                                    key={r}
                                    onClick={() => setRadius(r)}
                                    className={cn(
                                        "text-xs px-3 py-1 rounded-md transition-all font-medium",
                                        radius === r
                                            ? "bg-background text-primary shadow-sm border border-border/50"
                                            : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                                    )}
                                >
                                    {r}km
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Results Grid */}
                {showResultsGrid && (
                    <div className="p-4 bg-muted/5 flex-1">
                        {error ? (
                            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg text-center border border-destructive/20">
                                {error}
                            </div>
                        ) : foundPosts.length > 0 ? (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold flex items-center gap-2">
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{foundPosts.length}</Badge>
                                        <span className="text-muted-foreground">{t("radar.foundMatchesText") || "Kết quả phù hợp"}</span>
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                                    {foundPosts.map((post) => (
                                        <Link
                                            key={post._id}
                                            href={`/community/${post._id}`}
                                            target="_blank"
                                            className="group relative aspect-square rounded-xl overflow-hidden border border-border bg-background shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
                                        >
                                            {post.photos?.[0] ? (
                                                <img
                                                    src={post.photos[0]}
                                                    alt="Found dog"
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center bg-secondary text-muted-foreground">
                                                    <Radar className="h-6 w-6 opacity-20 mb-1" />
                                                </div>
                                            )}

                                            {/* Gradient Overlay */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

                                            {/* Content Overlay */}
                                            <div className="absolute bottom-2 left-2 right-2 flex flex-col gap-0.5">
                                                <div className="flex items-center gap-1 text-[10px] text-white/90 font-medium">
                                                    <MapPin className="h-3 w-3 shrink-0" />
                                                    <span className="truncate">{new Date(post.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                {post.ai_metadata?.confidence && (
                                                    <div className="text-[9px] text-green-300 font-bold">
                                                        {(post.ai_metadata.confidence * 100).toFixed(0)}% Match
                                                    </div>
                                                )}
                                            </div>

                                            {/* Type Badge */}
                                            <div className={cn(
                                                "absolute top-2 right-2 text-[8px] px-1.5 py-0.5 rounded-sm font-bold shadow-sm backdrop-blur-sm",
                                                post.type === "FOUND" ? "bg-green-500/90 text-white" : "bg-red-500/90 text-white"
                                            )}>
                                                {post.type}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="py-8 text-center text-muted-foreground bg-background border border-dashed rounded-xl">
                                <ScanSearch className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                <p className="text-sm">{t("radar.noMatches")}</p>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}