import "server-only"

import { randomUUID } from "node:crypto"

import { Timestamp } from "firebase-admin/firestore"
import * as z from "zod"

import { SCORES } from "@/config/scores"
import { firestore } from "@/lib/firebase/admin"
import { getFirestoreCollectionName } from "@/lib/firebase/firestore-collection"
import { createInitialParticipantSummary } from "@/modules/participant-summary/participant-summary.repository"

import {
  type ProfileIdentity,
  profileIdentitySchema,
  type ProfileUpdate,
  profileUpdateSchema,
  storedProfileFieldsSchema,
} from "./profile.schema"
import type { Profile } from "./profile.types"
import { getProfileInterests } from "./profile-interests"

const PROFILES_COLLECTION = getFirestoreCollectionName("profiles")
const INITIAL_PROFILE_FIELDS = storedProfileFieldsSchema.parse({})
const profileDocumentSchema = profileIdentitySchema.extend({
  ...storedProfileFieldsSchema.shape,
  qrId: z.string().uuid(),
  onboardingCompleted: z.boolean(),
  xp: z.number().int().nonnegative().default(0),
  xpReachedAt: z.instanceof(Timestamp).nullable().default(null),
  createdAt: z.instanceof(Timestamp),
  updatedAt: z.instanceof(Timestamp),
})

export type EnsureProfileResult = {
  created: boolean
}

export async function ensureProfileExists(
  identity: ProfileIdentity
): Promise<EnsureProfileResult> {
  const profileRef = firestore
    .collection(PROFILES_COLLECTION)
    .doc(identity.userId)

  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(profileRef)

    if (snapshot.exists) {
      return {
        created: false,
      }
    }

    const now = Timestamp.now()

    transaction.create(profileRef, {
      ...identity,
      ...INITIAL_PROFILE_FIELDS,
      qrId: randomUUID(),
      onboardingCompleted: false,
      onboardingTicketGranted: false,
      xp: 0,
      xpReachedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    createInitialParticipantSummary(
      transaction,
      identity.eventId,
      identity.userId,
      now
    )

    return {
      created: true,
    }
  })
}

export async function findProfileByUserId(
  userId: string
): Promise<Profile | null> {
  const validatedUserId = profileIdentitySchema.shape.userId.parse(userId)

  const snapshot = await firestore
    .collection(PROFILES_COLLECTION)
    .doc(validatedUserId)
    .get()

  if (!snapshot.exists) {
    return null
  }

  const result = profileDocumentSchema.safeParse(snapshot.data())

  if (!result.success || result.data.userId !== validatedUserId) {
    throw new Error("Stored profile document is invalid")
  }

  const { createdAt, updatedAt, xpReachedAt, ...profile } = result.data

  return {
    ...profile,
    interests: getProfileInterests(profile),
    xpReachedAt: xpReachedAt?.toDate() ?? null,
    createdAt: createdAt.toDate(),
    updatedAt: updatedAt.toDate(),
  }
}

export async function findProfileByEmail(
  email: string
): Promise<Profile | null> {
  const validatedEmail = profileIdentitySchema.shape.email
    .parse(email)
    .toLowerCase()

  const snapshots = await firestore
    .collection(PROFILES_COLLECTION)
    .where("email", "==", validatedEmail)
    .limit(2)
    .get()

  if (snapshots.empty) {
    return null
  }

  if (snapshots.size !== 1) {
    throw new Error("Stored profile email is not unique")
  }

  const snapshot = snapshots.docs[0]
  const result = profileDocumentSchema.safeParse(snapshot.data())

  if (!result.success || result.data.userId !== snapshot.id) {
    throw new Error("Stored profile document is invalid")
  }

  const { createdAt, updatedAt, xpReachedAt, ...profile } = result.data

  return {
    ...profile,
    interests: getProfileInterests(profile),
    xpReachedAt: xpReachedAt?.toDate() ?? null,
    createdAt: createdAt.toDate(),
    updatedAt: updatedAt.toDate(),
  }
}

export async function findProfileByQrId(
  eventId: string,
  qrId: string
): Promise<Profile | null> {
  const validatedEventId = profileIdentitySchema.shape.eventId.parse(eventId)
  const validatedQrId = z.string().uuid().parse(qrId)
  const snapshots = await firestore
    .collection(PROFILES_COLLECTION)
    .where("eventId", "==", validatedEventId)
    .where("qrId", "==", validatedQrId)
    .limit(2)
    .get()

  if (snapshots.empty) {
    return null
  }

  if (snapshots.size !== 1) {
    throw new Error("Public profile QR identifier is not unique")
  }

  const snapshot = snapshots.docs[0]
  const result = profileDocumentSchema.safeParse(snapshot.data())

  if (
    !result.success ||
    result.data.userId !== snapshot.id ||
    result.data.eventId !== validatedEventId ||
    result.data.qrId !== validatedQrId
  ) {
    throw new Error("Stored profile document is invalid")
  }

  const { createdAt, updatedAt, xpReachedAt, ...profile } = result.data

  return {
    ...profile,
    interests: getProfileInterests(profile),
    xpReachedAt: xpReachedAt?.toDate() ?? null,
    createdAt: createdAt.toDate(),
    updatedAt: updatedAt.toDate(),
  }
}

export async function updateProfileByUserId(
  userId: string,
  input: ProfileUpdate
): Promise<void> {
  const validatedUserId = profileIdentitySchema.shape.userId.parse(userId)
  const validatedInput = profileUpdateSchema.parse(input)

  const profileRef = firestore
    .collection(PROFILES_COLLECTION)
    .doc(validatedUserId)

  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(profileRef)

    if (!snapshot.exists) {
      throw new Error("Profile not found")
    }

    transaction.update(profileRef, {
      ...validatedInput,
      skills: [],
      updatedAt: Timestamp.now(),
    })
  })
}

export async function completeProfileByUserId(
  userId: string,
  input: ProfileUpdate
): Promise<void> {
  const validatedUserId = profileIdentitySchema.shape.userId.parse(userId)
  const validatedInput = profileUpdateSchema.parse(input)
  const profileRef = firestore
    .collection(PROFILES_COLLECTION)
    .doc(validatedUserId)

  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(profileRef)

    if (!snapshot.exists) {
      throw new Error("Profile not found")
    }

    const profile = profileDocumentSchema
      .pick({ onboardingCompleted: true, accessRoles: true, xp: true })
      .parse(snapshot.data())
    const now = Timestamp.now()
    const grantXp =
      !profile.onboardingCompleted &&
      profile.accessRoles.includes("participant")

    transaction.update(profileRef, {
      ...validatedInput,
      skills: [],
      onboardingCompleted: true,
      ...(grantXp
        ? { xp: profile.xp + SCORES.PROFILE_COMPLETION, xpReachedAt: now }
        : {}),
      updatedAt: now,
    })
  })
}
