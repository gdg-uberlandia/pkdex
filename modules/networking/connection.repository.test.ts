import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const create = vi.fn()
  const get = vi
    .fn()
    .mockResolvedValue({ exists: false, data: () => undefined })
  const set = vi.fn()
  const update = vi.fn()
  const increment = vi.fn((amount: number) => ({ increment: amount }))
  const transaction = { create, get, set, update }
  const firestore = {
    collection: vi.fn((collection: string) => ({
      doc: vi.fn((id: string) => ({ collection, id })),
    })),
    runTransaction: vi.fn(
      async (operation: (value: typeof transaction) => unknown) =>
        operation(transaction)
    ),
  }

  return { create, firestore, get, increment, set, transaction, update }
})

vi.mock("server-only", () => ({}))
vi.mock("@/lib/firebase/admin", () => ({
  firestore: mocks.firestore,
}))
vi.mock("firebase-admin/firestore", () => {
  class Timestamp {
    static now() {
      return new Timestamp()
    }
  }

  return {
    FieldValue: { increment: mocks.increment },
    Timestamp,
  }
})

import { removeConnection, requestConnection } from "./connection.repository"

describe("connection repository", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.get.mockResolvedValue({
      exists: false,
      data: () => undefined,
    })
  })
  it("records the intersection of both profiles when creating a connection", async () => {
    mocks.get
      .mockResolvedValueOnce({ exists: false, data: () => undefined })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ interests: ["ai", "cloud"] }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ interests: ["ai", "career"] }),
      })
    await requestConnection({
      eventId: "event-1",
      requesterId: "participant-a",
      recipientId: "participant-b",
      xpAwardedPerParticipant: 5,
    })
    expect(mocks.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sharedInterests: ["ai"] })
    )
  })
  it("loads the repository contract without evaluating a database query", () => {
    expect(requestConnection).toBeTypeOf("function")
    expect(removeConnection).toBeTypeOf("function")
  })

  it("matches legacy skills with unified interests without requiring a profile save", async () => {
    mocks.get
      .mockResolvedValueOnce({ exists: false, data: () => ({}) })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ skills: ["front-end", "react", "typescript"] }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ interests: ["frontend", "react"] }),
      })
    await requestConnection({
      eventId: "event-1",
      requesterId: "participant-a",
      recipientId: "participant-b",
      xpAwardedPerParticipant: 5,
    })
    expect(mocks.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sharedInterests: ["frontend", "react"] })
    )
  })

  it("increments both profiles without reading their current XP", async () => {
    const result = await requestConnection({
      eventId: "event-1",
      requesterId: "participant-a",
      recipientId: "participant-b",
      xpAwardedPerParticipant: 5,
    })

    expect(result).toBe("connected")
    expect(mocks.get).toHaveBeenCalledTimes(4)
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.increment).toHaveBeenNthCalledWith(1, 5)
    expect(mocks.increment).toHaveBeenNthCalledWith(2, 5)
    expect(mocks.increment).toHaveBeenNthCalledWith(3, 1)
    expect(mocks.increment).toHaveBeenNthCalledWith(4, 1)
    expect(mocks.update).toHaveBeenCalledTimes(2)
    expect(mocks.set).toHaveBeenCalledTimes(2)
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: "participant-a" }),
      expect.objectContaining({ xp: { increment: 5 } })
    )
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: "participant-b" }),
      expect.objectContaining({ xp: { increment: 5 } })
    )
  })
})

it("closure blocks a new connection without changing XP, counters or history", async () => {
  vi.clearAllMocks()
  mocks.get.mockImplementation(async (ref: { collection: string }) => ({
    exists: ref.collection === "eventOperations",
    data: () =>
      ref.collection === "eventOperations"
        ? { eventId: "event-1", eventClosed: true }
        : undefined,
  }))
  expect(
    await requestConnection({
      eventId: "event-1",
      requesterId: "a",
      recipientId: "b",
      xpAwardedPerParticipant: 5,
    })
  ).toBe("event-closed")
  expect(mocks.create).not.toHaveBeenCalled()
  expect(mocks.update).not.toHaveBeenCalled()
  expect(mocks.set).not.toHaveBeenCalled()
})
