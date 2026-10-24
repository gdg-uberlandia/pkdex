import "server-only"

import { createHash } from "node:crypto"

import { Timestamp } from "firebase-admin/firestore"
import { unstable_cache } from "next/cache"
import * as z from "zod"

import { CACHE_SECONDS, CACHE_TAGS } from "@/config/cache"
import { firestore } from "@/lib/firebase/admin"
import { getFirestoreCollectionName } from "@/lib/firebase/firestore-collection"
import { readActivityAvailability } from "@/modules/event-activities/activity-availability.repository"
import { incrementParticipantSummary } from "@/modules/participant-summary/participant-summary.repository"
import { accessRolesSchema } from "@/modules/profile/profile.schema"

import { discoverTagInputSchema, type Tag, tagFieldsSchema } from "./tag.schema"
import {
  type TagDiscovery,
  tagDiscoveryFieldsSchema,
} from "./tag-discovery.schema"

const TAGS_COLLECTION = getFirestoreCollectionName("tags")
const COMPLETIONS_COLLECTION = getFirestoreCollectionName("activityCompletions")
const PROFILES_COLLECTION = getFirestoreCollectionName("profiles")

const tagDocumentSchema = z.object({
  ...tagFieldsSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  }).shape,
  createdAt: z.instanceof(Timestamp),
  updatedAt: z.instanceof(Timestamp),
})

const tagDiscoveryDocumentSchema = tagDiscoveryFieldsSchema
  .omit({
    id: true,
    completedAt: true,
  })
  .extend({
    completedAt: z.instanceof(Timestamp),
  })

const profileScoreSchema = z.object({
  userId: z.string().trim().min(1).max(128),
  eventId: z.string().trim().min(1).max(128),
  onboardingCompleted: z.boolean(),
  accessRoles: accessRolesSchema.default(["participant"]),
  xp: z.number().int().nonnegative().default(0),
})

export type CompleteTagDiscoveryResult =
  | Readonly<{
      status: "discovered" | "already-discovered"
      tag: Tag
      discovery: TagDiscovery
    }>
  | Readonly<{
      status: "not-found" | "inactive" | "disabled" | "profile-unavailable"
    }>

type CachedTag = Omit<Tag, "createdAt" | "updatedAt"> &
  Readonly<{ createdAt: number; updatedAt: number }>

function getTagDiscoveryId(
  eventId: string,
  participantId: string,
  tagId: string
) {
  return createHash("sha256")
    .update(JSON.stringify([eventId, participantId, "tag", tagId]))
    .digest("hex")
}

function parseTagDocument(id: string, value: unknown): Tag {
  const document = tagDocumentSchema.parse(value)

  return tagFieldsSchema.parse({
    id,
    ...document,
    createdAt: document.createdAt.toDate(),
    updatedAt: document.updatedAt.toDate(),
  })
}

function parseTagDiscoveryDocument(id: string, value: unknown): TagDiscovery {
  const document = tagDiscoveryDocumentSchema.parse(value)

  return tagDiscoveryFieldsSchema.parse({
    id,
    ...document,
    completedAt: document.completedAt.toDate(),
  })
}

async function loadActiveTags(eventId: string): Promise<CachedTag[]> {
  const validatedEventId = discoverTagInputSchema.shape.eventId.parse(eventId)
  const snapshots = await firestore
    .collection(TAGS_COLLECTION)
    .where("eventId", "==", validatedEventId)
    .get()

  return snapshots.docs
    .map((snapshot) => parseTagDocument(snapshot.id, snapshot.data()))
    .filter((tag) => tag.active)
    .sort(
      (first, second) =>
        first.order - second.order ||
        first.name.localeCompare(second.name, "pt-BR")
    )
    .map((tag) => ({
      ...tag,
      createdAt: tag.createdAt.getTime(),
      updatedAt: tag.updatedAt.getTime(),
    }))
}

const loadCachedActiveTags = unstable_cache(loadActiveTags, ["active-tags"], {
  revalidate: CACHE_SECONDS.EVENT_CATALOG,
  tags: [CACHE_TAGS.TAGS],
})

export async function findActiveTags(eventId: string): Promise<Tag[]> {
  const tags = await loadCachedActiveTags(eventId)

  return tags.map((tag) => ({
    ...tag,
    createdAt: new Date(tag.createdAt),
    updatedAt: new Date(tag.updatedAt),
  }))
}

