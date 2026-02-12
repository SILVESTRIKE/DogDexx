"use client"

import type React from "react"

import { useEffect, useState } from "react"
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  
} from "react-native"
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from "@react-navigation/native"
import {
  ArrowLeft,
  MapPin,
  Star,
  Ruler,
  Calendar,
  Heart,
  Thermometer,
  CheckCircle,
  AlertCircle,
  XCircle,
  UtensilsCrossed,
  AlertTriangle,
  Zap,
} from "lucide-react-native"
import { useI18n } from "../../lib/i18n-context"
import { apiClient } from "../../lib/api-client"
import type { DogBreed } from "../../lib/types"

interface EnrichedDogBreed {
  breed: DogBreed
  collectionStatus: {
    isCollected: boolean
    collectedAt: string | null
  }
  media: {
    url: string
    type: string
  }[]
}


export default function DogDetailScreen() {
  const [data, setData] = useState<EnrichedDogBreed | null>(null)
  const [loading, setLoading] = useState(true)
  const { t, locale } = useI18n()
  const navigation = useNavigation()
  const route = useRoute()
  const { slug } = route.params as { slug: string }

  useEffect(() => {
    const fetchBreed = async () => {
      try {
        setLoading(true)
        const response = await apiClient.getBreedBySlug(slug, locale)
        setData(response)
      } catch (error) {
        console.error("[v0] Failed to fetch breed:", error)
        setData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchBreed()
  }, [slug, locale])

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>{t("common.loading")}</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!data || !data.breed) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("common.back")}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{t("common.error")}</Text>
        </View>
      </SafeAreaView>
    )
  }

  const dog = data.breed
  console.log(dog.mediaUrl);
  const collected = data.collectionStatus.isCollected

  const renderStat = (label: string, value: number, icon: React.ReactNode, color: string) => (
    <View style={styles.statItem}>
      <View style={styles.statLabel}>
        {icon}
        <Text style={styles.statLabelText}>{label}</Text>
        <Text style={[styles.statValue, { marginLeft: "auto" }]}>{value}/5</Text>
      </View>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(value / 5) * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      {/* <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("dogDetails.backToPokedex")}</Text>
      </View> */}

      <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View>
            <Image
              source={{ uri: dog.mediaUrl || `https://via.placeholder.com/400?text=${encodeURIComponent(dog.breed)}` }}
              style={[styles.heroImage, { opacity: collected ? 1 : 0.6 }]}
            />
            <Text style={styles.pokedexNumber}>
              #{dog.pokedexNumber ? String(dog.pokedexNumber).padStart(3, "0") : "???"}
            </Text>
          </View>
          <Text style={styles.breedName}>{dog.breed}</Text>
          <View style={styles.badgesContainer}>
            <View style={styles.badge}>
              <MapPin size={14} color="#333" />
              <Text style={styles.badgeText}>{dog.origin}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{dog.group}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{dog.coat_type}</Text>
            </View>
          </View>
          <Text style={styles.description}>{dog.description}</Text>
        </View>

        {/* Quick Stats Card */}
        <View style={styles.card}>
          <View style={styles.cardTitle}>
            <Star size={20} color="#ffd700" />
            <Text style={styles.cardTitleText}>{t("dogDetails.quickStats")}</Text>
          </View>
          {renderStat(t("results.energy"), dog.energy_level ?? 0, <Zap size={16} color="#FF6B35" />, "#FF6B35")}
          {renderStat(t("results.trainability"), dog.trainability ?? 0, <Zap size={16} color="#FFB700" />, "#FFB700")}
          {renderStat(t("results.shedding"), dog.shedding_level ?? 0, <Zap size={16} color="#999" />, "#999")}
          {renderStat(
            t("dogDetails.maintenance"),
            dog.maintenance_difficulty ?? 0,
            <Zap size={16} color="#007AFF" />,
            "#007AFF",
          )}
        </View>

        {/* Physical Info Card */}
        <View style={styles.card}>
          <View style={styles.cardTitle}>
            <Ruler size={20} color="#007AFF" />
            <Text style={styles.cardTitleText}>{t("results.physicalInfo")}</Text>
          </View>
          <Text style={styles.sectionTitle}>{t("results.height")}</Text>
          <Text style={styles.badgeText}>{dog.height}</Text>
          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>{t("results.weight")}</Text>
          <Text style={styles.badgeText}>{dog.weight}</Text>
          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>{t("results.lifespan")}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Calendar size={16} color="#333" />
            <Text style={styles.badgeText}>{dog.life_expectancy}</Text>
          </View>
          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>{t("results.coatColors")}</Text>
          <View style={styles.tagList}>
            {(dog.coat_colors ?? []).map((color) => (
              <View key={color} style={[styles.tag, { borderWidth: 1, borderColor: "#ccc" }]}>
                <Text style={styles.tagText}>{color}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Temperament Card */}
        <View style={styles.card}>
          <View style={styles.cardTitle}>
            <Heart size={20} color="#007AFF" />
            <Text style={styles.cardTitleText}>{t("results.temperament")}</Text>
          </View>
          <View style={styles.tagList}>
            {(dog.temperament ?? []).map((trait) => (
              <View key={trait} style={styles.tag}>
                <Text style={styles.tagText}>{trait}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Living Conditions Card */}
        <View style={styles.card}>
          <View style={styles.cardTitle}>
            <Thermometer size={20} color="#007AFF" />
            <Text style={styles.cardTitleText}>{t("dogDetails.livingConditions")}</Text>
          </View>
          <Text style={styles.sectionTitle}>{t("dogDetails.climatePreference")}</Text>
          <Text style={styles.badgeText}>{dog.climate_preference}</Text>
          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>{t("dogDetails.goodWithChildren")}</Text>
          <View style={[styles.badge, { backgroundColor: dog.good_with_children ? "#e8f5e9" : "#ffebee" }]}>
            {dog.good_with_children ? <CheckCircle size={16} color="#4caf50" /> : <XCircle size={16} color="#f44336" />}
            <Text style={styles.badgeText}>{dog.good_with_children ? t("feedback.yes") : t("feedback.no")}</Text>
          </View>
          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>{t("dogDetails.goodWithPets")}</Text>
          <View style={[styles.badge, { backgroundColor: dog.good_with_other_pets ? "#e8f5e9" : "#ffebee" }]}>
            {dog.good_with_other_pets ? (
              <CheckCircle size={16} color="#4caf50" />
            ) : (
              <XCircle size={16} color="#f44336" />
            )}
            <Text style={styles.badgeText}>{dog.good_with_other_pets ? t("feedback.yes") : t("feedback.no")}</Text>
          </View>
        </View>

        {/* Suitable For */}
        <View style={styles.card}>
          <View style={styles.cardTitle}>
            <CheckCircle size={20} color="#4caf50" />
            <Text style={styles.cardTitleText}>{t("dogDetails.suitableFor")}</Text>
          </View>
          {(dog.suitable_for ?? []).map((item) => (
            <View key={item} style={styles.listItem}>
              <CheckCircle size={16} color="#4caf50" />
              <Text style={styles.listItemText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Not Suitable For */}
        <View style={styles.card}>
          <View style={styles.cardTitle}>
            <XCircle size={20} color="#f44336" />
            <Text style={styles.cardTitleText}>{t("dogDetails.notSuitableFor")}</Text>
          </View>
          {(dog.unsuitable_for ?? []).map((item) => (
            <View key={item} style={styles.listItem}>
              <XCircle size={16} color="#f44336" />
              <Text style={styles.listItemText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Favorite Foods */}
        <View style={styles.card}>
          <View style={styles.cardTitle}>
            <UtensilsCrossed size={20} color="#FFB700" />
            <Text style={styles.cardTitleText}>{t("dogDetails.favoriteFoods")}</Text>
          </View>
          <View style={styles.tagList}>
            {(dog.favorite_foods ?? []).map((food) => (
              <View key={food} style={styles.tag}>
                <Text style={styles.tagText}>{food}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Health Issues */}
        <View style={styles.card}>
          <View style={styles.cardTitle}>
            <AlertTriangle size={20} color="#FF6B35" />
            <Text style={styles.cardTitleText}>{t("dogDetails.healthIssues")}</Text>
          </View>
          {(dog.common_health_issues ?? []).map((issue) => (
            <View key={issue} style={styles.listItem}>
              <AlertCircle size={16} color="#FF6B35" />
              <Text style={styles.listItemText}>{issue}</Text>
            </View>
          ))}
        </View>

        {/* Trainable Skills */}
        <View style={styles.card}>
          <View style={styles.cardTitle}>
            <Star size={20} color="#4caf50" />
            <Text style={styles.cardTitleText}>{t("dogDetails.trainableSkills")}</Text>
          </View>
          <View style={styles.tagList}>
            {(dog.trainable_skills ?? []).map((skill) => (
              <View key={skill} style={styles.tag}>
                <Text style={styles.tagText}>{skill}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Fun Fact Card */}
        <View style={styles.funFactCard}>
          <View style={styles.funFactTitle}>
            <Star size={20} color="#ffd700" />
            <Text style={styles.cardTitleText}>{t("dogDetails.funFact")}</Text>
          </View>
          <Text style={styles.funFactText}>{dog.fun_fact}</Text>
        </View>

        {/* Bottom padding */}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  )
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 4,
    borderBottomColor: "#007AFF",
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
    marginLeft: 8,
  },
  contentContainer: {
    padding: 16,
  },
  heroSection: {
    marginBottom: 24,
  },
  heroImage: {
    width: "100%",
    height: 300,
    borderRadius: 12,
    borderWidth: 4,
    borderColor: "#007AFF",
  },
  pokedexNumber: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "#007AFF",
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    fontWeight: "700",
    fontSize: 14,
  },
  breedName: {
    fontSize: 32,
    fontWeight: "700",
    marginVertical: 12,
    color: "#000",
  },
  badgesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    backgroundColor: "#E8E8E8",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#333",
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: "#666",
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#ddd",
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitleText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginLeft: 8,
  },
  statItem: {
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statLabelText: {
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 4,
  },
  statValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#333",
  },
  progressBar: {
    height: 6,
    backgroundColor: "#e0e0e0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  tagList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    backgroundColor: "#E8E8E8",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#333",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 8,
  },
  listItemText: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  funFactCard: {
    backgroundColor: "#fffacd",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#ffd700",
    padding: 16,
    marginBottom: 16,
  },
  funFactTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  funFactText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#333",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 14,
    color: "#d32f2f",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
    color: "#666",
  },
})