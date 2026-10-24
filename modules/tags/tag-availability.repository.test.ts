import { createHash } from "node:crypto"

import { Timestamp } from "firebase-admin/firestore"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mock = vi.hoisted(() => ({
  documents: new Map<string, unknown>(),
  tail: Promise.resolve(),
  increments: vi.fn(),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/modules/participant-summary/participant-summary.repository", () => ({
  incrementParticipantSummary: mock.increments,
  getParticipantSummaryRef: vi.fn(),
}))
vi.mock("@/lib/firebase/admin", () => {
  const ref = (collection: string, id: string) => ({
    path: `${collection}/${id}`,
    id,
    get: async () => snapshot(`${collection}/${id}`, id),
  })
  const snapshot = (path: string, id: string) => ({
    id,
    exists: mock.documents.has(path),
    data: () => mock.documents.get(path),
  })
  return {
    firestore: {
      collection: (name: string) => ({
        doc: (id: string) => ref(name, id),
        where: () => ({ where: () => ({ limit: () => ({ query: name }) }) }),
      }),
      runTransaction: (
        callback: (transaction: unknown) => Promise<unknown>
      ) => {
        const run = mock.tail.then(async () => {
          const writes: (() => void)[] = []
          const result = await callback({
            get: async (reference: {
              path: string
              id: string
              query?: string
            }) => {
              if (reference.query) {
                const docs = [...mock.documents.entries()]
                  .filter(([path]) => path.startsWith(`${reference.query}/`))
                  .map(([path]) => snapshot(path, path.split("/")[1]))
                return { docs, empty: docs.length === 0, size: docs.length }
              }
              return snapshot(reference.path, reference.id)
            },
            set: (reference: { path: string }, value: unknown) =>
              writes.push(() => mock.documents.set(reference.path, value)),
            create: (reference: { path: string }, value: unknown) =>
              writes.push(() => {
                if (mock.documents.has(reference.path))
                  throw new Error("Duplicate")
                mock.documents.set(reference.path, value)
              }),
            update: (reference: { path: string }, value: object) =>
              writes.push(() =>
                mock.documents.set(reference.path, {
                  ...(mock.documents.get(reference.path) as object),
                  ...value,
                })
              ),
          })
          writes.forEach((write) => write())
          return result
        })
        mock.tail = run.then(() => undefined)
        return run
      },
    },
  }
})

import { completeTagDiscovery } from "./tag.repository"

const qrId = "c35d5cf6-a3f4-4ae0-9e6f-0bad73cdded6"
const id = createHash("sha256")
  .update(JSON.stringify(["event", "participant", "tag", "tag-1"]))
  .digest("hex")
const input = {
  eventId: "event",
  participantId: "participant",
  qrId,
  defaultXpAwarded: 75,
}
beforeEach(() => {
  mock.documents.clear()
  mock.increments.mockClear()
  mock.tail = Promise.resolve()
  const now = Timestamp.now()
  mock.documents.set("tags/tag-1", {
    eventId: "event",
    qrId,
    name: "Tag teste",
    description: "Teste",
    imageUrl: "https://example.com/tag.png",
    active: true,
    order: 0,
    xpAwarded: 75,
    createdAt: now,
    updatedAt: now,
  })
  mock.documents.set("profiles/participant", {
    userId: "participant",
    eventId: "event",
    accessRoles: ["participant"],
    onboardingCompleted: true,
    xp: 0,
  })
})
describe("global tag pause", () => {
  it("prevents discoveries and XP while paused and resumes after release", async () => {
    mock.documents.set("eventOperations/event", {
      eventId: "event",
      tagsEnabled: false,
      missionsEnabled: true,
    })
    expect((await completeTagDiscovery(input)).status).toBe("disabled")
    expect(mock.documents.has(`activityCompletions/${id}`)).toBe(false)
    expect(mock.increments).not.toHaveBeenCalled()
    mock.documents.set("eventOperations/event", {
      eventId: "event",
      tagsEnabled: true,
    })
    expect((await completeTagDiscovery(input)).status).toBe("discovered")
    expect(mock.documents.get("profiles/participant")).toMatchObject({ xp: 75 })
  })
  it("preserves earlier discoveries during a pause", async () => {
    expect((await completeTagDiscovery(input)).status).toBe("discovered")
    const receipt = mock.documents.get(`activityCompletions/${id}`)
    mock.documents.set("eventOperations/event", {
      eventId: "event",
      tagsEnabled: false,
    })
    expect((await completeTagDiscovery(input)).status).toBe(
      "already-discovered"
    )
    expect(mock.documents.get(`activityCompletions/${id}`)).toEqual(receipt)
    expect(mock.increments).toHaveBeenCalledTimes(1)
  })
})