export async function findTagDiscoveriesByParticipant(
  eventId: string,
  participantId: string
): Promise<TagDiscovery[]> {
  const validatedEventId = discoverTagInputSchema.shape.eventId.parse(eventId)
  const validatedParticipantId =
    profileScoreSchema.shape.userId.parse(participantId)
  const snapshots = await firestore
    .collection(COMPLETIONS_COLLECTION)
    .where("participantId", "==", validatedParticipantId)
    .get()
  const discoveries: TagDiscovery[] = []

  for (const snapshot of snapshots.docs) {
    const value = snapshot.data()
    const activityType = z
      .object({ activityType: z.string() })
      .parse(value).activityType

    if (activityType !== "tag") {
      continue
    }

    const discovery = parseTagDiscoveryDocument(snapshot.id, value)

    if (
      discovery.eventId === validatedEventId &&
      discovery.participantId === validatedParticipantId
    ) {
      discoveries.push(discovery)
    }
  }

  return discoveries.sort(
    (first, second) =>
      second.completedAt.getTime() - first.completedAt.getTime()
  )
}

export async function completeTagDiscovery({
  eventId,
  qrId,
  participantId,
  defaultXpAwarded,
}: {
  eventId: string
  qrId: string
  participantId: string
  defaultXpAwarded: number
}): Promise<CompleteTagDiscoveryResult> {
  const target = discoverTagInputSchema.parse({ eventId, qrId })
  const validatedParticipantId =
    profileScoreSchema.shape.userId.parse(participantId)
  const validatedDefaultXp = z.number().int().positive().parse(defaultXpAwarded)
  const tagQuery = firestore
    .collection(TAGS_COLLECTION)
    .where("eventId", "==", target.eventId)
    .where("qrId", "==", target.qrId)
    .limit(2)
  const profileRef = firestore
    .collection(PROFILES_COLLECTION)
    .doc(validatedParticipantId)

  return firestore.runTransaction(async (transaction) => {
    const tagSnapshots = await transaction.get(tagQuery)

    if (tagSnapshots.empty) {
      return { status: "not-found" }
    }

    if (tagSnapshots.size !== 1) {
      throw new Error("Public tag QR identifier is not unique")
    }

    const tagSnapshot = tagSnapshots.docs[0]
    const tag = parseTagDocument(tagSnapshot.id, tagSnapshot.data())

    if (tag.eventId !== target.eventId || tag.qrId !== target.qrId) {
      throw new Error("Stored tag identity is invalid")
    }

    if (!tag.active) {
      return { status: "inactive" }
    }

    const discoveryId = getTagDiscoveryId(
      target.eventId,
      validatedParticipantId,
      tag.id
    )
    const discoveryRef = firestore
      .collection(COMPLETIONS_COLLECTION)
      .doc(discoveryId)
    const [profileSnapshot, discoverySnapshot] = await Promise.all([
      transaction.get(profileRef),
      transaction.get(discoveryRef),
    ])

    if (!profileSnapshot.exists) {
      return { status: "profile-unavailable" }
    }

    const profile = profileScoreSchema.parse(profileSnapshot.data())

    if (
      profile.userId !== validatedParticipantId ||
      profile.eventId !== target.eventId ||
      !profile.onboardingCompleted ||
      !profile.accessRoles.includes("participant")
    ) {
      return { status: "profile-unavailable" }
    }

    if (discoverySnapshot.exists) {
      const discovery = parseTagDiscoveryDocument(
        discoverySnapshot.id,
        discoverySnapshot.data()
      )

      if (
        discovery.eventId !== target.eventId ||
        discovery.participantId !== validatedParticipantId ||
        discovery.activityId !== tag.id
      ) {
        throw new Error("Stored tag discovery identity is invalid")
      }

      return {
        status: "already-discovered",
        tag,
        discovery,
      }
    }

    if (
      !(await readActivityAvailability(transaction, target.eventId)).tagsEnabled
    )
      return { status: "disabled" }

    const now = Timestamp.now()
    const xpAwarded = tag.xpAwarded ?? validatedDefaultXp

    transaction.create(discoveryRef, {
      eventId: target.eventId,
      participantId: validatedParticipantId,
      activityType: "tag",
      activityId: tag.id,
      qrId: tag.qrId,
      xpAwarded,
      completedAt: now,
    })
    transaction.update(profileRef, {
      xp: profile.xp + xpAwarded,
      xpReachedAt: now,
      updatedAt: now,
    })
    incrementParticipantSummary(transaction, {
      eventId: target.eventId,
      participantId: validatedParticipantId,
      counter: "tagsDiscoveredCount",
      amount: 1,
      now,
    })

    return {
      status: "discovered",
      tag,
      discovery: tagDiscoveryFieldsSchema.parse({
        id: discoveryId,
        eventId: target.eventId,
        participantId: validatedParticipantId,
        activityType: "tag",
        activityId: tag.id,
        qrId: tag.qrId,
        xpAwarded,
        completedAt: now.toDate(),
      }),
    }
  })
}
