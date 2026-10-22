import type { Session } from "next-auth"
import { afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  remove: vi.fn(),
  readAll: vi.fn(),
}))
vi.mock("@/modules/profile/profile.service", () => ({
  requireProfileForSession: async () => ({
    eventId: "event",
    userId: "me",
    onboardingCompleted: true,
  }),
}))
vi.mock("./notice.repository", () => ({
  markAllNoticesRead: mocks.readAll,
  saveSubscription: mocks.save,
  removeSubscription: mocks.remove,
}))
import {
  readAllNoticesForSession,
  updateSubscriptionForSession,
} from "./notice.service"
const session = {} as Session

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})
describe("subscription switch enforcement", () => {
  it("blocks new subscriptions even when the client bypasses the UI", async () => {
    vi.stubEnv("PUSH_ENABLED", "false")
    await expect(updateSubscriptionForSession(session, {})).rejects.toThrow(
      "Push desativado"
    )
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it("allows removing existing subscriptions while push is disabled", async () => {
    vi.stubEnv("PUSH_ENABLED", "false")
    await updateSubscriptionForSession(session, {}, true)
    expect(mocks.remove).toHaveBeenCalledWith("event", "me", {})
  })
  it("allows subscriptions when push is enabled", async () => {
    vi.stubEnv("PUSH_ENABLED", "true")
    await updateSubscriptionForSession(session, {})
    expect(mocks.save).toHaveBeenCalledWith("event", "me", {})
  })
})

it("derives the bulk read user and event from the authenticated profile", async () => {
  await readAllNoticesForSession(session)
  expect(mocks.readAll).toHaveBeenCalledWith("event", "me")
})
