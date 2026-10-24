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
      collection: (name: string) => ({ doc: (id: string) => ref(name, id) }),
      runTransaction: (
        callback: (transaction: unknown) => Promise<unknown>
      ) => {
        const run = mock.tail.then(async () => {
          const writes: (() => void)[] = []
          const result = await callback({
            get: async (reference: { path: string; id: string }) =>
              snapshot(reference.path, reference.id),
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

import { completeMission } from "./mission.repository"

const id = createHash("sha256")
  .update(JSON.stringify(["event-1", "user-1", "mission", "keyword-1"]))
  .digest("hex")
const input = {
  eventId: "event-1",
  participantId: "user-1",
  missionId: "keyword-1",
  validationType: "keyword" as const,
  defaultXpAwarded: 100,
}
beforeEach(() => {
  mock.documents.clear()
  mock.increments.mockClear()
  mock.tail = Promise.resolve()
  const now = Timestamp.now()
  mock.documents.set("missions/keyword-1", {
    eventId: "event-1",
    title: "Palavra secreta",
    description: "Descubra a palavra.",
    qrId: null,
    imageUrl: null,
    validationType: "keyword",
    keywordConfig: {
      acceptedAnswers: ["Conexão", "Networking"],
      maxAttempts: 2,
    },
    active: true,
    order: 0,
    xpAwarded: 50,
    createdAt: now,
    updatedAt: now,
  })
  mock.documents.set("profiles/user-1", {
    userId: "user-1",
    eventId: "event-1",
    onboardingCompleted: true,
    accessRoles: ["participant"],
    xp: 10,
  })
})

describe("keyword completion transaction", () => {
  it("accepts normalized answers and awards XP only once for simultaneous submissions", async () => {
    const results = await Promise.all([
      completeMission({ ...input, answer: " CONEXAO " }),
      completeMission({ ...input, answer: "Networking" }),
    ])
    expect(results.map((result) => result.status)).toEqual([
      "completed",
      "already-completed",
    ])
    expect(mock.documents.get("profiles/user-1")).toMatchObject({ xp: 60 })
    expect(mock.increments).toHaveBeenCalledTimes(1)
    expect(mock.documents.get(`missionAttempts/${id}`)).toMatchObject({
      attempts: 1,
    })
  })
  it("persists incorrect attempts, exhausts the limit, and rejects subsequent correct answers", async () => {
    expect((await completeMission({ ...input, answer: "wrong" })).status).toBe(
      "incorrect-answer"
    )
    expect((await completeMission({ ...input, answer: "wrong" })).status).toBe(
      "attempts-exhausted"
    )
    expect(
      (await completeMission({ ...input, answer: "conexao" })).status
    ).toBe("attempts-exhausted")
    expect(mock.documents.get("profiles/user-1")).toMatchObject({ xp: 10 })
    expect(mock.documents.has(`activityCompletions/${id}`)).toBe(false)
    expect(mock.documents.get(`missionAttempts/${id}`)).toMatchObject({
      attempts: 2,
      outcome: "failed",
    })
    const mission = mock.documents.get("missions/keyword-1") as {
      keywordConfig: object
    }
    mock.documents.set("missions/keyword-1", {
      ...mission,
      keywordConfig: { ...mission.keywordConfig, maxAttempts: 10 },
    })
    expect(
      (await completeMission({ ...input, answer: "conexao" })).status
    ).toBe("attempts-exhausted")
  })
  it("allows success on the last permitted attempt", async () => {
    await completeMission({ ...input, answer: "wrong" })
    expect(
      (await completeMission({ ...input, answer: "networking" })).status
    ).toBe("completed")
  })
  it("does not consume attempts before prerequisites are satisfied", async () => {
    const mission = mock.documents.get("missions/keyword-1") as object
    mock.documents.set("missions/keyword-1", {
      ...mission,
      prerequisites: [{ type: "company", activityId: "company-1" }],
    })
    expect(
      (await completeMission({ ...input, answer: "conexao" })).status
    ).toBe("prerequisite-missing")
    expect(mock.documents.has(`missionAttempts/${id}`)).toBe(false)
  })
  it("rejects inactive missions and participants from another event", async () => {
    const mission = mock.documents.get("missions/keyword-1") as object
    mock.documents.set("missions/keyword-1", { ...mission, active: false })
    expect(
      (await completeMission({ ...input, answer: "conexao" })).status
    ).toBe("inactive")
    mock.documents.set("missions/keyword-1", { ...mission, active: true })
    mock.documents.set("profiles/user-1", {
      userId: "user-1",
      eventId: "other",
      onboardingCompleted: true,
      accessRoles: ["participant"],
    })
    expect(
      (await completeMission({ ...input, answer: "conexao" })).status
    ).toBe("profile-unavailable")
  })
})

it("does not consume attempts or award XP while missions are paused", async () => {
  mock.documents.set("eventOperations/event-1", {
    eventId: "event-1",
    missionsEnabled: false,
  })
  expect((await completeMission({ ...input, answer: "conexao" })).status).toBe(
    "disabled"
  )
  expect(mock.documents.has(`missionAttempts/${id}`)).toBe(false)
  expect(mock.documents.has(`activityCompletions/${id}`)).toBe(false)
})
