import type { Session } from "next-auth"
import { beforeEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  profile: vi.fn(),
  pathname: "/missions" as string | null,
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("@/modules/profile/profile.service", () => ({
  getProfileForSession: mocks.profile,
}))
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers(mocks.pathname ? { "x-pokedex-pathname": mocks.pathname } : {}),
}))
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`)
  },
}))
import { requireAuth } from "./require-auth"
const session = { user: { id: "employee" } } as Session
beforeEach(() => {
  mocks.auth.mockResolvedValue(session)
  mocks.profile.mockResolvedValue({ accessRoles: ["sponsor"] })
  mocks.pathname = "/missions"
})
it("allows sponsor review pages and account access", async () => {
  for (const path of [
    "/missions",
    "/missions/review/activation",
    "/sponsor/account",
  ]) {
    mocks.pathname = path
    expect(await requireAuth()).toEqual(session)
  }
})
it("redirects sponsors away from participant and operations pages", async () => {
  for (const path of [
    "/home",
    "/profile",
    "/tickets",
    "/operations",
    "/onboarding",
  ]) {
    mocks.pathname = path
    await expect(requireAuth()).rejects.toThrow("redirect:/missions")
  }
})
it("preserves access for other roles and requires authentication", async () => {
  mocks.profile.mockResolvedValue({ accessRoles: ["participant"] })
  mocks.pathname = "/home"
  expect(await requireAuth()).toEqual(session)
  mocks.auth.mockResolvedValue(null)
  await expect(requireAuth()).rejects.toThrow("redirect:/login")
})

it("redirects sponsors when the trusted pathname header is missing", async () => {
  mocks.pathname = null
  await expect(requireAuth()).rejects.toThrow("redirect:/missions")
})
