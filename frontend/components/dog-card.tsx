"use client"

import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { DogBreed } from "@/lib/dog-data"
import { useCollection } from "@/lib/collection-context"
import { CheckCircle, Lock } from "lucide-react"

interface DogCardProps {
  dog: DogBreed
  index: number
}

export function DogCard({ dog, index }: DogCardProps) {
  const { isCollected } = useCollection()
  const collected = isCollected(dog.slug)

  return (
    <Link href={`/dog/${dog.slug}`}>
      <Card
        className={`group relative overflow-hidden border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer ${
          collected ? "bg-card border-primary shadow-md" : "bg-muted/30 border-border"
        }`}
      >
        <div className="aspect-square bg-gradient-to-br from-muted to-secondary flex items-center justify-center relative overflow-hidden">
          <img
            // Ưu tiên dùng imageUrl từ props, nếu không có mới fallback sang Unsplash
            src={ `https://source.unsplash.com/300x300/?${encodeURIComponent(dog.breed + " dog")}`}
            alt={dog.breed}
            width={300}
            height={300}
            className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 ${
              collected ? "" : "grayscale opacity-40 blur-[2px]"
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
              collected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            #{String(index + 1).padStart(3, "0")}
          </div>

          {collected && (
            <div className="absolute top-3 right-3 bg-primary text-primary-foreground rounded-full p-2 shadow-lg animate-in zoom-in duration-300">
              <CheckCircle className="h-5 w-5" />
            </div>
          )}
        </div>

        <div className="p-4 space-y-2">
          <h3
            className={`font-bold text-xl group-hover:text-primary transition-colors ${
              collected ? "text-card-foreground" : "text-muted-foreground"
            }`}
          >
            {collected ? dog.breed : "???"}
          </h3>

          {collected ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                  {dog.group}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {dog.origin}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{dog.description}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">Collect this dog to unlock details</p>
          )}
        </div>
      </Card>
    </Link>
  )
}
