import { Timestamp } from "firebase-admin/firestore"
import { beforeEach, expect, it, vi } from "vitest"

const mock = vi.hoisted(() => ({
  closed: true,
  existingRating: false,
  create: vi.fn(),
  update: vi.fn(),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/firebase/admin", () => ({
  firestore: {
    collection: (collection: string) => ({
      doc: (id: string) => ({ collection, id }),
    }),
    runTransaction: async (operation: (tx: unknown) => unknown) =>
      operation({
        get: async (ref: { collection: string; id: string }) => {
          const now = Timestamp.now()
          const records: Record<string, Record<string, unknown> | undefined> = {
            talks: {
              eventId: "event",
              title: "Talk",
              description: "Description",
              category: null,
              format: "talk",
              speakerIds: ["speaker"],
              evaluationStatus: "open",
              isActive: true,
              createdAt: now,
              updatedAt: now,
            },
            profiles: {
              eventId: "event",
              userId: "user",
              onboardingCompleted: true,
              accessRoles: ["participant"],
              xp: 25,
            },
            eventOperations: { eventId: "event", eventClosed: mock.closed },
            "talk-ratings": mock.existingRating
              ? {
                  eventId: "event",
                  participantId: "user",
                  talkId: "talk",
                  speakerRating: 5,
                  contentRating: 5,
                  comprehensionRating: 5,
                  comment:
                    "Excelente palestra com exemplos muito claros e úteis.",
                  xpAwarded: 25,
                  completedAt: now,
                }
              : undefined,
          }
          return {
            id: ref.id,
            exists: records[ref.collection] !== undefined,
            data: () => records[ref.collection],
          }
        },
        create: mock.create,
        update: mock.update,
      }),
  },
}))
import { completeTalkRating } from "./talk.repository"
const submit = () =>
  completeTalkRating({
    eventId: "event",
    participantId: "user",
    input: {
      talkId: "talk",
      speakerRating: 5,
      contentRating: 5,
      comprehensionRating: 5,
      comment: "Excelente palestra com exemplos muito claros e úteis.",
    },
    xpAwarded: 25,
  })
beforeEach(() => {
  vi.clearAllMocks()
  mock.closed = true
  mock.existingRating = false
})
it("blocks new ratings atomically after closure without touching XP or history", async () => {
  expect(await submit()).toEqual({ status: "closed" })
  expect(mock.create).not.toHaveBeenCalled()
  expect(mock.update).not.toHaveBeenCalled()
})
it("keeps an existing rating idempotent after closure", async () => {
  mock.existingRating = true
  expect(await submit()).toMatchObject({
    status: "already-rated",
    rating: { xpAwarded: 25 },
  })
  expect(mock.create).not.toHaveBeenCalled()
  expect(mock.update).not.toHaveBeenCalled()
})
it("continues awarding ratings while the event is open", async () => {
  mock.closed = false
  expect(await submit()).toMatchObject({ status: "rated" })
  expect(mock.create).toHaveBeenCalledOnce()
  expect(mock.update).toHaveBeenCalledOnce()
})
