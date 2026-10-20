/** Validate browser origins without trusting arbitrary forwarded-host headers. */
export function isAllowedRequestOrigin(request: Request, publicAppUrl: string) {
  const origin = request.headers.get("origin")
  if (!origin) return false
  try {
    const publicOrigin = new URL(publicAppUrl).origin
    const requestOrigin = new URL(request.url).origin
    return origin === publicOrigin || origin === requestOrigin
  } catch {
    return false
  }
}
