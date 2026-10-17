import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const find = vi.fn()
  const list = vi.fn()
  const reads = vi.fn()
  const notice = { kind: "notice", get: find }
  const read = { kind: "read" }
  const device = { kind: "device" }
  const get = vi.fn()
  const create = vi.fn()
  const remove = vi.fn()
  const set = vi.fn()
  const transaction = { get, create, delete: remove }
  return {
    notice,
    read,
    device,
    get,
    create,
    remove,
    set,
    transaction,
    find,
    list,
    reads,
  }
})
vi.mock("@/lib/firebase/admin", () => ({
  firestore: {
    collection: (name: string) => ({
      where: () => ({ get: mocks.list, select: () => ({ get: mocks.list }) }),
      doc: () =>
        name.endsWith("notices")
          ? mocks.notice
          : name.endsWith("pushSubscriptions")
            ? { ...mocks.device, set: mocks.set }
            : {
                collection: () => ({
                  doc: () => mocks.read,
                  get: mocks.reads,
                  select: () => ({ get: mocks.reads }),
                }),
              },
    }),
    runTransaction: (
      callback: (transaction: typeof mocks.transaction) => Promise<unknown>
    ) => callback(mocks.transaction),
  },
}))
import {
  countUnreadNotices,
  findNotice,
  listNotices,
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
  it("lists legacy visible notices but never a removed notice", async () => {
    const data = {
      title: "Aviso",
      body: "Mensagem",
      link: "",
      sendPush: false,
      eventId: "current",
      createdAt: "2026-10-17T12:00:00.000Z",
    }
    const id = "123e4567-e89b-42d3-a456-426614174000"
    mocks.list.mockResolvedValueOnce({
      docs: [
        { id, data: () => data },
        { id: "deleted", data: () => ({ ...data, deletedAt: new Date() }) },
      ],
    })
    mocks.reads.mockResolvedValueOnce({ docs: [] })
    expect(
      (await listNotices("current", "me")).map((notice) => notice.id)
    ).toEqual([id])
  })
  it("does not expose a removed notice through its direct URL", async () => {
    mocks.find.mockResolvedValueOnce({
      exists: true,
      data: () => ({ eventId: "current", deletedAt: new Date() }),
    })
    expect(await findNotice("current", "notice")).toBeNull()
  })
  it("does not record new reads for removed notices", async () => {
    mocks.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ eventId: "current", deletedAt: new Date() }),
    })
    await expect(markNoticeRead("current", "me", "notice")).rejects.toThrow()
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it("ignores reads of removed notices without hiding a new unread notice", async () => {
    mocks.list.mockResolvedValueOnce({
      docs: [
        { id: "deleted", data: () => ({ deletedAt: new Date() }) },
        { id: "read", data: () => ({}) },
        { id: "unread", data: () => ({ deletedAt: null }) },
      ],
    })
    mocks.reads.mockResolvedValueOnce({
      docs: [{ id: "deleted" }, { id: "read" }],
    })
    expect(await countUnreadNotices("current", "me")).toBe(1)
  })
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
