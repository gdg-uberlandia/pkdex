import "server-only"

import { createHash } from "node:crypto"

import { FieldValue, Timestamp } from "firebase-admin/firestore"
import * as z from "zod"

import { firestore } from "@/lib/firebase/admin"
import { getFirestoreCollectionName } from "@/lib/firebase/firestore-collection"
import { readActivityAvailability } from "@/modules/event-activities/activity-availability.repository"
import { incrementParticipantSummary } from "@/modules/participant-summary/participant-summary.repository"
import {
  getProfileInterests,
  sharedInterests,
} from "@/modules/profile/profile-interests"

import {
  type Connection,
  connectionFieldsSchema,
  connectionSchema,
  normalizeConnectionPair,
} from "./connection.schema"

const CONNECTIONS_COLLECTION = getFirestoreCollectionName("connections")
const PROFILES_COLLECTION = getFirestoreCollectionName("profiles")
const CONNECTION_REQUEST_COOLDOWN_MS = 60_000

const connectionDocumentSchema = connectionFieldsSchema
  .omit({
    id: true,
    firstRequestedAt: true,
    lastRequestedAt: true,
    acceptedAt: true,
    rejectedAt: true,
    removedAt: true,
    xpGrantedAt: true,
    xpRevokedAt: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    firstRequestedAt: z.instanceof(Timestamp),
    lastRequestedAt: z.instanceof(Timestamp),
    acceptedAt: z.instanceof(Timestamp).nullable(),
    rejectedAt: z.instanceof(Timestamp).nullable(),
    removedAt: z.instanceof(Timestamp).nullable(),
    xpGrantedAt: z.instanceof(Timestamp).nullable(),
    xpRevokedAt: z.instanceof(Timestamp).nullable(),
    createdAt: z.instanceof(Timestamp),
    updatedAt: z.instanceof(Timestamp),
  })

type RequestConnectionResult =
  "connected" | "already-connected" | "cooldown" | "event-closed"

type RemoveConnectionResult =
  | "removed"
  | "already-removed"
  | "not-connected"
  | "not-participant"
  | "not-found"

const profileScoreSchema = z.object({
  userId: z.string().trim().min(1),
  eventId: z.string().trim().min(1),
  xp: z.number().int().nonnegative().default(0),
})

function getConnectionId(eventId: string, participantIds: [string, string]) {
  return createHash("sha256")
    .update(JSON.stringify([eventId, ...participantIds]))
    .digest("hex")
}

function parseConnectionDocument(id: string, value: unknown): Connection {
  const document = connectionDocumentSchema.parse(value)

  return connectionSchema.parse({
    id,
    ...document,
    firstRequestedAt: document.firstRequestedAt.toDate(),
    lastRequestedAt: document.lastRequestedAt.toDate(),
    acceptedAt: document.acceptedAt?.toDate() ?? null,
    rejectedAt: document.rejectedAt?.toDate() ?? null,
    removedAt: document.removedAt?.toDate() ?? null,
    xpGrantedAt: document.xpGrantedAt?.toDate() ?? null,
    xpRevokedAt: document.xpRevokedAt?.toDate() ?? null,
    createdAt: document.createdAt.toDate(),
    updatedAt: document.updatedAt.toDate(),
  })
}

export async function requestConnection({
  eventId,
  requesterId,
  recipientId,
  xpAwardedPerParticipant,
}: {
  eventId: string
  requesterId: string
  recipientId: string
  xpAwardedPerParticipant: number
}): Promise<RequestConnectionResult> {
  const participantIds = normalizeConnectionPair(requesterId, recipientId)
  const connectionId = getConnectionId(eventId, participantIds)
  const connectionRef = firestore
    .collection(CONNECTIONS_COLLECTION)
    .doc(connectionId)
  const requesterRef = firestore
    .collection(PROFILES_COLLECTION)
    .doc(requesterId)
  const recipientRef = firestore
    .collection(PROFILES_COLLECTION)
    .doc(recipientId)

  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(connectionRef)
    const [requesterSnapshot, recipientSnapshot] = await Promise.all([
      transaction.get(requesterRef),
      transaction.get(recipientRef),
    ])
    const shared = sharedInterests(
      getProfileInterests(requesterSnapshot.data() ?? {}),
      getProfileInterests(recipientSnapshot.data() ?? {})
    )
    const availability = await readActivityAvailability(transaction, eventId)
    const now = Timestamp.now()

    if (!snapshot.exists) {
      if (availability.eventClosed) return "event-closed"
      transaction.create(connectionRef, {
        eventId,
        participantIds,
        requesterId,
        recipientId,
        status: "accepted",
        sharedInterests: shared,
        requestCount: 1,
        xpAwardedPerParticipant,
        firstRequestedAt: now,
        lastRequestedAt: now,
        acceptedAt: now,
        rejectedAt: null,
        removedAt: null,
        removedBy: null,
        xpGrantedAt: now,
        xpRevokedAt: null,
        createdAt: now,
        updatedAt: now,
      })
    } else {
      const connection = parseConnectionDocument(snapshot.id, snapshot.data())

      if (
        connection.eventId !== eventId ||
        connection.participantIds[0] !== participantIds[0] ||
        connection.participantIds[1] !== participantIds[1]
      ) {
        throw new Error("Stored connection identity is invalid")
      }

      if (connection.status === "accepted") {
        return "already-connected"
      }

      if (availability.eventClosed) return "event-closed"

      if (
        now.toMillis() - connection.lastRequestedAt.getTime() <
        CONNECTION_REQUEST_COOLDOWN_MS
      ) {
        return "cooldown"
      }

      transaction.update(connectionRef, {
        requesterId,
        recipientId,
        status: "accepted",
        requestCount: connection.requestCount + 1,
        xpAwardedPerParticipant,
        lastRequestedAt: now,
        acceptedAt: now,
        xpGrantedAt: now,
        xpRevokedAt: null,
        updatedAt: now,
      })
    }

    transaction.update(requesterRef, {
      xp: FieldValue.increment(xpAwardedPerParticipant),
      xpReachedAt: now,
      updatedAt: now,
    })
    transaction.update(recipientRef, {
      xp: FieldValue.increment(xpAwardedPerParticipant),
      xpReachedAt: now,
      updatedAt: now,
    })
    incrementParticipantSummary(transaction, {
      eventId,
      participantId: requesterId,
      counter: "connectionsCount",
      amount: 1,
      now,
    })
    incrementParticipantSummary(transaction, {
      eventId,
      participantId: recipientId,
      counter: "connectionsCount",
      amount: 1,
      now,
    })

    return "connected"
  })
}

