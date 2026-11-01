import "server-only"

import { createHash } from "node:crypto"

import { Timestamp } from "firebase-admin/firestore"
import { unstable_cache } from "next/cache"
import * as z from "zod"

import { CACHE_SECONDS, CACHE_TAGS } from "@/config/cache"
import { firestore } from "@/lib/firebase/admin"
import { getFirestoreCollectionName } from "@/lib/firebase/firestore-collection"
import { readActivityAvailability } from "@/modules/event-activities/activity-availability.repository"
import { accessRolesSchema } from "@/modules/profile/profile.schema"

import { type Speaker, speakerFieldsSchema } from "./speaker.schema"
import {
  normalizeStoredTalkFormat,
  type Talk,
  talkFieldsSchema,
} from "./talk.schema"
import {
  type SubmitTalkRatingInput,
  submitTalkRatingInputSchema,
  type TalkRating,
  talkRatingFieldsSchema,
} from "./talk-rating.schema"

const SPEAKERS_COLLECTION = getFirestoreCollectionName("speakers")
const TALK_RATINGS_COLLECTION = getFirestoreCollectionName("talk-ratings")
const TALKS_COLLECTION = getFirestoreCollectionName("talks")
const PROFILES_COLLECTION = getFirestoreCollectionName("profiles")
const eventIdSchema = z.string().trim().min(1).max(128)

const speakerDocumentSchema = speakerFieldsSchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    id: speakerFieldsSchema.shape.id.optional(),
    createdAt: z.instanceof(Timestamp),
    updatedAt: z.instanceof(Timestamp),
  })

const talkDocumentSchema = talkFieldsSchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    id: talkFieldsSchema.shape.id.optional(),
    createdAt: z.instanceof(Timestamp),
    updatedAt: z.instanceof(Timestamp),
  })

const talkRatingDocumentSchema = talkRatingFieldsSchema
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

type CachedSpeaker = Omit<Speaker, "createdAt" | "updatedAt"> &
  Readonly<{ createdAt: number; updatedAt: number }>
type CachedTalk = Omit<Talk, "createdAt" | "updatedAt"> &
  Readonly<{ createdAt: number; updatedAt: number }>

export type CompleteTalkRatingResult =
  | Readonly<{
      status: "rated" | "already-rated"
      talk: Talk
      rating: TalkRating
    }>
  | Readonly<{
      status:
        "closed" | "inactive" | "locked" | "not-found" | "profile-unavailable"
    }>

function getTalkRatingId(
  eventId: string,
  participantId: string,
  talkId: string
) {
  return createHash("sha256")
    .update(JSON.stringify([eventId, participantId, "talk-rating", talkId]))
    .digest("hex")
}

function parseSpeakerDocument(id: string, value: unknown): Speaker {
  const document = speakerDocumentSchema.parse(value)

  if (document.id && document.id !== id) {
    throw new Error(`Speaker document ID mismatch: ${id}`)
  }

  return speakerFieldsSchema.parse({
    ...document,
    id,
    createdAt: document.createdAt.toDate(),
    updatedAt: document.updatedAt.toDate(),
  })
}

function parseTalkDocument(id: string, value: unknown): Talk {
  const normalizedValue =
    typeof value === "object" && value !== null
      ? {
          ...value,
          format: normalizeStoredTalkFormat(
            "format" in value ? value.format : undefined
          ),
        }
      : value
  const document = talkDocumentSchema.parse(normalizedValue)

  if (document.id && document.id !== id) {
    throw new Error(`O ID do documento da palestra não corresponde: ${id}`)
  }

  return talkFieldsSchema.parse({
    ...document,
    id,
    createdAt: document.createdAt.toDate(),
    updatedAt: document.updatedAt.toDate(),
  })
}

function parseTalkRatingDocument(id: string, value: unknown): TalkRating {
  const document = talkRatingDocumentSchema.parse(value)

  return talkRatingFieldsSchema.parse({
    id,
    ...document,
    completedAt: document.completedAt.toDate(),
  })
}

