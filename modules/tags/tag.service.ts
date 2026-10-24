import "server-only"

import type { Session } from "next-auth"

import { SCORES } from "@/config/scores"
import { env } from "@/env"
import { findActivityAvailability } from "@/modules/event-activities/activity-availability.repository"
import { requireProfileForSession } from "@/modules/profile/profile.service"

import {
  completeTagDiscovery,
  findActiveTags,
  findTagDiscoveriesByParticipant,
} from "./tag.repository"
import { discoverTagInputSchema } from "./tag.schema"

export type TagDiscoveryOperationResult =
  | Readonly<{
      success: true
      code: "TAG_DISCOVERED" | "TAG_ALREADY_DISCOVERED"
      tagName: string
      tagDescription: string
      imageUrl: string
      xpAwarded: number
    }>
  | Readonly<{
      success: false
      code:
        | "INVALID_EVENT"
        | "PROFILE_INCOMPLETE"
        | "TAGS_DISABLED"
        | "TAG_INACTIVE"
        | "TAG_NOT_FOUND"
    }>

export type TagCollectionItem =
  | Readonly<{
      status: "locked"
      slot: number
    }>
  | Readonly<{
      status: "discovered"
      slot: number
      name: string
      description: string | null
      imageUrl: string
      xpAwarded: number
      discoveredAt: Date
    }>

export type TagCollection = Readonly<{
  discoveredCount: number
  discoveryEnabled: boolean
  totalCount: number
  items: TagCollectionItem[]
}>

export async function listTagsForSession(
  session: Session
): Promise<TagCollection> {
  const profile = await requireProfileForSession(session)
  const [tags, discoveries, availability] = await Promise.all([
    findActiveTags(profile.eventId),
    findTagDiscoveriesByParticipant(profile.eventId, profile.userId),
    findActivityAvailability(profile.eventId),
  ])
  const discoveriesByTag = new Map(
    discoveries.map((discovery) => [discovery.activityId, discovery])
  )
  const items = tags.map<TagCollectionItem>((tag, index) => {
    const discovery = discoveriesByTag.get(tag.id)
    const slot = index + 1

    if (!discovery) {
      return { status: "locked", slot }
    }

    return {
      status: "discovered",
      slot,
      name: tag.name,
      description: tag.description,
      imageUrl: tag.imageUrl,
      xpAwarded: discovery.xpAwarded,
      discoveredAt: discovery.completedAt,
    }
  })

  return {
    discoveredCount: items.filter((item) => item.status === "discovered")
      .length,
    totalCount: items.length,
    discoveryEnabled: availability.tagsEnabled,
    items,
  }
}

export async function discoverTagForSession(
  session: Session,
  input: unknown
): Promise<TagDiscoveryOperationResult> {
  const target = discoverTagInputSchema.parse(input)
  const profile = await requireProfileForSession(session)

  if (target.eventId !== env.EVENT_ID || profile.eventId !== target.eventId) {
    return { success: false, code: "INVALID_EVENT" }
  }

  if (!profile.onboardingCompleted) {
    return { success: false, code: "PROFILE_INCOMPLETE" }
  }

  const result = await completeTagDiscovery({
    eventId: target.eventId,
    qrId: target.qrId,
    participantId: profile.userId,
    defaultXpAwarded: SCORES.TAG_DISCOVERY,
  })

  switch (result.status) {
    case "discovered":
      return {
        success: true,
        code: "TAG_DISCOVERED",
        tagName: result.tag.name,
        tagDescription: result.tag.description,
        imageUrl: result.tag.imageUrl,
        xpAwarded: result.discovery.xpAwarded,
      }
    case "already-discovered":
      return {
        success: true,
        code: "TAG_ALREADY_DISCOVERED",
        tagDescription: result.tag.description,
        tagName: result.tag.name,
        imageUrl: result.tag.imageUrl,
        xpAwarded: result.discovery.xpAwarded,
      }
    case "disabled":
      return { success: false, code: "TAGS_DISABLED" }
    case "inactive":
      return { success: false, code: "TAG_INACTIVE" }
    case "not-found":
      return { success: false, code: "TAG_NOT_FOUND" }
    case "profile-unavailable":
      return { success: false, code: "PROFILE_INCOMPLETE" }
  }
}
