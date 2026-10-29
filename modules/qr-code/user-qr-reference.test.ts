import { Timestamp } from "firebase-admin/firestore"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
  doc: vi.fn(),
  collection: vi.fn(),
  validate: vi.fn(),
}))
vi.mock("@/env", () => ({
  env: {
    EVENT_ID: "event",
    NEXT_PUBLIC_APP_URL: "https://pokedex.example.com",
    FB_ADMIN_PROJECT_ID: "devfest-triangulo-2026",
  },
}))
vi.mock("@/lib/firebase/admin", () => ({
  firestore: { collection: mocks.collection },
}))
vi.mock("./user-qr-token", () => ({ validateUserQrToken: mocks.validate }))

import { resolveQrCodeUrl } from "./resolve-qr-code.service"
import {
  buildUserQrReferenceUrl,
  parseUserQrReferenceUrl,
} from "./user-qr-reference.contract"
import {
  findUserQrReference,
  storeUserQrReference,
} from "./user-qr-reference.repository"

const appUrl = "https://pokedex.example.com"
const code = "AbcdefghijklmnopqrstuA"
const target = {
  eventId: "event",
  type: "user" as const,
  qrId: "123e4567-e89b-42d3-a456-426614174000",
  token: "A".repeat(44),
}
const expiresAt = new Date("2030-01-01T00:00:00Z")

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("DEVMODE", "true")
  mocks.collection.mockReturnValue({ doc: mocks.doc })
  mocks.doc.mockReturnValue({ create: mocks.create, get: mocks.get })
  mocks.create.mockResolvedValue(undefined)
  mocks.get.mockResolvedValue({
    exists: true,
    data: () => ({ ...target, expiresAt: Timestamp.fromDate(expiresAt) }),
  })
  mocks.validate.mockReturnValue({ valid: true })
})

describe("short user QR references", () => {
  it("builds and parses only a same-origin 22-character reference", () => {
    expect(
      parseUserQrReferenceUrl(buildUserQrReferenceUrl(code, appUrl), appUrl)
    ).toBe(code)
    for (const url of [
      `https://evil.example/q/${code}`,
      `${appUrl}/q/${code}?a=1`,
      `${appUrl}/q/${code}#x`,
      `${appUrl}/q/${code}/`,
      `${appUrl}/q/${code.slice(1)}`,
      `${appUrl}/q/${code.slice(0, -1)}B`,
      `https://u:p@pokedex.example.com/q/${code}`,
    ]) {
      expect(parseUserQrReferenceUrl(url, appUrl)).toBeNull()
    }
  })

  it("stores a random reference by hash in the explicit test collection and reads it back", async () => {
    const issued = await storeUserQrReference(target, expiresAt)
    expect(issued).toHaveLength(22)
    expect(mocks.collection).toHaveBeenCalledWith("test_userQrReferences")
    expect(mocks.doc).toHaveBeenCalledWith(
      expect.stringMatching(/^[a-f0-9]{64}$/)
    )
    expect(mocks.create).toHaveBeenCalledWith({
      ...target,
      expiresAt: Timestamp.fromDate(expiresAt),
    })
    expect(mocks.get).toHaveBeenCalledOnce()
  })

  it("uses the production collection only with an explicit production mode", async () => {
    vi.stubEnv("DEVMODE", "false")
    await storeUserQrReference(target, expiresAt)
    expect(mocks.collection).toHaveBeenCalledWith("userQrReferences")
  })

  it("rejects writes without explicit mode or with another event", async () => {
    vi.stubEnv("DEVMODE", "")
    await expect(storeUserQrReference(target, expiresAt)).rejects.toThrow(
      "environment mismatch"
    )
    vi.stubEnv("DEVMODE", "true")
    await expect(
      storeUserQrReference({ ...target, eventId: "other" }, expiresAt)
    ).rejects.toThrow("environment mismatch")
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it("detects a failed read-back", async () => {
    mocks.get.mockResolvedValue({ exists: false, data: () => undefined })
    await expect(storeUserQrReference(target, expiresAt)).rejects.toThrow(
      "verification failed"
    )
  })

  it("resolves the reference and checks the original signature", async () => {
    expect(
      await resolveQrCodeUrl(buildUserQrReferenceUrl(code, appUrl))
    ).toEqual({ valid: true, target })
    expect(mocks.validate).toHaveBeenCalledWith(target)
    mocks.validate.mockReturnValue({ valid: false })
    expect(
      await resolveQrCodeUrl(buildUserQrReferenceUrl(code, appUrl))
    ).toEqual({ valid: false, code: "INVALID_QR" })
  })

  it("rejects missing, expired, malformed and cross-event records", async () => {
    for (const data of [
      undefined,
      { ...target, expiresAt: Timestamp.fromMillis(0) },
      { ...target, expiresAt: "bad" },
      { ...target, eventId: "other", expiresAt: Timestamp.fromDate(expiresAt) },
    ]) {
      mocks.get.mockResolvedValue({ data: () => data })
      expect(await findUserQrReference(code)).toBeNull()
    }
  })

  it("rejects obsolete URLs without a database lookup", async () => {
    expect(
      await resolveQrCodeUrl(
        `${appUrl}/qr/event/user/${target.qrId}?token=${target.token}`
      )
    ).toEqual({ valid: false, code: "INVALID_QR" })
    expect(mocks.get).not.toHaveBeenCalled()
  })
})

it.each(["company", "tag", "mission"] as const)(
  "resolves a short %s code without a reference lookup",
  async (type) => {
    const prefixes = { company: "c", tag: "t", mission: "m" }
    expect(
      await resolveQrCodeUrl(
        `${appUrl}/q/${prefixes[type]}Ej5FZ-ibQtOkVkJmFBdAAA`
      )
    ).toEqual({
      valid: true,
      target: { type, eventId: "event", qrId: target.qrId },
    })
    expect(mocks.get).not.toHaveBeenCalled()
  }
)
