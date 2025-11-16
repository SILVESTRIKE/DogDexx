"use client"

import { notFound, useParams } from "next/navigation"
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
  Stethoscope
} from "lucide-react"
import {HealthRecommendations} from "@/components/health_rec"
import { useI18n } from "@/lib/i18n-context"
import React, { useEffect, useState } from "react" // Import React
import { apiClient } from "@/lib/api-client"
import type { DogBreed } from "@/lib/types"

// Define a new type that matches the API response from bff_content.controller
interface EnrichedDogBreed {
  breed: DogBreed // The core breed info
  collectionStatus: {
    isCollected: boolean;
    collectedAt: string | null;
  };
  media: {
    url: string;
    type: string;
  }[];
}

interface PageProps {
  params: { slug: string }
}

export default function DogDetailPage() {
  const [data, setData] = useState<EnrichedDogBreed | null>(null);
  const [loading, setLoading] = useState(true)
  const { toggleCollected } = useCollection()
  const { t, locale } = useI18n()
  const params = useParams() as { slug: string }; // Lấy params bằng hook

  useEffect(() => {
    const fetchBreed = async () => {
      try {
        setLoading(true)
        const slug = params.slug; // Sử dụng slug từ hook
        const response = await apiClient.getBreedBySlug(slug, locale)
        setData(response); // The API returns the full object { breed, collectionStatus, media }
      } catch (error) {
        console.error("[v0] Failed to fetch breed:", error)
        setData(null);
      } finally {
        setLoading(false)
      }
    }

    fetchBreed()
  }, [params, t, locale])

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </main>
    )
  }

  if (!data || !data.breed) {
    notFound()
  }

  // Use the collection status directly from the API response
  const dog = data.breed;
  const collected = data.collectionStatus.isCollected;

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b-4 border-primary bg-card shadow-md sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/dogdex"
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-semibold"
            >
              <ArrowLeft className="h-5 w-5" />
              {t('dogDetails.backToDogDex')}
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Hero Section */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div className="relative">
            <div className="aspect-square rounded-2xl overflow-hidden border-4 border-primary shadow-xl bg-gradient-to-br from-muted to-muted/50">
              <img
                src={dog.mediaUrl || `https://via.placeholder.com/600?text=${encodeURIComponent(dog.breed)}`}
                alt={dog.breed}
                className={`w-full h-full object-cover ${collected ? "" : "opacity-60"}`}
              />
            </div>
            <div className="absolute top-4 left-4 bg-primary text-primary-foreground font-bold px-4 py-2 rounded-full text-lg shadow-lg">
              #{dog.dogdexNumber ? String(dog.dogdexNumber).padStart(3, "0") : '000'}
            </div>
            
          </div>

          <div className="space-y-6">
            <div>
              <h1 className="text-5xl font-bold text-foreground mb-2">{dog.breed}</h1>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="default" className="text-sm px-3 py-1">
                  <MapPin className="h-3 w-3 mr-1" />
                  {dog.origin}
                </Badge>
                <Link href={`/dogdex?filter=${encodeURIComponent(dog.group || '')}`}>
                  <Badge variant="secondary" className="text-sm px-3 py-1 hover:bg-primary/80 hover:text-primary-foreground transition-colors cursor-pointer">
                    {dog.group}
                  </Badge>
                </Link>
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
                  <Sparkles className="h-5 w-5 text-yellow-500" />
                  {t('dogDetails.quickStats')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Activity className="h-4 w-4 text-chart-4" />
                      {t('results.energy')}
                    </span>
                    <span className="text-sm font-bold">{dog.energy_level}/5</span>
                  </div>
                  <Progress value={(dog.energy_level ?? 0) * 20} className="h-2" indicatorClassName="bg-chart-4" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Brain className="h-4 w-4 text-amber-500" />
                      {t('results.trainability')}
                    </span>
                    <span className="text-sm font-bold">{dog.trainability}/5</span>
                  </div>
                  <Progress value={(dog.trainability ?? 0) * 20} className="h-2" indicatorClassName="bg-amber-500" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Wind className="h-4 w-4 text-gray-500" />
                      {t('results.shedding')}
                    </span>
                    <span className="text-sm font-bold">{dog.shedding_level}/5</span>
                  </div>
                  <Progress value={(dog.shedding_level ?? 0) * 20} className="h-2" indicatorClassName="bg-gray-500" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-chart-1" />
                      {t('dogDetails.maintenance')}
                    </span>
                    <span className="text-sm font-bold">{dog.maintenance_difficulty}/5</span>
                  </div>
                  <Progress value={(dog.maintenance_difficulty ?? 0) * 20} className="h-2" indicatorClassName="bg-chart-1" />
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
                {t('results.physicalInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">{t('results.height')}</p>
                <p className="font-semibold">{dog.height}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('results.weight')}</p>
                <p className="font-semibold">{dog.weight}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('results.lifespan')}</p>
                <p className="font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {dog.life_expectancy}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">{t('results.coatColors')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(dog.coat_colors ?? []).map((color) => (
                    <Badge key={color} variant="outline" className="text-sm">
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
                {t('results.temperament')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(dog.temperament ?? []).map((trait) => (
                  <Badge key={trait} variant="secondary" className="text-sm">
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
                {t('dogDetails.livingConditions')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">{t('dogDetails.climatePreference')}</p>
                <p className="font-semibold">{dog.climate_preference}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">{t('dogDetails.goodWithChildren')}</p>
                <Badge variant={dog.good_with_children ? "default" : "destructive"} className="text-sm">
                  {dog.good_with_children ? (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  ) : (
                    <XCircle className="h-3 w-3 mr-1" />
                  )}
                  {dog.good_with_children ? t('feedback.yes') : t('feedback.no')}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">{t('dogDetails.goodWithPets')}</p>
                <Badge variant={dog.good_with_other_pets ? "default" : "destructive"} className="text-sm">
                  {dog.good_with_other_pets ? (
                    <CheckCircle className="h-3 w-3 mr-1 text-chart-1" />
                  ) : (
                    <XCircle className="h-3 w-3 mr-1" />
                  )}
                  {dog.good_with_other_pets ? t('feedback.yes') : t('feedback.no')}
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
                <CheckCircle className="h-5 w-5 text-chart-1" />
                {t('dogDetails.suitableFor')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {(dog.suitable_for ?? []).map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 flex-shrink-0 text-chart-1" />
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
                {t('dogDetails.notSuitableFor')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {(dog.unsuitable_for ?? []).map((item) => (
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
                <Utensils className="h-5 w-5 text-amber-500" />
                {t('dogDetails.favoriteFoods')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(dog.favorite_foods ?? []).map((food) => (
                  <Badge key={food} variant="secondary" className="text-sm capitalize">
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
                <Stethoscope className="h-5 w-5 text-chart-4" />
                {t('dogDetails.healthIssues')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {(dog.common_health_issues ?? []).map((issue) => (
                  <li key={issue} className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-chart-4 flex-shrink-0" />
                    <span className="capitalize">{issue}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
        <HealthRecommendations breedSlug={dog.slug} breedName={dog.breed} />

        {/* Trainable Skills */}
        <Card className="border-2 my-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-chart-1" />
              {t('dogDetails.trainableSkills')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(dog.trainable_skills ?? []).map((skill) => (
                <Badge key={skill} variant="secondary" className="text-sm capitalize">
                  {skill}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
        {/* Fun Fact */}
        <Card className="border-2 border-yellow-500 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500 animate-ping" />
              {t('dogDetails.funFact')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg leading-relaxed text-foreground/90">{dog.fun_fact}</p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
