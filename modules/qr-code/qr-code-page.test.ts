import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  resolve: vi.fn(),
  redirect: vi.fn(),
  company: vi.fn(),
  mission: vi.fn(),
  tag: vi.fn(),
  user: vi.fn(),
  error: vi.fn(),
}))
vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_APP_URL: "https://pokedex.example.com" },
}))
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }))
vi.mock("@/modules/qr-code/resolve-qr-code.service", () => ({
  resolveQrCodeUrl: mocks.resolve,
}))
vi.mock("@/modules/companies/company-visit-result", () => ({
  CompanyVisitResult: mocks.company,
}))
vi.mock("@/modules/missions/mission-completion-result", () => ({
  MissionCompletionResult: mocks.mission,
}))
vi.mock("@/modules/tags/tag-discovery-result", () => ({
  TagDiscoveryResult: mocks.tag,
}))
vi.mock("@/modules/qr-code/pages/user-qr-code-page", () => ({
  default: mocks.user,
}))
vi.mock("@/modules/qr-code/qr-result", () => ({ QrResult: mocks.error }))

import QrCodePage from "@/app/q/[code]/page"

const props = {
  params: Promise.resolve({ code: "AbcdefghijklmnopqrstuA" }),
  searchParams: Promise.resolve({}),
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ user: { id: "reader" } })
  mocks.redirect.mockImplementation(() => {
    throw new Error("redirect")
  })
})

describe("short QR page", () => {
  it.each(["company", "tag", "mission", "user"] as const)(
    "dispatches a resolved %s to its domain flow",
    async (type) => {
      const target = {
        type,
        eventId: "event",
        qrId: "public-id",
        ...(type === "user" ? { token: "signed" } : {}),
      }
      mocks.resolve.mockResolvedValue({ valid: true, target })
      const page = await QrCodePage(props)
      expect(page.type).toBe(mocks[type])
      if (type === "user")
        expect(page.props).toEqual({
          target,
          callbackPath: "/q/AbcdefghijklmnopqrstuA",
        })
      else expect(page.props).toEqual({ eventId: "event", qrId: "public-id" })
    }
  )

  it("requires authentication before looking up a reference", async () => {
    mocks.auth.mockResolvedValue(null)
    await expect(QrCodePage(props)).rejects.toThrow("redirect")
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/login?callbackUrl=%2Fq%2FAbcdefghijklmnopqrstuA"
    )
    expect(mocks.resolve).not.toHaveBeenCalled()
  })

  it("rejects query parameters and invalid references", async () => {
    const withQuery = await QrCodePage({
      ...props,
      searchParams: Promise.resolve({ token: "extra" }),
    })
    expect(withQuery.type).toBe(mocks.error)
    expect(mocks.resolve).not.toHaveBeenCalled()
    mocks.resolve.mockResolvedValue({ valid: false, code: "INVALID_QR" })
    expect((await QrCodePage(props)).type).toBe(mocks.error)
  })
})
