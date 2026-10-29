import "server-only"

import { env } from "@/env"

import { parseQrCodeUrl, type ParseQrCodeUrlResult } from "./qr-code.contract"
import { parseUserQrReferenceUrl } from "./user-qr-reference.contract"
import { findUserQrReference } from "./user-qr-reference.repository"
import { validateUserQrToken } from "./user-qr-token"

export async function resolveQrCodeUrl(
  input: unknown
): Promise<ParseQrCodeUrlResult> {
  const code = parseUserQrReferenceUrl(input, env.NEXT_PUBLIC_APP_URL)
  if (!code)
    return parseQrCodeUrl(input, {
      appUrl: env.NEXT_PUBLIC_APP_URL,
      eventId: env.EVENT_ID,
    })
  const target = await findUserQrReference(code)
  if (!target || !validateUserQrToken(target).valid)
    return { valid: false, code: "INVALID_QR" }
  return { valid: true, target }
}
