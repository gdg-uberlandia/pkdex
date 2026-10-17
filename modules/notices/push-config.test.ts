import { afterEach, describe, expect, it, vi } from "vitest"

import { getPostOnboardingDestination, isPushEnabled } from "./push-config"

afterEach(() => vi.unstubAllEnvs())
describe("global push switch", () => {
  it("offers notification onboarding only with push enabled and configured", () => {
    vi.stubEnv("PUSH_ENABLED", "true")
    vi.stubEnv("VAPID_PUBLIC_KEY", "key")
    expect(getPostOnboardingDestination()).toBe("/notifications/enable")
    vi.stubEnv("PUSH_ENABLED", "false")
    expect(getPostOnboardingDestination()).toBe("/home")
    vi.stubEnv("PUSH_ENABLED", "true")
    vi.stubEnv("VAPID_PUBLIC_KEY", "")
    expect(getPostOnboardingDestination()).toBe("/home")
  })
  it("requires explicit activation", () => {
    for (const value of [undefined, "", "false", "1", "yes"]) {
      vi.stubEnv("PUSH_ENABLED", value)
      expect(isPushEnabled()).toBe(false)
    }
    vi.stubEnv("PUSH_ENABLED", " TRUE ")
    expect(isPushEnabled()).toBe(true)
  })
})
