export interface DogBreed {
  _id: { $oid: string }
  breed: string
  origin: string
  group: string
  coat_type: string
  coat_colors: string[]
  description: string
  life_expectancy: string
  temperament: string[]
  height: string
  weight: string
  favorite_foods: string[]
  common_health_issues: string[]
  energy_level: number
  trainability: number
  shedding_level: number
  good_with_children: boolean
  good_with_other_pets: boolean
  suitable_for: string[]
  unsuitable_for: string[]
  climate_preference: string
  maintenance_difficulty: number
  trainable_skills: string[]
  fun_fact: string
  slug: string
  isDeleted: boolean
  isCollected?: boolean
  number?: number
}
