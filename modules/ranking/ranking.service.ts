import "server-only"

import type { Session } from "next-auth"

import {
  formatLevelLabel,
  getLevelForXp,
  getNextLevel,
  type Level,
} from "@/config/levels"
import { hasPermission } from "@/modules/profile/profile.authorization"
import { requireProfileForSession } from "@/modules/profile/profile.service"
import { findEventProgression } from "@/modules/progression/event-progression.repository"

import {
  findRankingWindow,
  type PositionedRankingProfile,
} from "./ranking.repository"

export type RankingEntry = Readonly<{
  userId: string
  position: number
  displayName: string
  avatarUrl: string | null
  xp: number
  levelLabel: string
  isCurrentParticipant: boolean
}>

export type Ranking =
  | Readonly<{ available: false }>
  | Readonly<{
      available: true
      current: RankingEntry &
        Readonly<{
          journeyProgress: number
          maximumLevelXp: number
          nextLevelLabel: string | null
          xpUntilNextLevel: number
        }>
      top: RankingEntry[]
      nearby: RankingEntry[]
    }>

function toRankingEntry(
  profile: PositionedRankingProfile,
  currentParticipantId: string,
  levels: readonly Level[]
): RankingEntry {
  const level = getLevelForXp(profile.xp, levels)

  return {
    userId: profile.userId,
    position: profile.position,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    xp: profile.xp,
    levelLabel: formatLevelLabel(level),
    isCurrentParticipant: profile.userId === currentParticipantId,
  }
}

export async function getRankingForSession(session: Session): Promise<Ranking> {
  const profile = await requireProfileForSession(session)

  if (!hasPermission(profile, "participate")) {
    return { available: false }
  }

  if (!profile.xpReachedAt) {
    return { available: false }
  }

  const progression = await findEventProgression(profile.eventId)
  const window = await findRankingWindow(profile.eventId, {
    userId: profile.userId,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    xp: profile.xp,
    xpReachedAtMs: profile.xpReachedAt.getTime(),
  })

  if (!window) {
    return { available: false }
  }

  const level = getLevelForXp(window.current.xp, progression.levels)
  const nextLevel = getNextLevel(level, progression.levels)
  const journeyProgress = Math.min(
    100,
    Math.max(0, (window.current.xp / progression.maximumXp) * 100)
  )

  return {
    available: true,
    current: {
      ...toRankingEntry(window.current, profile.userId, progression.levels),
      journeyProgress,
      maximumLevelXp: progression.maximumXp,
      nextLevelLabel: nextLevel ? formatLevelLabel(nextLevel) : null,
      xpUntilNextLevel: nextLevel
        ? Math.max(0, nextLevel.minimumXp - window.current.xp)
        : 0,
    },
    top: window.top.map((entry) =>
      toRankingEntry(entry, profile.userId, progression.levels)
    ),
    nearby: window.nearby.map((entry) =>
      toRankingEntry(entry, profile.userId, progression.levels)
    ),
  }
}
