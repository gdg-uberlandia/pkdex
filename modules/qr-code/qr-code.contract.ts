import * as z from "zod"

import { buildStaticQrPath } from "@/scripts/lib/static-qr-code.mjs"

export const QR_CODE_TYPES = ["user", "company", "mission", "tag"] as const
export const MAX_QR_CODE_URL_LENGTH = 4_096
export const MAX_QR_CODE_TOKEN_LENGTH = 2_048

export const qrCodeTypeSchema = z.enum(QR_CODE_TYPES)

const qrCodeBaseTargetSchema = z.object({
  eventId: z.string().trim().min(1).max(128),
  qrId: z.string().uuid(),
})

const userQrCodeTargetSchema = qrCodeBaseTargetSchema
  .extend({
    type: z.literal("user"),
    token: z.string().min(1).max(MAX_QR_CODE_TOKEN_LENGTH),
  })
  .strict()

const staticQrCodeTargetSchema = qrCodeBaseTargetSchema
  .extend({
    type: z.enum(["company", "mission", "tag"]),
  })
  .strict()

export const qrCodeTargetSchema = z.discriminatedUnion("type", [
  userQrCodeTargetSchema,
  staticQrCodeTargetSchema,
])

export type QrCodeTarget = z.infer<typeof qrCodeTargetSchema>

export type ParseQrCodeUrlResult =
  | {
      valid: true
      target: QrCodeTarget
    }
  | {
      valid: false
      code:
        | "INVALID_QR"
        | "INVALID_ORIGIN"
        | "INVALID_EVENT"
        | "UNSUPPORTED_QR_TYPE"
        | "MISSING_TOKEN"
    }

type QrCodeUrlConfig = Readonly<{
  appUrl: string
  eventId: string
}>

export function parseQrCodeUrl(
  input: unknown,
  config: QrCodeUrlConfig
): ParseQrCodeUrlResult {
  if (
    typeof input !== "string" ||
    !input.trim() ||
    input.length > MAX_QR_CODE_URL_LENGTH
  )
    return { valid: false, code: "INVALID_QR" }
  try {
    const url = new URL(input.trim())
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.origin !== new URL(config.appUrl).origin ||
      url.username ||
      url.password ||
      url.hash
    )
      return { valid: false, code: "INVALID_ORIGIN" }
    const match = /^\/q\/([cmt])([A-Za-z0-9_-]{21}[AQgw])$/.exec(url.pathname)
    if (!match || url.search) return { valid: false, code: "INVALID_QR" }
    const bytes = atob(
      match[2].replaceAll("-", "+").replaceAll("_", "/") + "=="
    )
    const hex = Array.from(bytes, (byte) =>
      byte.charCodeAt(0).toString(16).padStart(2, "0")
    ).join("")
    const qrId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    const types = { c: "company", m: "mission", t: "tag" } as const
    const target = staticQrCodeTargetSchema.safeParse({
      eventId: config.eventId,
      type: types[match[1] as keyof typeof types],
      qrId,
    })
    return target.success
      ? { valid: true, target: target.data }
      : { valid: false, code: "INVALID_QR" }
  } catch {
    return { valid: false, code: "INVALID_QR" }
  }
}

export function buildQrCodeUrl(
  target: Exclude<QrCodeTarget, { type: "user" }>,
  appUrl: string
): string {
  const validated = staticQrCodeTargetSchema.parse(target)
  return new URL(
    buildStaticQrPath(validated.type, validated.qrId),
    appUrl
  ).toString()
}
