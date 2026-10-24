import "server-only"

import { Timestamp, type Transaction } from "firebase-admin/firestore"
import * as z from "zod"

import { firestore } from "@/lib/firebase/admin"
import { getFirestoreCollectionName } from "@/lib/firebase/firestore-collection"
import { accessRolesSchema } from "@/modules/profile/profile.schema"

import {
  activityAvailabilitySchema,
  type ActivityService,
  activityServiceSchema,
} from "./activity-availability.schema"

const eventIdSchema = z.string().trim().min(1).max(128)
function availabilityRef(eventId: string) {
  return firestore
    .collection(getFirestoreCollectionName("eventOperations"))
    .doc(eventIdSchema.parse(eventId))
}
function parseAvailability(
  eventId: string,
  data: Record<string, unknown> | undefined
) {
  if (data && data.eventId !== eventId)
    throw new Error("Stored event operations identity is invalid")
  return activityAvailabilitySchema.parse(data ?? {})
}
export async function findActivityAvailability(eventId: string) {
  const snapshot = await availabilityRef(eventId).get()
  return parseAvailability(eventId, snapshot.data())
}
export async function readActivityAvailability(
  transaction: Transaction,
  eventId: string
) {
  const snapshot = await transaction.get(availabilityRef(eventId))
  return parseAvailability(eventId, snapshot.data())
}
export async function setActivityAvailability(
  eventId: string,
  service: ActivityService,
  enabled: boolean,
  operatorId: string
) {
  const reference = availabilityRef(eventId)
  const validatedService = activityServiceSchema.parse(service)
  const validatedEnabled = z.boolean().parse(enabled)
  const operatorRef = firestore
    .collection(getFirestoreCollectionName("profiles"))
    .doc(z.string().trim().min(1).max(128).parse(operatorId))
  return firestore.runTransaction(async (transaction) => {
    const [operator, operations] = await Promise.all([
      transaction.get(operatorRef),
      transaction.get(reference),
    ])
    const profile = z
      .object({
        userId: z.string(),
        eventId: z.string(),
        accessRoles: accessRolesSchema,
      })
      .safeParse(operator.data())
    if (
      !profile.success ||
      profile.data.userId !== operatorId ||
      profile.data.eventId !== eventId ||
      profile.data.accessRoles[0] !== "admin"
    )
      return false
    parseAvailability(eventId, operations.data())
    transaction.set(
      reference,
      {
        eventId,
        [validatedService === "tags" ? "tagsEnabled" : "missionsEnabled"]:
          validatedEnabled,
        updatedAt: Timestamp.now(),
        updatedBy: operatorId,
      },
      { merge: true }
    )
    return true
  })
}
