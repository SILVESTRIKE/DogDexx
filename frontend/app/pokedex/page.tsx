"use client"

import { DogCard } from "@/components/dog-card"
import { Search, Award, ArrowUpDown, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useCollection } from "@/lib/collection-context"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useState, useMemo, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ProtectedRoute } from "@/components/protected-route"
import { apiClient } from "@/lib/api-client"
import type { DogBreed } from "@/lib/dog-data"
import { useI18n } from "@/lib/i18n-context"

function PokedexContent() {
  const { t } = useI18n()
  const { collectionCount } = useCollection()
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("number")
  const [filterBy, setFilterBy] = useState("all")
  const [dogBreeds, setDogBreeds] = useState<DogBreed[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    const fetchBreeds = async () => {
      try {
        setLoading(true)
        const response = await apiClient.getPokedex()
        setDogBreeds(response.data || [])
        setTotalCount(response.total || response.data?.length || 0)
      } catch (error) {
        console.error("[v0] Failed to fetch breeds:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchBreeds()
  }, [])

  const filteredAndSortedDogs = useMemo(() => {
    const filtered = dogBreeds.filter((dog) => {
      const matchesSearch = (dog as any).display_name.toLowerCase().includes(searchQuery.toLowerCase())
      if (filterBy === "all") return matchesSearch
      if (filterBy === "collected") {
        return matchesSearch && dog.isCollected
      }
      if (filterBy === "uncollected") {
        return matchesSearch && !dog.isCollected
      }
      return matchesSearch && dog.group === filterBy
    })

    return filtered.sort((a, b) => {
      if (sortBy === "number") {
        return (a.number || 0) - (b.number || 0)
      }
      if (sortBy === "name-asc") {
        return (a as any).display_name.localeCompare((b as any).display_name)
      }
      if (sortBy === "name-desc") {
        return (b as any).display_name.localeCompare((a as any).display_name)
      }
      return 0
    })
  }, [dogBreeds, searchQuery, sortBy, filterBy])

  const groups = useMemo(() => {
    const uniqueGroups = new Set(dogBreeds.map((dog) => dog.group))
    return Array.from(uniqueGroups).sort()
  }, [dogBreeds])

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading breeds...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b-2 border-border bg-card shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-1">DogDex</h1>
              <p className="text-muted-foreground">Discover and explore dog breeds from around the world</p>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <div className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-bold">
                {collectionCount}/{totalCount} Collected
              </div>
              <Link href="/achievements">
                <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                  <Award className="h-4 w-4" />
                  Achievements
                </Button>
              </Link>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search for a dog breed..."
                className="pl-10 bg-background border-2"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px] bg-background border-2">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                  <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterBy} onValueChange={setFilterBy}>
                <SelectTrigger className="w-[180px] bg-background border-2">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dogs</SelectItem>
                  <SelectItem value="collected">Collected</SelectItem>
                  <SelectItem value="uncollected">Not Collected</SelectItem>
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

      {/* Grid */}
      <div className="container mx-auto px-4 py-8">
        <div className="mb-4 text-sm text-muted-foreground">
          Showing {filteredAndSortedDogs.length} of {totalCount} breeds
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredAndSortedDogs.map((dog) => (
            <DogCard key={dog._id.$oid} dog={dog} index={dog.number || 0} />
          ))}
        </div>

        {filteredAndSortedDogs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">No dogs found matching your criteria</p>
          </div>
        )}
      </div>
    </main>
  )
}

export default function PokedexPage() {
  return (
    <ProtectedRoute>
      <PokedexContent />
    </ProtectedRoute>
  )
}
