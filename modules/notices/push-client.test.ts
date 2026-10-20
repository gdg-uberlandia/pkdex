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
const getRegistration = vi.fn()
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
      getRegistration,
      ready: Promise.resolve({ pushManager: manager }),
    },
  })
  vi.stubGlobal("fetch", fetchMock)
  register.mockResolvedValue({ pushManager: manager })
  getRegistration.mockResolvedValue({ pushManager: manager })
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
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})
describe("push permission and device state", () => {
  it("explains an expired session instead of treating it as a browser failure", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 })
    await expect(loadPushState()).rejects.toThrow("Sua sessão expirou")
    expect(register).not.toHaveBeenCalled()
  })
  it("handles connection failures with a retryable message", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))
    await expect(loadPushState()).rejects.toThrow("Confira sua conexão")
  })
  it("does not remain loading forever when the configuration request stalls", async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(
      (_url, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new Error("aborted"))
          )
        })
    )
    const result = expect(loadPushState()).rejects.toThrow("demorou")
    await vi.advanceTimersByTimeAsync(15000)
    await result
  })

  it("offers permission even when service-worker readiness never resolves", async () => {
    vi.stubGlobal("navigator", {
      serviceWorker: {
        register,
        getRegistration,
        ready: new Promise(() => {}),
      },
    })
    expect((await loadPushState()).status).toBe("inactive")
    expect(register).not.toHaveBeenCalled()
  })
  it("reports denied permission without registering a worker", async () => {
    vi.stubGlobal("Notification", { permission: "denied", requestPermission })
    expect((await loadPushState()).status).toBe("blocked")
    expect(register).not.toHaveBeenCalled()
  })

  it("checks device state without requesting permission", async () => {
    expect((await loadPushState()).status).toBe("inactive")
    expect(requestPermission).not.toHaveBeenCalled()
    expect(manager.subscribe).not.toHaveBeenCalled()
    expect(register).not.toHaveBeenCalled()
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
