import "server-only"

import { Timestamp } from "firebase-admin/firestore"
import * as z from "zod"

import { firestore } from "@/lib/firebase/admin"
import { getFirestoreCollectionName } from "@/lib/firebase/firestore-collection"

import { type ScheduleEntry, scheduleFieldsSchema } from "./schedule.schema"

const SCHEDULE_COLLECTION = getFirestoreCollectionName("schedule")
const eventIdSchema = z.string().trim().min(1).max(128)
const scheduleDocumentSchema = z
  .object({
    id: scheduleFieldsSchema.shape.id.optional(),
    eventId: scheduleFieldsSchema.shape.eventId,
    startAt: z.instanceof(Timestamp),
    endAt: z.instanceof(Timestamp),
    track: scheduleFieldsSchema.shape.track,
    order: scheduleFieldsSchema.shape.order,
    activity: scheduleFieldsSchema.shape.activity,
    active: scheduleFieldsSchema.shape.active,
    createdAt: z.instanceof(Timestamp),
    updatedAt: z.instanceof(Timestamp),
  })
  .strict()

function parseScheduleDocument(id: string, value: unknown): ScheduleEntry {
  const document = scheduleDocumentSchema.parse(value)
  if (document.id && document.id !== id) {
    throw new Error(`Schedule document ID mismatch: ${id}`)
  }
  return scheduleFieldsSchema.parse({
    ...document,
    id,
    startAt: document.startAt.toDate(),
    endAt: document.endAt.toDate(),
    createdAt: document.createdAt.toDate(),
    updatedAt: document.updatedAt.toDate(),
  })
}

async function loadActiveSchedule(eventId: string): Promise<ScheduleEntry[]> {
  const validatedEventId = eventIdSchema.parse(eventId)
  const snapshots = await firestore
    .collection(SCHEDULE_COLLECTION)
    .where("eventId", "==", validatedEventId)
    .get()

  return snapshots.docs
    .map((snapshot) => parseScheduleDocument(snapshot.id, snapshot.data()))
    .filter((entry) => entry.active)
    .sort(
      (first, second) =>
        first.startAt.getTime() - second.startAt.getTime() ||
        (first.order ?? Number.MAX_SAFE_INTEGER) -
          (second.order ?? Number.MAX_SAFE_INTEGER)
    )
}

export function findActiveSchedule(eventId: string) {
  return loadActiveSchedule(eventId)
}

export async function isSchedulePublished(eventId: string): Promise<boolean> {
  const validatedEventId = eventIdSchema.parse(eventId)
  const snapshot = await firestore
    .collection(getFirestoreCollectionName("schedule_publications"))
    .doc(validatedEventId)
    .get()
  if (!snapshot.exists) return false
  const publication = z
    .object({ eventId: eventIdSchema, published: z.boolean() })
    .parse(snapshot.data())
  if (publication.eventId !== validatedEventId)
    throw new Error("Schedule publication event mismatch")
  return publication.published
}
