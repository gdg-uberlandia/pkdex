import "server-only"

import type { Session } from "next-auth"
import { toString } from "qrcode"

import { env } from "@/env"
import { requireProfileForSession } from "@/modules/profile/profile.service"

import { buildUserQrReferenceUrl } from "./user-qr-reference.contract"
import { storeUserQrReference } from "./user-qr-reference.repository"
import { createUserQrToken } from "./user-qr-token"

export class SponsorQrForbiddenError extends Error {}

export type UserQrCode = {
  value: string
  svg: string
  expiresAt: string
}

export async function issueUserQrCode(session: Session): Promise<UserQrCode> {
  const profile = await requireProfileForSession(session)
  if (profile.accessRoles[0] === "sponsor") throw new SponsorQrForbiddenError()
  const { token, expiresAt } = createUserQrToken({
    eventId: profile.eventId,
    qrId: profile.qrId,
  })
  const code = await storeUserQrReference(
    { eventId: profile.eventId, type: "user", qrId: profile.qrId, token },
    expiresAt
  )
  const qrUrl = buildUserQrReferenceUrl(code, env.NEXT_PUBLIC_APP_URL)

  const svg = await toString(qrUrl, {
    type: "svg",
    width: 320,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#020617",
      light: "#ffffff",
    },
  })

  return {
    value: qrUrl,
    svg,
    expiresAt: expiresAt.toISOString(),
  }
}
