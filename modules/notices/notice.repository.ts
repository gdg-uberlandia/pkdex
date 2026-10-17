import "server-only"

import { createHash } from "node:crypto"

import { Timestamp } from "firebase-admin/firestore"

import { firestore } from "@/lib/firebase/admin"
import { getFirestoreCollectionName } from "@/lib/firebase/firestore-collection"

import {
  type Notice,
  noticeSchema,
  pushSubscriptionSchema,
} from "./notice.schema"

const notices = () =>
  firestore.collection(getFirestoreCollectionName("notices"))
const subscriptions = () =>
  firestore.collection(getFirestoreCollectionName("pushSubscriptions"))
const readRef = (eventId: string, userId: string) =>
  firestore
    .collection(getFirestoreCollectionName("noticeReaders"))
    .doc(createHash("sha256").update(`${eventId}:${userId}`).digest("hex"))
    .collection("reads")
const subscriptionId = (eventId: string, endpoint: string) =>
  createHash("sha256").update(`${eventId}:${endpoint}`).digest("hex")

function parseNotice(id: string, data: FirebaseFirestore.DocumentData): Notice {
  return noticeSchema.parse({
    ...data,
    id,
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : data.createdAt,
  })
}
export async function listNotices(eventId: string, userId: string) {
  const [snapshot, reads] = await Promise.all([
    notices().where("eventId", "==", eventId).get(),
    readRef(eventId, userId).get(),
  ])
  const readIds = new Set(reads.docs.map((doc) => doc.id))
  return snapshot.docs
    .filter((doc) => doc.data().deletedAt == null)
    .map((doc) => ({
      ...parseNotice(doc.id, doc.data()),
      read: readIds.has(doc.id),
    }))
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)
    )
}
export async function findNotice(eventId: string, id: string) {
  const snapshot = await notices().doc(id).get()
  if (
    !snapshot.exists ||
    snapshot.data()?.eventId !== eventId ||
    snapshot.data()?.deletedAt != null
  )
    return null
  return parseNotice(snapshot.id, snapshot.data()!)
}
export async function markNoticeRead(
  eventId: string,
  userId: string,
  id: string
) {
  await firestore.runTransaction(async (transaction) => {
    const reference = notices().doc(id)
    const snapshot = await transaction.get(reference)
    if (
      !snapshot.exists ||
      snapshot.data()?.eventId !== eventId ||
      snapshot.data()?.deletedAt != null
    )
      throw new Error("Aviso não encontrado")
    const read = readRef(eventId, userId).doc(id)
    const existing = await transaction.get(read)
    if (!existing.exists)
      transaction.create(read, { eventId, userId, readAt: Timestamp.now() })
  })
}
export async function saveSubscription(
  eventId: string,
  userId: string,
  input: unknown
) {
  const subscription = pushSubscriptionSchema.parse(input)
  await subscriptions()
    .doc(subscriptionId(eventId, subscription.endpoint))
    .set({ ...subscription, eventId, userId, updatedAt: Timestamp.now() })
}
export async function removeSubscription(
  eventId: string,
  userId: string,
  input: unknown
) {
  const subscription = pushSubscriptionSchema.parse(input)
  const reference = subscriptions().doc(
    subscriptionId(eventId, subscription.endpoint)
  )
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference)
    if (snapshot.data()?.userId === userId) transaction.delete(reference)
  })
}

export async function countUnreadNotices(eventId: string, userId: string) {
  const [snapshot, reads] = await Promise.all([
    notices().where("eventId", "==", eventId).select("deletedAt").get(),
    readRef(eventId, userId).select().get(),
  ])
  const readIds = new Set(reads.docs.map((doc) => doc.id))
  return snapshot.docs.filter(
    (doc) => doc.data().deletedAt == null && !readIds.has(doc.id)
  ).length
}
