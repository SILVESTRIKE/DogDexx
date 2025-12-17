import type React from "react"
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground } from "react-native"
import Icon from "react-native-vector-icons/MaterialCommunityIcons"
import { theme } from "../styles/theme"
import type { DogBreed } from "../lib/types"

interface DogCardProps {
  dog: DogBreed
  index: number
  isHighlighted?: boolean
  onPress: () => void
}

const getRarityColor = (level?: number): string => {
  switch (level) {
    case 1:
      return "#22c55e" // green
    case 2:
      return "#0ea5e9" // sky
    case 3:
      return "#f59e0b" // amber
    case 4:
      return "#9333ea" // purple
    case 5:
      return "#ef4444" // red
    default:
      return theme.colors.primary
  }
}

const RarityStars: React.FC<{ level: number }> = ({ level }) => {
  return (
    <View style={styles.starsContainer}>
      {[...Array(5)].map((_, i) => (
        <Icon
          key={i}
          name="star"
          size={12}
          color={i < level ? "#fbbf24" : theme.colors.textMuted}
          style={{ marginRight: 2 }}
        />
      ))}
    </View>
  )
}

const DogCard: React.FC<DogCardProps> = ({ dog, index, isHighlighted = false, onPress }) => {
  const collected = dog.isCollected
  const rarityColor = getRarityColor(dog.rarity_level)
  const cardBackgroundColor = collected ? theme.colors.card : theme.colors.background

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          borderColor: collected ? rarityColor : theme.colors.border,
          backgroundColor: cardBackgroundColor,
        },
        isHighlighted && styles.highlighted,
      ]}
      onPress={onPress}
      disabled={!collected}
      activeOpacity={collected ? 0.7 : 1}
    >
      <ImageBackground
        source={{
          uri: dog.mediaUrl || `https://source.unsplash.com/300x300/?${encodeURIComponent(dog.breed + " dog")}`,
        }}
        style={styles.imageContainer}
        resizeMode="cover"
      >
        {!collected && (
          <View style={styles.lockedOverlay}>
            <View style={styles.lockIconContainer}>
              <Icon name="lock" size={32} color={theme.colors.textMuted} />
            </View>
          </View>
        )}

        <View
          style={[
            styles.pokedexNumber,
            {
              backgroundColor: collected ? rarityColor : theme.colors.background,
            },
          ]}
        >
          <Text style={[styles.pokedexNumberText, { color: collected ? "#fff" : theme.colors.textMuted }]}>
            #{dog.pokedexNumber ? String(dog.pokedexNumber).padStart(3, "0") : "???"}
          </Text>
        </View>

        {collected && (
          <View style={[styles.checkmark, { backgroundColor: rarityColor }]}>
            <Icon name="check-circle" size={20} color="#fff" />
          </View>
        )}

        {!collected && <View style={styles.grayscaleOverlay} />}
      </ImageBackground>

      <View style={styles.content}>
        <Text
          style={[
            styles.breedName,
            {
              color: collected ? rarityColor : theme.colors.textMuted,
            },
          ]}
          numberOfLines={1}
        >
          {collected ? dog.breed : "???"}
        </Text>

        {dog.rarity_level && <RarityStars level={dog.rarity_level} />}

        <View style={styles.badges}>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: collected ? rarityColor + "20" : theme.colors.background,
                borderColor: collected ? rarityColor : theme.colors.border,
              },
            ]}
          >
            <Icon name="dog" size={12} color={collected ? rarityColor : theme.colors.text} />
            <Text style={[styles.badgeText, { color: collected ? rarityColor : theme.colors.text }]} numberOfLines={1}>
              {dog.group}
            </Text>
          </View>

          <View style={[styles.badge, styles.originBadge]}>
            <Text style={styles.badgeText} numberOfLines={1}>
              {dog.origin}
            </Text>
          </View>
        </View>

        {collected ? (
          <View style={styles.collectedInfo}>
            <Icon name="calendar" size={11} color={theme.colors.textMuted} />
            <Text style={styles.collectedText}>
              {dog.collectedAt ? new Date(dog.collectedAt).toLocaleDateString() : "N/A"}
            </Text>
          </View>
        ) : (
          <View style={styles.lockedInfo}>
            <Icon name="lock" size={11} color={theme.colors.textMuted} />
            <Text style={styles.lockedText}>Unlock to see details</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
    backgroundColor: theme.colors.card,
  },
  highlighted: {
    opacity: 0.8,
    borderWidth: 3,
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 1,
    justifyContent: "flex-start",
    alignItems: "flex-start",
    position: "relative",
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  lockIconContainer: {
    backgroundColor: theme.colors.background + "95",
    borderRadius: 50,
    padding: 16,
  },
  pokedexNumber: {
    position: "absolute",
    top: 12,
    left: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 20,
    fontWeight: "700",
    fontSize: 12,
    zIndex: 3,
  },
  pokedexNumberText: {
    fontWeight: "700",
    fontSize: 12,
  },
  checkmark: {
    position: "absolute",
    top: 12,
    right: 12,
    borderRadius: 50,
    padding: 6,
    zIndex: 3,
  },
  grayscaleOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  content: {
    padding: 12,
  },
  breedName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  starsContainer: {
    flexDirection: "row",
    marginBottom: 8,
  },
  badges: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  originBadge: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "500",
    color: theme.colors.text,
  },
  collectedInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  collectedText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontStyle: "italic",
  },
  lockedInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  lockedText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontStyle: "italic",
  },
})

export default DogCard
