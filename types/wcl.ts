export interface WCLAbility {
  id: number
  name: string
  icon: string
}

export interface WCLRateLimitData {
  limitPerHour: number
  pointsSpentThisHour: number
  pointsResetIn: number
}

export interface TalentNodeInfo {
  spellId: number
  name: string
  icon: string | null
}
