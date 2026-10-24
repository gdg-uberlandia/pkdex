import { createHash } from "node:crypto"

import { Timestamp } from "firebase-admin/firestore"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mock = vi.hoisted(() => ({
  documents: new Map<string, unknown>(),
  tail: Promise.resolve(),
  increments: vi.fn(),
  beforeTransaction: null as (() => void) | null,
}))
vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({
  unstable_cache: () => async () => {
    throw new Error("Review must bypass the shared catalog cache")
  },
}))
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
        where: (field: string, _operator: string, value: unknown) => ({
          get: async () => ({
            docs: [...mock.documents.entries()]
              .filter(
                ([path, data]) =>
                  path.startsWith(`${name}/`) &&
                  (data as Record<string, unknown>)[field] === value
              )
              .map(([path]) => snapshot(path, path.slice(name.length + 1))),
          }),
        }),
      }),
      runTransaction: (
        callback: (transaction: unknown) => Promise<unknown>
      ) => {
        const run = mock.tail.then(async () => {
          mock.beforeTransaction?.()
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

import { completeMission, findReviewableMissions } from "./mission.repository"

const completionId = createHash("sha256")
  .update(JSON.stringify(["event", "participant", "mission", "activation"]))
  .digest("hex")
const input = {
  eventId: "event",
  participantId: "participant",
  missionId: "activation",
  validationType: "reviewer" as const,
  validatedBy: "employee",
  defaultXpAwarded: 50,
}
function change(path: string, fields: object) {
  mock.documents.set(path, {
    ...(mock.documents.get(path) as object),
    ...fields,
  })
}
beforeEach(() => {
  mock.documents.clear()
  mock.increments.mockClear()
  mock.tail = Promise.resolve()
  mock.beforeTransaction = null
  const now = Timestamp.now()
  mock.documents.set("missions/activation", {
    eventId: "event",
    companyId: "company-a",
    title: "Ativação",
    description: "Experimente o produto",
    qrId: null,
    imageUrl: null,
    validationType: "reviewer",
    active: true,
    order: 0,
    xpAwarded: 50,
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
  mock.documents.set("profiles/employee", {
    userId: "employee",
    eventId: "event",
    accessRoles: ["sponsor"],
    sponsorCompanyId: "company-a",
  })
  mock.documents.set("companies/company-a", { eventId: "event", active: true })
})
describe("sponsor mission completion", () => {
  it("records the employee and first validation time and awards points once", async () => {
    expect((await completeMission(input)).status).toBe("completed")
    const receipt = mock.documents.get(`activityCompletions/${completionId}`)
    expect(receipt).toMatchObject({
      validatedBy: "employee",
      validatedAt: expect.any(Timestamp),
      xpAwarded: 50,
    })
    expect((await completeMission(input)).status).toBe("already-completed")
    expect(mock.documents.get(`activityCompletions/${completionId}`)).toEqual(
      receipt
    )
    expect(mock.documents.get("profiles/participant")).toMatchObject({ xp: 50 })
    expect(mock.increments).toHaveBeenCalledTimes(1)
  })
  it.each([{ companyId: "company-b" }, { companyId: null }])(
    "rejects unauthorized direct mission requests: %o",
    async (fields) => {
      change("missions/activation", fields)
      expect((await completeMission(input)).status).toBe("forbidden")
      expect(mock.documents.has(`activityCompletions/${completionId}`)).toBe(
        false
      )
      expect(mock.increments).not.toHaveBeenCalled()
    }
  )
  it.each([
    [
      "profiles/employee",
      { accessRoles: ["participant"], sponsorCompanyId: null },
    ],
    ["profiles/employee", { sponsorCompanyId: "company-b" }],
    ["profiles/employee", { sponsorCompanyId: null }],
    ["profiles/employee", { eventId: "other" }],
    ["missions/activation", { companyId: "company-b" }],
    ["missions/activation", { active: false }],
    [
      "missions/activation",
      {
        validationType: "keyword",
        keywordConfig: { acceptedAnswers: ["ok"], maxAttempts: 1 },
      },
    ],
    ["companies/company-a", { active: false }],
    ["companies/company-a", { eventId: "other" }],
  ] as const)(
    "rechecks %s inside the write transaction: %o",
    async (path, fields) => {
      mock.beforeTransaction = () => change(path, fields)
      expect((await completeMission(input)).status).toBe("forbidden")
      expect(mock.documents.has(`activityCompletions/${completionId}`)).toBe(
        false
      )
    }
  )
  it("rejects a deleted company", async () => {
    mock.documents.delete("companies/company-a")
    expect((await completeMission(input)).status).toBe("forbidden")
  })
  it("uses current prerequisites when a mission changes during validation", async () => {
    mock.beforeTransaction = () =>
      change("missions/activation", {
        prerequisites: [{ type: "company", activityId: "company-a" }],
      })
    expect((await completeMission(input)).status).toBe("prerequisite-missing")
  })
  it.each(["admin", "reviewer"])(
    "preserves global validation for %s",
    async (role) => {
      change("profiles/employee", {
        accessRoles: [role],
        sponsorCompanyId: null,
      })
      change("missions/activation", { companyId: null })
      expect((await completeMission(input)).status).toBe("completed")
    }
  )
  it("does not grant participant points to sponsor accounts", async () => {
    change("profiles/participant", {
      accessRoles: ["sponsor"],
      sponsorCompanyId: "company-a",
    })
    expect((await completeMission(input)).status).toBe("profile-unavailable")
  })
})

it("refreshes review assignments and active state without using the catalog cache", async () => {
  expect((await findReviewableMissions("event"))[0].companyId).toBe("company-a")
  change("missions/activation", { companyId: "company-b" })
  expect((await findReviewableMissions("event"))[0].companyId).toBe("company-b")
  change("missions/activation", { active: false })
  expect(await findReviewableMissions("event")).toEqual([])
})

it("blocks new onsite and QR completions while missions are paused", async () => {
  mock.documents.set("eventOperations/event", {
    eventId: "event",
    missionsEnabled: false,
  })
  expect((await completeMission(input)).status).toBe("disabled")
  const qrId = "c35d5cf6-a3f4-4ae0-9e6f-0bad73cdded6"
  change("missions/activation", { validationType: "qr", qrId })
  expect(
    (await completeMission({ ...input, validationType: "qr", qrId })).status
  ).toBe("disabled")
  expect(mock.documents.get("profiles/participant")).toMatchObject({ xp: 0 })
  expect(mock.increments).not.toHaveBeenCalled()
})
it("preserves existing completion receipts during a global pause", async () => {
  expect((await completeMission(input)).status).toBe("completed")
  const receipt = mock.documents.get(`activityCompletions/${completionId}`)
  mock.documents.set("eventOperations/event", {
    eventId: "event",
    missionsEnabled: false,
  })
  expect((await completeMission(input)).status).toBe("already-completed")
  expect(mock.documents.get(`activityCompletions/${completionId}`)).toEqual(
    receipt
  )
})
