import { SCORES } from "@/config/scores"

export type ProgressionCatalog = Readonly<{
  companies: readonly { active: boolean; xpAwarded: number | null }[]
  missions: readonly { active: boolean; xpAwarded: number | null }[]
  tags: readonly { active: boolean; xpAwarded: number | null }[]
  talks: readonly { isActive: boolean }[]
}>

export function calculateEventXpBudget(catalog: ProgressionCatalog) {
  const sum = (
    rows: readonly { active: boolean; xpAwarded: number | null }[],
    fallback: number
  ) =>
    rows
      .filter((row) => row.active)
      .reduce((total, row) => total + (row.xpAwarded ?? fallback), 0)
  const breakdown = {
    profile: SCORES.PROFILE_COMPLETION,
    companies: sum(catalog.companies, SCORES.COMPANY_VISIT),
    missions: sum(catalog.missions, SCORES.MISSION_COMPLETION),
    tags: sum(catalog.tags, SCORES.TAG_DISCOVERY),
    talks:
      catalog.talks.filter((talk) => talk.isActive).length *
      SCORES.TALK_EVALUATION_COMPLETION,
  }
  return {
    maximumXp: Object.values(breakdown).reduce((total, xp) => total + xp, 0),
    breakdown,
  }
}
