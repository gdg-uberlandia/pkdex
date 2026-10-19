import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const get = vi.fn()
  const update = vi.fn()
  return { get, update }
})
vi.mock("server-only", () => ({}))
vi.mock("@/lib/firebase/admin", () => ({
  firestore: {
    collection: () => ({ doc: (id: string) => ({ id }) }),
    runTransaction: async (
      operation: (transaction: typeof mocks) => Promise<void>
    ) => operation(mocks),
  },
}))

import { completeProfileByUserId } from "./profile.repository"

const input = {
  displayName: "Participante",
  gender: "Prefiro não me identificar" as const,
  bio: null,
  role: null,
  company: null,
  linkedinUsername: null,
  website: null,
  interests: ["career"],
  skills: [],
}

beforeEach(() => vi.clearAllMocks())

describe("onboarding XP", () => {
  it("grants 75 XP once and preserves other XP", async () => {
    let profile = {
      onboardingCompleted: false,
      accessRoles: ["participant"],
      xp: 50,
    }
    mocks.get.mockImplementation(async () => ({
      exists: true,
      data: () => profile,
    }))
    mocks.update.mockImplementation((_ref, changes) => {
      profile = { ...profile, ...changes }
    })

    await completeProfileByUserId("participant", input)
    expect(profile.xp).toBe(125)
    expect(mocks.update.mock.calls[0][1].xpReachedAt).toBeDefined()

    await completeProfileByUserId("participant", input)
    expect(profile.xp).toBe(125)
    expect(mocks.update.mock.calls[1][1]).not.toHaveProperty("xpReachedAt")
  })

  it.each([
    { onboardingCompleted: true, accessRoles: ["participant"] },
    { onboardingCompleted: false, accessRoles: ["admin"] },
  ])(
    "does not grant XP to $accessRoles with completion=$onboardingCompleted",
    async (fields) => {
      mocks.get.mockResolvedValue({
        exists: true,
        data: () => ({ ...fields, xp: 50 }),
      })
      await completeProfileByUserId("profile", input)
      expect(mocks.update.mock.calls[0][1]).not.toHaveProperty("xp")
    }
  )
})