export async function removeConnection({
  connectionId,
  eventId,
  participantId,
}: {
  connectionId: string
  eventId: string
  participantId: string
}): Promise<RemoveConnectionResult> {
  const connectionRef = firestore
    .collection(CONNECTIONS_COLLECTION)
    .doc(connectionId)

  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(connectionRef)

    if (!snapshot.exists) {
      return "not-found"
    }

    const connection = parseConnectionDocument(snapshot.id, snapshot.data())

    if (connection.eventId !== eventId) {
      return "not-found"
    }

    if (!connection.participantIds.includes(participantId)) {
      return "not-participant"
    }

    if (connection.status === "removed") {
      return "already-removed"
    }

    if (connection.status !== "accepted") {
      return "not-connected"
    }

    const xpAwardedPerParticipant = connection.xpAwardedPerParticipant

    if (xpAwardedPerParticipant === null) {
      throw new Error("Accepted connection does not contain its XP amount")
    }

    const [firstParticipantRef, secondParticipantRef] =
      connection.participantIds.map((connectedParticipantId) =>
        firestore.collection(PROFILES_COLLECTION).doc(connectedParticipantId)
      )
    const [firstSnapshot, secondSnapshot] = await Promise.all([
      transaction.get(firstParticipantRef),
      transaction.get(secondParticipantRef),
    ])

    if (!firstSnapshot.exists || !secondSnapshot.exists) {
      throw new Error("Connection participant profile was not found")
    }

    const firstProfile = profileScoreSchema.parse(firstSnapshot.data())
    const secondProfile = profileScoreSchema.parse(secondSnapshot.data())

    if (
      firstProfile.userId !== connection.participantIds[0] ||
      secondProfile.userId !== connection.participantIds[1] ||
      firstProfile.eventId !== eventId ||
      secondProfile.eventId !== eventId ||
      firstProfile.xp < xpAwardedPerParticipant ||
      secondProfile.xp < xpAwardedPerParticipant
    ) {
      throw new Error("Connection participant XP is inconsistent")
    }

    const now = Timestamp.now()
    transaction.update(connectionRef, {
      status: "removed",
      removedAt: now,
      removedBy: participantId,
      xpRevokedAt: now,
      updatedAt: now,
    })
    transaction.update(firstParticipantRef, {
      xp: firstProfile.xp - xpAwardedPerParticipant,
      xpReachedAt: now,
      updatedAt: now,
    })
    transaction.update(secondParticipantRef, {
      xp: secondProfile.xp - xpAwardedPerParticipant,
      xpReachedAt: now,
      updatedAt: now,
    })
    for (const connectedParticipantId of connection.participantIds) {
      incrementParticipantSummary(transaction, {
        eventId,
        participantId: connectedParticipantId,
        counter: "connectionsCount",
        amount: -1,
        now,
      })
    }

    return "removed"
  })
}

export async function findConnectionsByParticipant(
  eventId: string,
  participantId: string
): Promise<Connection[]> {
  const snapshots = await firestore
    .collection(CONNECTIONS_COLLECTION)
    .where("participantIds", "array-contains", participantId)
    .get()

  return snapshots.docs
    .map((snapshot) => parseConnectionDocument(snapshot.id, snapshot.data()))
    .filter((connection) => connection.eventId === eventId)
    .sort(
      (first, second) => second.updatedAt.getTime() - first.updatedAt.getTime()
    )
}

export async function findConnectionById(
  connectionId: string
): Promise<Connection | null> {
  const snapshot = await firestore
    .collection(CONNECTIONS_COLLECTION)
    .doc(connectionId)
    .get()

  return snapshot.exists
    ? parseConnectionDocument(snapshot.id, snapshot.data())
    : null
}
