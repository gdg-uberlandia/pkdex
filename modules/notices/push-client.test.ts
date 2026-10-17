import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  disablePushNotifications,
  enablePushNotifications,
  loadPushState,
} from "./push-client"

const publicKey = "a".repeat(87)
const subscription = {
  endpoint: "https://fcm.googleapis.com/test",
  toJSON: () => ({ keys: { p256dh: "key", auth: "auth" } }),
  unsubscribe: vi.fn(),
}
const manager = { getSubscription: vi.fn(), subscribe: vi.fn() }
const register = vi.fn()
const requestPermission = vi.fn()
const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubGlobal("window", {
    isSecureContext: true,
    Notification: {},
    PushManager: {},
  })
  vi.stubGlobal("Notification", { permission: "default", requestPermission })
  vi.stubGlobal("navigator", {
    serviceWorker: {
      register,
      ready: Promise.resolve({ pushManager: manager }),
    },
  })
  vi.stubGlobal("fetch", fetchMock)
  register.mockResolvedValue({ pushManager: manager })
  manager.getSubscription.mockResolvedValue(null)
  manager.subscribe.mockResolvedValue(subscription)
  subscription.unsubscribe.mockResolvedValue(true)
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ enabled: true, publicKey }),
  })
  requestPermission.mockResolvedValue("granted")
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})
describe("push permission and device state", () => {
  it("checks device state without requesting permission", async () => {
    expect((await loadPushState()).status).toBe("inactive")
    expect(requestPermission).not.toHaveBeenCalled()
    expect(manager.subscribe).not.toHaveBeenCalled()
  })
  it("does not register a worker when globally disabled", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: false, publicKey: null }),
    })
    expect((await loadPushState()).status).toBe("unavailable")
    expect(register).not.toHaveBeenCalled()
  })
  it("requests permission before asynchronous browser registration, then saves the device", async () => {
    expect((await enablePushNotifications(publicKey)).status).toBe("active")
    expect(requestPermission.mock.invocationCallOrder[0]).toBeLessThan(
      register.mock.invocationCallOrder[0]
    )
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notices/subscription",
      expect.objectContaining({ method: "POST" })
    )
  })
  it("does not subscribe after permission is denied or dismissed", async () => {
    requestPermission
      .mockResolvedValueOnce("denied")
      .mockResolvedValueOnce("default")
    expect((await enablePushNotifications(publicKey)).status).toBe("blocked")
    expect((await enablePushNotifications(publicKey)).status).toBe("inactive")
    expect(manager.subscribe).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("does not report activation when saving to the server fails", async () => {
    fetchMock.mockResolvedValue({ ok: false })
    await expect(enablePushNotifications(publicKey)).rejects.toThrow("salvar")
  })
  it("recognizes and synchronizes an existing granted subscription", async () => {
    vi.stubGlobal("Notification", { permission: "granted", requestPermission })
    manager.getSubscription.mockResolvedValue(subscription)
    expect((await loadPushState()).status).toBe("active")
    expect(requestPermission).not.toHaveBeenCalled()
  })
  it("removes the server subscription before unsubscribing the browser", async () => {
    manager.getSubscription.mockResolvedValue(subscription)
    expect((await disablePushNotifications(publicKey)).status).toBe("inactive")
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notices/subscription",
      expect.objectContaining({ method: "DELETE" })
    )
    expect(fetchMock.mock.invocationCallOrder[0]).toBeLessThan(
      subscription.unsubscribe.mock.invocationCallOrder[0]
    )
  })
})
