import "server-only"

import { createLevels } from "@/config/levels"
import { findActiveCompanies } from "@/modules/companies/company.repository"
import { findActiveMissions } from "@/modules/missions/mission.repository"
import { findActiveTags } from "@/modules/tags/tag.repository"
import { findActiveTalks } from "@/modules/talks/talk.repository"

import { calculateEventXpBudget } from "./event-progression"

export async function findEventProgression(eventId: string) {
  const [companies, missions, tags, talks] = await Promise.all([
    findActiveCompanies(eventId),
    findActiveMissions(eventId),
    findActiveTags(eventId),
    findActiveTalks(eventId),
  ])
  const budget = calculateEventXpBudget({ companies, missions, tags, talks })
  return { ...budget, levels: createLevels(budget.maximumXp) }
}
