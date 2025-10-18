export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  requiredCount: number
  unlocked: boolean
}

export const achievementsList: Omit<Achievement, "unlocked">[] = [
  {
    id: "first-friend",
    title: "First Friend",
    description: "Collect your first dog breed",
    icon: "🐕",
    requiredCount: 1,
  },
  {
    id: "novice-collector",
    title: "Novice Collector",
    description: "Collect 10 dog breeds",
    icon: "🏅",
    requiredCount: 10,
  },
  {
    id: "enthusiast",
    title: "Enthusiast",
    description: "Collect 20 dog breeds",
    icon: "🎖️",
    requiredCount: 20,
  },
  {
    id: "expert-trainer",
    title: "Expert Trainer",
    description: "Collect 30 dog breeds",
    icon: "🏆",
    requiredCount: 30,
  },
  {
    id: "master-breeder",
    title: "Master Breeder",
    description: "Collect 40 dog breeds",
    icon: "👑",
    requiredCount: 40,
  },
  {
    id: "legendary-collector",
    title: "Legendary Collector",
    description: "Collect 50 dog breeds",
    icon: "⭐",
    requiredCount: 50,
  },
  {
    id: "ultimate-master",
    title: "Ultimate Master",
    description: "Collect all dog breeds!",
    icon: "💎",
    requiredCount: 100,
  },
]

export function getUnlockedAchievements(collectionCount: number): Achievement[] {
  return achievementsList.map((achievement) => ({
    ...achievement,
    unlocked: collectionCount >= achievement.requiredCount,
  }))
}

export function getNextAchievement(collectionCount: number): Achievement | null {
  const nextAchievement = achievementsList.find((achievement) => collectionCount < achievement.requiredCount)
  if (!nextAchievement) return null
  return {
    ...nextAchievement,
    unlocked: false,
  }
}
