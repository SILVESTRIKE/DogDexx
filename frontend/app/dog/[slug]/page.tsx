"use client"

import { notFound } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { useCollection } from "@/lib/collection-context"
import {
  ArrowLeft,
  Heart,
  Activity,
  Brain,
  Wind,
  Thermometer,
  Wrench,
  Sparkles,
  MapPin,
  Calendar,
  Ruler,
  Utensils,
  AlertCircle,
  CheckCircle,
  XCircle,
  Award,
} from "lucide-react"
import { useEffect, useState } from "react"
import { apiClient } from "@/lib/api-client"
import type { DogBreed } from "@/lib/dog-data"

interface PageProps {
  params: { slug: string }
}

export default function DogDetailPage({ params }: PageProps) {
  const { slug } = params
  const [dog, setDog] = useState<DogBreed | null>(null)
  const [loading, setLoading] = useState(true)
  const { isCollected, toggleCollected } = useCollection()

  useEffect(() => {
    const fetchBreed = async () => {
      try {
        setLoading(true)
        const response = await apiClient.getBreedBySlug(slug)
        setDog(response.breed || response)
      } catch (error) {
        console.error("[v0] Failed to fetch breed:", error)
        setDog(null)
      } finally {
        setLoading(false)
      }
    }

    fetchBreed()
  }, [slug])

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading breed details...</p>
        </div>
      </main>
    )
  }

  if (!dog) {
    notFound()
  }

  const collected = isCollected(dog.slug)

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b-4 border-primary bg-card shadow-md sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/pokedex"
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-semibold"
            >
              <ArrowLeft className="h-5 w-5" />
              Back to DogDex
            </Link>
            <Button
              onClick={() => toggleCollected(dog.slug)}
              variant={collected ? "secondary" : "default"}
              size="lg"
              className="gap-2"
            >
              <CheckCircle className="h-5 w-5" />
              {collected ? "Collected" : "Mark as Collected"}
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Hero Section */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div className="relative">
            <div className="aspect-square rounded-2xl overflow-hidden border-4 border-primary shadow-xl bg-gradient-to-br from-muted to-muted/50">
              <img
                src={`/.jpg?key=n4p6g&height=600&width=600&query=${encodeURIComponent(dog.breed + " dog portrait")}`}
                alt={dog.breed}
                className={`w-full h-full object-cover ${collected ? "" : "grayscale opacity-60"}`}
              />
            </div>
            <div className="absolute top-4 left-4 bg-primary text-primary-foreground font-bold px-4 py-2 rounded-full text-lg shadow-lg">
              #{String((dog.number || 0) + 1).padStart(3, "0")}
            </div>
            {collected && (
              <div className="absolute top-4 right-4 bg-secondary text-secondary-foreground rounded-full p-3 shadow-lg">
                <CheckCircle className="h-6 w-6" />
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <h1 className="text-5xl font-bold text-foreground mb-2">{dog.breed}</h1>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="default" className="text-sm px-3 py-1">
                  <MapPin className="h-3 w-3 mr-1" />
                  {dog.origin}
                </Badge>
                <Badge variant="secondary" className="text-sm px-3 py-1">
                  {dog.group}
                </Badge>
                <Badge variant="outline" className="text-sm px-3 py-1">
                  {dog.coat_type}
                </Badge>
              </div>
              <p className="text-muted-foreground leading-relaxed text-lg">{dog.description}</p>
            </div>

            {/* Quick Stats */}
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Quick Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      Energy Level
                    </span>
                    <span className="text-sm font-bold">{dog.energy_level}/5</span>
                  </div>
                  <Progress value={dog.energy_level * 20} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Brain className="h-4 w-4 text-secondary" />
                      Trainability
                    </span>
                    <span className="text-sm font-bold">{dog.trainability}/5</span>
                  </div>
                  <Progress value={dog.trainability * 20} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Wind className="h-4 w-4 text-accent" />
                      Shedding Level
                    </span>
                    <span className="text-sm font-bold">{dog.shedding_level}/5</span>
                  </div>
                  <Progress value={dog.shedding_level * 20} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-chart-4" />
                      Maintenance
                    </span>
                    <span className="text-sm font-bold">{dog.maintenance_difficulty}/5</span>
                  </div>
                  <Progress value={dog.maintenance_difficulty * 20} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Detailed Information Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Physical Characteristics */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ruler className="h-5 w-5 text-primary" />
                Physical Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Height</p>
                <p className="font-semibold">{dog.height}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Weight</p>
                <p className="font-semibold">{dog.weight}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Life Expectancy</p>
                <p className="font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {dog.life_expectancy}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Coat Colors</p>
                <div className="flex flex-wrap gap-1.5">
                  {dog.coat_colors.map((color) => (
                    <Badge key={color} variant="outline" className="text-xs">
                      {color}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Temperament */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                Temperament
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {dog.temperament.map((trait) => (
                  <Badge key={trait} variant="secondary">
                    {trait}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Climate & Living */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Thermometer className="h-5 w-5 text-primary" />
                Living Conditions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Climate Preference</p>
                <p className="font-semibold">{dog.climate_preference}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Good With Children</p>
                <Badge variant={dog.good_with_children ? "default" : "destructive"}>
                  {dog.good_with_children ? (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  ) : (
                    <XCircle className="h-3 w-3 mr-1" />
                  )}
                  {dog.good_with_children ? "Yes" : "No"}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Good With Other Pets</p>
                <Badge variant={dog.good_with_other_pets ? "default" : "destructive"}>
                  {dog.good_with_other_pets ? (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  ) : (
                    <XCircle className="h-3 w-3 mr-1" />
                  )}
                  {dog.good_with_other_pets ? "Yes" : "No"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Details */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Suitable For */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-secondary" />
                Suitable For
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {dog.suitable_for.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-secondary flex-shrink-0" />
                    <span className="capitalize">{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Not Suitable For */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                Not Suitable For
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {dog.unsuitable_for.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                    <span className="capitalize">{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Care Information */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Favorite Foods */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Utensils className="h-5 w-5 text-primary" />
                Favorite Foods
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {dog.favorite_foods.map((food) => (
                  <Badge key={food} variant="secondary" className="capitalize">
                    {food}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Health Issues */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Common Health Issues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {dog.common_health_issues.map((issue) => (
                  <li key={issue} className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                    <span className="capitalize">{issue}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Trainable Skills */}
        <Card className="border-2 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-accent" />
              Trainable Skills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {dog.trainable_skills.map((skill) => (
                <Badge key={skill} variant="outline" className="capitalize">
                  {skill}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Fun Fact */}
        <Card className="border-2 border-accent bg-accent/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              Fun Fact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg leading-relaxed">{dog.fun_fact}</p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
