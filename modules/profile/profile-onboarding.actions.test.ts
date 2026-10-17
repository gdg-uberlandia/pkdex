import { afterEach, describe, expect, it, vi } from "vitest"
import { ZodError } from "zod"

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  redirect: vi.fn(),
  revalidate: vi.fn(),
}))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }))
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }))
vi.mock("@/lib/require-auth", () => ({
  requireAuth: async () => ({ user: { id: "me" } }),
}))
vi.mock("./profile.service", () => ({
  completeProfileForSession: mocks.complete,
  updateProfileForSession: vi.fn(),
}))
import { completeProfileOnboardingAction } from "./profile.actions"

afterEach(() => {
  vi.resetAllMocks()
  vi.unstubAllEnvs()
})
describe("post-onboarding invitation", () => {
  it("finishes the profile before redirecting to the full screen invitation", async () => {
    vi.stubEnv("PUSH_ENABLED", "true")
    vi.stubEnv("VAPID_PUBLIC_KEY", "key")
    mocks.complete.mockResolvedValue({ onboardingCompleted: true })
    mocks.redirect.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`)
    })
    await expect(completeProfileOnboardingAction({})).rejects.toThrow(
      "redirect:/notifications/enable"
    )
    expect(mocks.complete.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.redirect.mock.invocationCallOrder[0]
    )
  })
  it("goes to home when push is globally disabled", async () => {
    vi.stubEnv("PUSH_ENABLED", "false")
    mocks.complete.mockResolvedValue({ onboardingCompleted: true })
    mocks.redirect.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`)
    })
    await expect(completeProfileOnboardingAction({})).rejects.toThrow(
      "redirect:/home"
    )
  })
  it("keeps validation errors on the form without opening the invitation", async () => {
    mocks.complete.mockRejectedValue(new ZodError([]))
    expect((await completeProfileOnboardingAction({})).success).toBe(false)
    expect(mocks.redirect).not.toHaveBeenCalled()
  })
})
