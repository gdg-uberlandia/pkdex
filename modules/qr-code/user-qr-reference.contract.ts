import { MAX_QR_CODE_URL_LENGTH } from "./qr-code.contract"

// 128 random bits encoded without padding.
export const USER_QR_REFERENCE_PATTERN = /^[A-Za-z0-9_-]{21}[AQgw]$/

export function buildUserQrReferenceUrl(code: string, appUrl: string) {
  if (!USER_QR_REFERENCE_PATTERN.test(code))
    throw new Error("Invalid QR reference")
  return new URL(`/q/${code}`, appUrl).toString()
}

export function parseUserQrReferenceUrl(
  input: unknown,
  appUrl: string
): string | null {
  if (typeof input !== "string" || input.length > MAX_QR_CODE_URL_LENGTH)
    return null
  try {
    const url = new URL(input.trim())
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.origin !== new URL(appUrl).origin ||
      url.username ||
      url.password ||
      url.hash ||
      url.search
    )
      return null
    const segments = url.pathname.split("/")
    return segments.length === 3 &&
      segments[1] === "q" &&
      USER_QR_REFERENCE_PATTERN.test(segments[2])
      ? segments[2]
      : null
  } catch {
    return null
  }
}
