import "server-only"

import { createHash, randomBytes } from "node:crypto"

import { Timestamp } from "firebase-admin/firestore"

import { QR_CODE_CONFIG } from "@/config/qr-code"
import { env } from "@/env"
import { firestore } from "@/lib/firebase/admin"
import { getFirestoreCollectionName } from "@/lib/firebase/firestore-collection"

import { type QrCodeTarget, qrCodeTargetSchema } from "./qr-code.contract"
import { USER_QR_REFERENCE_PATTERN } from "./user-qr-reference.contract"

type UserTarget = Extract<QrCodeTarget, { type: "user" }>

function references() {
  return firestore.collection(getFirestoreCollectionName("userQrReferences"))
}

function referenceId(code: string) {
  return createHash("sha256").update(code).digest("hex")
}

export async function storeUserQrReference(
  target: UserTarget,
  expiresAt: Date
) {
  qrCodeTargetSchema.parse(target)
  const mode = process.env.DEVMODE?.trim().toLowerCase()
  if (
    (mode !== "true" && mode !== "false") ||
    target.eventId !== env.EVENT_ID ||
    (mode === "false" && env.FB_ADMIN_PROJECT_ID !== "devfest-triangulo-2026")
  ) {
    throw new Error("QR reference environment mismatch")
  }
  const code = randomBytes(16).toString("base64url")
  const ref = references().doc(referenceId(code))
  await ref.create({ ...target, expiresAt: Timestamp.fromDate(expiresAt) })
  const stored = await ref.get()
  const data = stored.data()
  if (
    !stored.exists ||
    data?.type !== "user" ||
    data?.eventId !== target.eventId ||
    data?.qrId !== target.qrId ||
    data?.token !== target.token ||
    !(data?.expiresAt instanceof Timestamp) ||
    data.expiresAt.toMillis() !== expiresAt.getTime()
  ) {
    throw new Error("QR reference verification failed")
  }
  return code
}

export async function findUserQrReference(
  code: string,
  now = new Date()
): Promise<UserTarget | null> {
  if (!USER_QR_REFERENCE_PATTERN.test(code)) return null
  const snapshot = await references().doc(referenceId(code)).get()
  const data = snapshot.data()
  if (
    !data ||
    !(data.expiresAt instanceof Timestamp) ||
    now.getTime() >
      data.expiresAt.toMillis() + QR_CODE_CONFIG.CLOCK_TOLERANCE_SECONDS * 1000
  )
    return null
  const parsed = qrCodeTargetSchema.safeParse({
    eventId: data.eventId,
    type: data.type,
    qrId: data.qrId,
    token: data.token,
  })
  return parsed.success &&
    parsed.data.type === "user" &&
    parsed.data.eventId === env.EVENT_ID
    ? parsed.data
    : null
}
