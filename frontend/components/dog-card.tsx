"use client"

import Link from "next/link"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Lock, CalendarDays, Star, Dog, Camera, PlusSquare, Video, Webcam } from "lucide-react";
import type { DogBreed } from "@/lib/types";
import { useI18n } from "@/lib/i18n-context";

const RarityStars = ({ level }: { level: number }) => (
  <div className="flex items-center gap-0.5">
    {[...Array(5)].map((_, i) => (
      <Star key={i} className={`h-3.5 w-3.5 ${i < level ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30'}`} />
    ))}
  </div>
);

interface RarityClassSet {
  border: string;
  shadow: string;
  text: string;
  bg: string;
  badgeBg: string;
  badgeBorder: string;
  groupHoverText: string;
}

const getRarityClasses = (rarityLevel: number | undefined): RarityClassSet => {
  switch (rarityLevel) {
    case 1: // Common
      return { border: "border-green-400", shadow: "hover:shadow-green-400/20", text: "text-green-400", bg: "bg-green-400", badgeBg: "bg-green-400/10", badgeBorder: "border-green-400/20", groupHoverText: "group-hover:text-green-400" };
    case 2: // Uncommon
      return { border: "border-sky-400", shadow: "hover:shadow-sky-400/20", text: "text-sky-400", bg: "bg-sky-400", badgeBg: "bg-sky-400/10", badgeBorder: "border-sky-400/20", groupHoverText: "group-hover:text-sky-400" };
    case 3: // Rare
      return { border: "border-amber-500", shadow: "hover:shadow-amber-500/20", text: "text-amber-500", bg: "bg-amber-500", badgeBg: "bg-amber-500/10", badgeBorder: "border-amber-500/20", groupHoverText: "group-hover:text-amber-500" };
    case 4: // Epic
      return { border: "border-purple-600", shadow: "hover:shadow-purple-600/20", text: "text-purple-600", bg: "bg-purple-600", badgeBg: "bg-purple-600/10", badgeBorder: "border-purple-600/20", groupHoverText: "group-hover:text-purple-600" };
    case 5: // Legendary
      return { border: "border-red-500", shadow: "hover:shadow-red-500/20", text: "text-red-500", bg: "bg-red-500", badgeBg: "bg-red-500/10", badgeBorder: "border-red-500/20", groupHoverText: "group-hover:text-red-500" };
    default:
      return { border: "border-primary", shadow: "hover:shadow-primary/20", text: "text-primary", bg: "bg-primary", badgeBg: "bg-primary/10", badgeBorder: "border-primary/20", groupHoverText: "group-hover:text-primary" };
  }
};

interface DogCardProps {
  dog: DogBreed
  index: number,
  isHighlighted?: boolean;
  id?: string;
}

export function DogCard({ dog, index, isHighlighted = false, id }: DogCardProps) {
  const { t } = useI18n();
  const collected = dog.isCollected; // Trust the prop from the parent component
  const rarityClassSet = getRarityClasses(dog.rarity_level);
  const cardBorderClass = collected ? `${rarityClassSet.border} ${rarityClassSet.shadow}` : "border-border";
  const backgroundClass = collected ? "bg-card" : "bg-muted/30";
  const highlightAnimation = isHighlighted ? "animate-pulse-strong" : "";

  const cardContent = (
    <Card
      className={`group relative overflow-hidden border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer ${backgroundClass} ${cardBorderClass} ${highlightAnimation}`}
      id={id}
    >
      {/* Phần nội dung của thẻ không thay đổi */}
      <div className="aspect-square bg-gradient-to-br from-muted to-secondary flex items-center justify-center relative overflow-hidden">
          <img
            // SỬA LỖI: Ưu tiên dùng dog.imageUrl. Nếu không có, mới fallback sang Unsplash.
            src={dog.mediaUrl || `https://source.unsplash.com/300x300/?${encodeURIComponent(dog.breed + " dog")}`}
            alt={dog.breed}
            width={300}
            height={300}
            className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 ${
              collected ? "" : "grayscale opacity-40 blur-[6px]"
            }`}
          />
          {!collected && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="bg-muted/90 rounded-full p-4">
                <Lock className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
          )}
          <div
            className={`absolute top-3 left-3 font-bold px-3 py-1 rounded-full text-sm ${
              collected ? `${rarityClassSet.bg} text-primary-foreground` : "bg-muted text-muted-foreground"
            }`}
          >
            #{dog.pokedexNumber ? String(dog.pokedexNumber).padStart(3, "0") : '???'}
          </div>
          {collected && (
            <div className={`absolute top-3 right-3 ${rarityClassSet.bg} text-primary-foreground rounded-full p-2 shadow-lg animate-in zoom-in duration-300`}>
              <CheckCircle className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="p-4 space-y-2">
          <h3
            className={`font-bold text-xl ${collected ? rarityClassSet.groupHoverText : 'group-hover:text-primary'} transition-colors ${
              collected ? "text-card-foreground" : "text-muted-foreground"
            }`}
          >
            {collected ? dog.breed : "???"}
          </h3>
          <div className="min-h-[16px]">
            {dog.rarity_level && (
              <RarityStars level={dog.rarity_level} />
            )}
          </div>
          {collected ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className={`text-xs ${rarityClassSet.badgeBg} ${rarityClassSet.text} ${rarityClassSet.badgeBorder}`}>
                  <Dog className="h-3 w-3 mr-1" /> {dog.group}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {dog.origin}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 italic">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>
                  {t('dogdex.collectedOn')}: {dog.collectedAt ? new Date(dog.collectedAt).toLocaleDateString() : "N/A"}
                </span>
                {dog.source === 'image_upload' && (
                  <TooltipProvider delayDuration={100}>
                    <Tooltip><TooltipTrigger><Camera className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger><TooltipContent><p>{t('dogdex.sourceImage')}</p></TooltipContent></Tooltip>
                  </TooltipProvider>
                )}
                {dog.source === 'video_upload' && (
                  <TooltipProvider delayDuration={100}>
                    <Tooltip><TooltipTrigger><Video className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger><TooltipContent><p>{t('dogdex.sourceVideo')}</p></TooltipContent></Tooltip>
                  </TooltipProvider>
                )}
                {dog.source === 'stream_capture' && (
                  <TooltipProvider delayDuration={100}>
                    <Tooltip><TooltipTrigger><Webcam className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger><TooltipContent><p>{t('dogdex.sourceStream')}</p></TooltipContent></Tooltip>
                  </TooltipProvider>
                )}
                
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-xs">
                  <Dog className="h-3 w-3 mr-1" /> {dog.group}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {dog.origin}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 italic">
                <Lock className="h-3.5 w-3.5" />
                <p>{t('dogdex.unlockDetails')}</p>
              </div>
            </>
          )}
        </div>
    </Card>
  )

  // Trả về thẻ có thể nhấp để điều hướng nếu đã sưu tầm,
  // ngược lại trả về thẻ hiển thị thông báo khi nhấp.
  return collected ? (
    <Link href={`/breed/${dog.slug}`} className="block h-full">{cardContent}</Link>
  ) : (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Thẻ không thể nhấp, chỉ để hiển thị */}
          <div className="cursor-not-allowed h-full">
            {cardContent}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('dogdex.notCollectedTooltip')}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
