import { beforeEach, expect, it, vi } from "vitest"
const mock = vi.hoisted(() => ({
  documents: new Map<string, Record<string, unknown>>(),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/firebase/admin", () => {
  const snapshot = (path: string) => ({
    exists: mock.documents.has(path),
    data: () => mock.documents.get(path),
  })
  return {
    firestore: {
      collection: (collection: string) => ({
        doc: (id: string) => ({
          path: `${collection}/${id}`,
          get: async () => snapshot(`${collection}/${id}`),
        }),
      }),
      runTransaction: async (
        operation: (transaction: unknown) => Promise<unknown>
      ) =>
        operation({
          get: async (ref: { path: string }) => snapshot(ref.path),
          set: (
            ref: { path: string },
            value: Record<string, unknown>,
            options: { merge: boolean }
          ) => {
            expect(options.merge).toBe(true)
            mock.documents.set(ref.path, {
              ...mock.documents.get(ref.path),
              ...value,
            })
          },
        }),
    },
  }
})
import {
  findActivityAvailability,
  setActivityAvailability,
} from "./activity-availability.repository"
import { activityAvailabilityInputSchema } from "./activity-availability.schema"

beforeEach(() => {
  mock.documents.clear()
  mock.documents.set("profiles/admin", {
    userId: "admin",
    eventId: "event",
    accessRoles: ["admin"],
  })
})
it("defaults both services to enabled for existing and new events", async () => {
  expect(await findActivityAvailability("event")).toEqual({
    tagsEnabled: true,
    missionsEnabled: true,
  })
  mock.documents.set("eventOperations/event", {
    eventId: "event",
    ticketConversionEnabled: false,
  })
  expect(await findActivityAvailability("event")).toEqual({
    tagsEnabled: true,
    missionsEnabled: true,
  })
})
it("updates each service independently and preserves ticket and raffle settings", async () => {
  mock.documents.set("eventOperations/event", {
    eventId: "event",
    ticketConversionEnabled: false,
    rewardRedemptionEnabled: false,
    raffleClosureStatus: "closed",
  })
  expect(await setActivityAvailability("event", "tags", false, "admin")).toBe(
    true
  )
  expect(await findActivityAvailability("event")).toEqual({
    tagsEnabled: false,
    missionsEnabled: true,
  })
  expect(
    await setActivityAvailability("event", "missions", false, "admin")
  ).toBe(true)
  expect(await setActivityAvailability("event", "tags", true, "admin")).toBe(
    true
  )
  expect(mock.documents.get("eventOperations/event")).toMatchObject({
    tagsEnabled: true,
    missionsEnabled: false,
    ticketConversionEnabled: false,
    rewardRedemptionEnabled: false,
    raffleClosureStatus: "closed",
    updatedBy: "admin",
  })
})
it.each(["participant", "reviewer", "sponsor", "staff", "editor"])(
  "rejects %s even when called directly",
  async (role) => {
    mock.documents.set("profiles/admin", {
      userId: "admin",
      eventId: "event",
      accessRoles: [role],
    })
    expect(await setActivityAvailability("event", "tags", false, "admin")).toBe(
      false
    )
    expect(mock.documents.has("eventOperations/event")).toBe(false)
  }
)
it("rejects removed accounts and cross-event operators", async () => {
  mock.documents.delete("profiles/admin")
  expect(
    await setActivityAvailability("event", "missions", false, "admin")
  ).toBe(false)
  mock.documents.set("profiles/admin", {
    userId: "admin",
    eventId: "other",
    accessRoles: ["admin"],
  })
  expect(
    await setActivityAvailability("event", "missions", false, "admin")
  ).toBe(false)
})
it("does not accept malformed form values as a request to block services", () => {
  for (const value of [
    { service: "missions" },
    { service: "missions", enabled: "invalid" },
    { service: "tickets", enabled: "false" },
  ])
    expect(activityAvailabilityInputSchema.safeParse(value).success).toBe(false)
})
it("rejects a corrupted event identity", async () => {
  mock.documents.set("eventOperations/event", { eventId: "other" })
  await expect(findActivityAvailability("event")).rejects.toThrow("identity")
})
