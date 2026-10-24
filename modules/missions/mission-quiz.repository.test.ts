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
      getAll: async (...refs: { path: string; id: string }[]) =>
        refs.map((reference) => snapshot(reference.path, reference.id)),
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

import {
  completeMission,
  findMissionAttemptsByParticipant,
} from "./mission.repository"

const revision = 1700000000000
const id = createHash("sha256")
  .update(JSON.stringify(["event-1", "user-1", "mission", "quiz-1"]))
  .digest("hex")
const input = {
  eventId: "event-1",
  participantId: "user-1",
  missionId: "quiz-1",
  validationType: "quiz" as const,
  defaultXpAwarded: 100,
  revision,
}
const correctAnswers = [
  { questionId: "q1", optionIndex: 0 },
  { questionId: "q2", optionIndex: 1 },
]
beforeEach(() => {
  mock.documents.clear()
  mock.increments.mockClear()
  mock.tail = Promise.resolve()
  const now = Timestamp.fromMillis(revision)
  mock.documents.set("missions/quiz-1", {
    eventId: "event-1",
    title: "Quiz rápido",
    description: "Responda as perguntas",
    qrId: null,
    imageUrl: null,
    validationType: "quiz",
    quizConfig: {
      questions: [
        {
          id: "q1",
          prompt: "Pergunta 1",
          options: ["A", "B"],
          correctOptionIndex: 0,
        },
        {
          id: "q2",
          prompt: "Pergunta 2",
          options: ["A", "B"],
          correctOptionIndex: 1,
        },
      ],
      minCorrectAnswers: 2,
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
describe("quiz completion transaction", () => {
  it("awards XP only once for concurrent submissions", async () => {
    const results = await Promise.all([
      completeMission({ ...input, answers: correctAnswers }),
      completeMission({ ...input, answers: correctAnswers }),
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
  it("allows passing on the final attempt", async () => {
    expect(
      (
        await completeMission({
          ...input,
          answers: [
            { questionId: "q1", optionIndex: 1 },
            { questionId: "q2", optionIndex: 0 },
          ],
        })
      ).status
    ).toBe("quiz-not-passed")
    expect(
      (await completeMission({ ...input, answers: correctAnswers })).status
    ).toBe("completed")
  })
  it("blocks attempts beyond the limit", async () => {
    const wrong = [
      { questionId: "q1", optionIndex: 1 },
      { questionId: "q2", optionIndex: 0 },
    ]
    await completeMission({ ...input, answers: wrong })
    expect((await completeMission({ ...input, answers: wrong })).status).toBe(
      "attempts-exhausted"
    )
    expect(
      (await completeMission({ ...input, answers: correctAnswers })).status
    ).toBe("attempts-exhausted")
    expect(mock.documents.get("profiles/user-1")).toMatchObject({ xp: 10 })
    expect(mock.documents.get(`missionAttempts/${id}`)).toMatchObject({
      attempts: 2,
      outcome: "failed",
      lastScore: 0,
      questionCount: 2,
    })
    expect(mock.documents.has(`activityCompletions/${id}`)).toBe(false)
    const persisted = await findMissionAttemptsByParticipant(
      "event-1",
      "user-1",
      ["quiz-1"]
    )
    expect(persisted.get("quiz-1")).toMatchObject({
      outcome: "failed",
      attempts: 2,
      lastScore: 0,
    })
    const mission = mock.documents.get("missions/quiz-1") as {
      quizConfig: object
    }
    mock.documents.set("missions/quiz-1", {
      ...mission,
      quizConfig: { ...mission.quizConfig, maxAttempts: 10 },
    })
    expect(
      (await completeMission({ ...input, answers: correctAnswers })).status
    ).toBe("attempts-exhausted")
  })
  it("serializes simultaneous submissions on the final attempt without granting XP", async () => {
    const wrong = [
      { questionId: "q1", optionIndex: 1 },
      { questionId: "q2", optionIndex: 0 },
    ]
    await completeMission({ ...input, answers: wrong })
    const results = await Promise.all([
      completeMission({ ...input, answers: wrong }),
      completeMission({ ...input, answers: correctAnswers }),
    ])
    expect(results.map((result) => result.status)).toEqual([
      "attempts-exhausted",
      "attempts-exhausted",
    ])
    expect(mock.documents.get(`missionAttempts/${id}`)).toMatchObject({
      attempts: 2,
      outcome: "failed",
    })
    expect(mock.increments).not.toHaveBeenCalled()
  })
  it("does not consume incomplete or stale submissions", async () => {
    expect(
      (await completeMission({ ...input, answers: [correctAnswers[0]] })).status
    ).toBe("invalid-answers")
    expect(
      (
        await completeMission({
          ...input,
          revision: revision - 1,
          answers: correctAnswers,
        })
      ).status
    ).toBe("quiz-changed")
    expect(mock.documents.has(`missionAttempts/${id}`)).toBe(false)
  })
  it("checks prerequisites and participant permission", async () => {
    const mission = mock.documents.get("missions/quiz-1") as object
    mock.documents.set("missions/quiz-1", {
      ...mission,
      prerequisites: [{ type: "company", activityId: "company-1" }],
    })
    expect(
      (await completeMission({ ...input, answers: correctAnswers })).status
    ).toBe("prerequisite-missing")
    expect(mock.documents.has(`missionAttempts/${id}`)).toBe(false)
    mock.documents.set("profiles/user-1", {
      userId: "user-1",
      eventId: "event-1",
      onboardingCompleted: true,
      accessRoles: ["admin"],
    })
    expect(
      (await completeMission({ ...input, answers: correctAnswers })).status
    ).toBe("profile-unavailable")
  })
})

it("does not consume attempts or award XP while missions are paused", async () => {
  mock.documents.set("eventOperations/event-1", {
    eventId: "event-1",
    missionsEnabled: false,
  })
  expect(
    (await completeMission({ ...input, answers: correctAnswers })).status
  ).toBe("disabled")
  expect(mock.documents.has(`missionAttempts/${id}`)).toBe(false)
  expect(mock.documents.has(`activityCompletions/${id}`)).toBe(false)
})
