import "server-only"

export function isPushEnabled() {
  return process.env.PUSH_ENABLED?.trim().toLowerCase() === "true"
}

export function getPostOnboardingDestination() {
  return isPushEnabled() && process.env.VAPID_PUBLIC_KEY
    ? "/notifications/enable"
    : "/home"
}