async function loadVisibleSpeakers(eventId: string): Promise<CachedSpeaker[]> {
  const validatedEventId = eventIdSchema.parse(eventId)
  const snapshots = await firestore
    .collection(SPEAKERS_COLLECTION)
    .where("eventId", "==", validatedEventId)
    .get()

  return snapshots.docs
    .map((snapshot) => parseSpeakerDocument(snapshot.id, snapshot.data()))
    .filter((speaker) => speaker.isVisible)
    .sort((first, second) => first.name.localeCompare(second.name, "pt-BR"))
    .map((speaker) => ({
      ...speaker,
      createdAt: speaker.createdAt.getTime(),
      updatedAt: speaker.updatedAt.getTime(),
    }))
}

async function loadActiveTalks(eventId: string): Promise<CachedTalk[]> {
  const validatedEventId = eventIdSchema.parse(eventId)
  const snapshots = await firestore
    .collection(TALKS_COLLECTION)
    .where("eventId", "==", validatedEventId)
    .get()

  return snapshots.docs
    .map((snapshot) => parseTalkDocument(snapshot.id, snapshot.data()))
    .filter((talk) => talk.isActive)
    .sort((first, second) => first.title.localeCompare(second.title, "pt-BR"))
    .map((talk) => ({
      ...talk,
      createdAt: talk.createdAt.getTime(),
      updatedAt: talk.updatedAt.getTime(),
    }))
}

const loadCachedVisibleSpeakers = unstable_cache(
  loadVisibleSpeakers,
  ["visible-speakers"],
  {
    revalidate: CACHE_SECONDS.EVENT_CATALOG,
    tags: [CACHE_TAGS.SPEAKERS],
  }
)

const loadCachedActiveTalks = unstable_cache(
  loadActiveTalks,
  ["active-talks"],
  {
    revalidate: CACHE_SECONDS.EVENT_CATALOG,
    tags: [CACHE_TAGS.TALKS],
  }
)

export async function findVisibleSpeakers(eventId: string): Promise<Speaker[]> {
  const speakers = await loadCachedVisibleSpeakers(eventId)

  return speakers.map((speaker) => ({
    ...speaker,
    createdAt: new Date(speaker.createdAt),
    updatedAt: new Date(speaker.updatedAt),
  }))
}

export async function findActiveTalks(eventId: string): Promise<Talk[]> {
  const talks = await loadCachedActiveTalks(eventId)

  return talks.map((talk) => ({
    ...talk,
    createdAt: new Date(talk.createdAt),
    updatedAt: new Date(talk.updatedAt),
  }))
}

export async function findActiveTalkById(
  eventId: string,
  talkId: string
): Promise<Talk | null> {
  const validatedEventId = eventIdSchema.parse(eventId)
  const validatedTalkId = talkFieldsSchema.shape.id.parse(talkId)
  const snapshot = await firestore
    .collection(TALKS_COLLECTION)
    .doc(validatedTalkId)
    .get()

  if (!snapshot.exists) {
    return null
  }

  const talk = parseTalkDocument(snapshot.id, snapshot.data())

  return talk.eventId === validatedEventId && talk.isActive ? talk : null
}

export async function findTalkRatingsByParticipant(
  eventId: string,
  participantId: string
): Promise<TalkRating[]> {
  const validatedEventId = eventIdSchema.parse(eventId)
  const validatedParticipantId =
    profileScoreSchema.shape.userId.parse(participantId)
  const snapshots = await firestore
    .collection(TALK_RATINGS_COLLECTION)
    .where("participantId", "==", validatedParticipantId)
    .get()

  return snapshots.docs
    .map((snapshot) => parseTalkRatingDocument(snapshot.id, snapshot.data()))
    .filter(
      (rating) =>
        rating.eventId === validatedEventId &&
        rating.participantId === validatedParticipantId
    )
    .sort(
      (first, second) =>
        second.completedAt.getTime() - first.completedAt.getTime()
    )
}

