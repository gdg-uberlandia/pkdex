import { describe, expect, it } from "vitest"

import { buildStaticQrPath } from "@/scripts/lib/static-qr-code.mjs"

import {
  buildQrCodeUrl,
  MAX_QR_CODE_URL_LENGTH,
  parseQrCodeUrl,
} from "./qr-code.contract"

const APP_URL = "https://pokedex.example.com"
const EVENT_ID = "devfest-2026"
const QR_ID = "123e4567-e89b-42d3-a456-426614174000"
const config = { appUrl: APP_URL, eventId: EVENT_ID }

describe("short static QR Code contract", () => {
  it.each(["company", "mission", "tag"] as const)(
    "round trips a fixed %s QR Code",
    (type) => {
      const target = { eventId: EVENT_ID, type, qrId: QR_ID }
      const url = buildQrCodeUrl(target, APP_URL)
      expect(new URL(url).pathname).toHaveLength(26)
      expect(parseQrCodeUrl(url, config)).toEqual({ valid: true, target })
      expect(new URL(url).pathname).toBe(buildStaticQrPath(type, QR_ID))
    }
  )

  const url = buildQrCodeUrl(
    { eventId: EVENT_ID, type: "company", qrId: QR_ID },
    APP_URL
  )
  it("uses a stable encoding shared with the image generator", () => {
    expect(url).toBe(`${APP_URL}/q/cEj5FZ-ibQtOkVkJmFBdAAA`)
  })
  it.each([
    `${url}?source=external`,
    `${url}#fragment`,
    `${url}/`,
    url.replace(APP_URL, "https://attacker.example"),
    url.replace("https://", "https://user:password@"),
    `${APP_URL}/q/xEj5FZ-ibQtOkVkJmFBdAAA`,
    `${APP_URL}/q/cEj5FZ-ibQtOkVkJmFBdAAB`,
    `${APP_URL}/q/c${"A".repeat(21)}Q`,
    `${APP_URL}/qr/${EVENT_ID}/company/${QR_ID}`,
    `${APP_URL}/qr/${EVENT_ID}/tag/${QR_ID}`,
    `${APP_URL}/qr/${EVENT_ID}/mission/${QR_ID}`,
    `${APP_URL}/qr/${EVENT_ID}/user/${QR_ID}?token=old`,
    `${APP_URL}/q/${"A".repeat(66)}`,
    `${APP_URL}/${"a".repeat(MAX_QR_CODE_URL_LENGTH)}`,
  ])("rejects malformed or obsolete URL %s", (value) => {
    expect(parseQrCodeUrl(value, config).valid).toBe(false)
  })
  it("rejects non-string input", () => {
    expect(parseQrCodeUrl(null, config).valid).toBe(false)
  })
})
