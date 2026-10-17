import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const notice = { kind: "notice" }
  const read = { kind: "read" }
  const device = { kind: "device" }
  const get = vi.fn()
  const create = vi.fn()
  const remove = vi.fn()
  const set = vi.fn()
  const transaction = { get, create, delete: remove }
  return { notice, read, device, get, create, remove, set, transaction }
})
vi.mock("@/lib/firebase/admin", () => ({
  firestore: {
    collection: (name: string) => ({
      doc: () =>
        name.endsWith("notices")
          ? mocks.notice
          : name.endsWith("pushSubscriptions")
            ? { ...mocks.device, set: mocks.set }
            : { collection: () => ({ doc: () => mocks.read }) },
    }),
    runTransaction: (
      callback: (transaction: typeof mocks.transaction) => Promise<unknown>
    ) => callback(mocks.transaction),
  },
}))
import {
  markNoticeRead,
  removeSubscription,
  saveSubscription,
} from "./notice.repository"

const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/test",
  keys: { p256dh: "a".repeat(87), auth: "b".repeat(22) },
}
beforeEach(() => vi.clearAllMocks())
describe("notice privacy and integrity", () => {
  it("rejects marking a notice from another event as read", async () => {
    mocks.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ eventId: "other" }),
    })
    await expect(markNoticeRead("current", "me", "notice")).rejects.toThrow()
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it("preserves the first read timestamp when the notice is reopened", async () => {
    mocks.get
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ eventId: "current" }),
      })
      .mockResolvedValueOnce({ exists: true })
    await markNoticeRead("current", "me", "notice")
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it("creates only the current participant's read receipt", async () => {
    mocks.get
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ eventId: "current" }),
      })
      .mockResolvedValueOnce({ exists: false })
    await markNoticeRead("current", "me", "notice")
    expect(mocks.create).toHaveBeenCalledWith(
      mocks.read,
      expect.objectContaining({ eventId: "current", userId: "me" })
    )
  })
  it("does not delete another participant's subscription", async () => {
    mocks.get.mockResolvedValueOnce({ data: () => ({ userId: "other" }) })
    await removeSubscription("current", "me", subscription)
    expect(mocks.remove).not.toHaveBeenCalled()
  })
  it("associates subscriptions with server-derived identity", async () => {
    await saveSubscription("current", "me", subscription)
    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: "current", userId: "me" })
    )
  })
})