export async function completeTalkRating({
  eventId,
  participantId,
  input,
  xpAwarded,
}: {
  eventId: string
  participantId: string
  input: SubmitTalkRatingInput
  xpAwarded: number
}): Promise<CompleteTalkRatingResult> {
  const validatedEventId = eventIdSchema.parse(eventId)
  const validatedParticipantId =
    profileScoreSchema.shape.userId.parse(participantId)
  const validatedInput = submitTalkRatingInputSchema.parse(input)
  const validatedXpAwarded = z.number().int().positive().parse(xpAwarded)
  const talkRef = firestore
    .collection(TALKS_COLLECTION)
    .doc(validatedInput.talkId)
  const profileRef = firestore
    .collection(PROFILES_COLLECTION)
    .doc(validatedParticipantId)
  const ratingId = getTalkRatingId(
    validatedEventId,
    validatedParticipantId,
    validatedInput.talkId
  )
  const ratingRef = firestore.collection(TALK_RATINGS_COLLECTION).doc(ratingId)

  return firestore.runTransaction(async (transaction) => {
    const [talkSnapshot, profileSnapshot, ratingSnapshot] = await Promise.all([
      transaction.get(talkRef),
      transaction.get(profileRef),
      transaction.get(ratingRef),
    ])

    if (!talkSnapshot.exists) {
      return { status: "not-found" }
    }

    const talk = parseTalkDocument(talkSnapshot.id, talkSnapshot.data())

    if (talk.eventId !== validatedEventId) {
      return { status: "not-found" }
    }

    if (!profileSnapshot.exists) {
      return { status: "profile-unavailable" }
    }

    const profile = profileScoreSchema.parse(profileSnapshot.data())

    if (
      profile.userId !== validatedParticipantId ||
      profile.eventId !== validatedEventId ||
      !profile.onboardingCompleted ||
      !profile.accessRoles.includes("participant")
    ) {
      return { status: "profile-unavailable" }
    }

    if (ratingSnapshot.exists) {
      return {
        status: "already-rated",
        talk,
        rating: parseTalkRatingDocument(
          ratingSnapshot.id,
          ratingSnapshot.data()
        ),
      }
    }

    if (
      (await readActivityAvailability(transaction, validatedEventId))
        .eventClosed
    ) {
      return { status: "closed" }
    }

    if (!talk.isActive) {
      return { status: "inactive" }
    }

    if (talk.evaluationStatus === "locked") {
      return { status: "locked" }
    }

    if (talk.evaluationStatus === "closed") {
      return { status: "closed" }
    }

    const now = Timestamp.now()

    transaction.create(ratingRef, {
      eventId: validatedEventId,
      participantId: validatedParticipantId,
      talkId: talk.id,
      speakerRating: validatedInput.speakerRating,
      contentRating: validatedInput.contentRating,
      comprehensionRating: validatedInput.comprehensionRating,
      comment: validatedInput.comment,
      xpAwarded: validatedXpAwarded,
      completedAt: now,
    })
    transaction.update(profileRef, {
      xp: profile.xp + validatedXpAwarded,
      xpReachedAt: now,
      updatedAt: now,
    })

    return {
      status: "rated",
      talk,
      rating: talkRatingFieldsSchema.parse({
        id: ratingId,
        eventId: validatedEventId,
        participantId: validatedParticipantId,
        ...validatedInput,
        xpAwarded: validatedXpAwarded,
        completedAt: now.toDate(),
      }),
    }
  })
}

export async function updateTalkEvaluationStatus(
  eventId: string,
  talkId: string,
  evaluationStatus: Talk["evaluationStatus"]
): Promise<"updated" | "not-found" | "inactive"> {
  const validatedEventId = eventIdSchema.parse(eventId)
  const validatedTalkId = talkFieldsSchema.shape.id.parse(talkId)
  const validatedStatus =
    talkFieldsSchema.shape.evaluationStatus.parse(evaluationStatus)
  const talkRef = firestore.collection(TALKS_COLLECTION).doc(validatedTalkId)

  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(talkRef)

    if (!snapshot.exists) {
      return "not-found"
    }

    const talk = parseTalkDocument(snapshot.id, snapshot.data())

    if (talk.eventId !== validatedEventId) {
      return "not-found"
    }

    if (!talk.isActive) {
      return "inactive"
    }

    transaction.update(talkRef, {
      evaluationStatus: validatedStatus,
      updatedAt: Timestamp.now(),
    })

    return "updated"
  })
}
