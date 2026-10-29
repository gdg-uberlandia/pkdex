import { Timestamp } from "firebase-admin/firestore"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  where: vi.fn(),
  collection: vi.fn(),
}))
vi.mock("@/lib/firebase/admin", () => ({
  firestore: { collection: mocks.collection },
}))

import { findActiveMissions } from "./mission.repository"

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("DEVMODE", "false")
  mocks.collection.mockReturnValue({ where: mocks.where })
  mocks.where.mockReturnValue({ get: mocks.get })
})

afterEach(() => vi.unstubAllEnvs())

it("reads links saved by the admin on the next catalog request", async () => {
  const mission = {
    eventId: "event",
    qrId: null,
    title: "Missão",
    description: "Descrição",
    imageUrl: null,
    validationType: "reviewer",
    active: true,
    order: 0,
    xpAwarded: 25,
    createdAt: Timestamp.fromMillis(0),
    updatedAt: Timestamp.fromMillis(0),
  }
  const snapshot = (externalLinks: Array<{ label: string; url: string }>) => ({
    docs: [{ id: "mission", data: () => ({ ...mission, externalLinks }) }],
  })
  const links = [{ label: "Instagram", url: "https://example.com/instagram" }]
  mocks.get
    .mockResolvedValueOnce(snapshot([]))
    .mockResolvedValueOnce(snapshot(links))
  expect((await findActiveMissions("event"))[0].externalLinks).toEqual([])
  expect((await findActiveMissions("event"))[0].externalLinks).toEqual(links)
  expect(mocks.get).toHaveBeenCalledTimes(2)
})
