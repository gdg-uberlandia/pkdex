import { describe, expect, it } from "vitest"

import {
  detectPushDevice,
  getPushDeviceGuidance,
  pushDeviceLabel,
} from "./push-device"

const iphoneSafari =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"
const androidChrome =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36"

describe("notification device guidance", () => {
  it.each([
    [iphoneSafari, "ios", "safari", "phone"],
    [
      iphoneSafari.replace("Version/18.0", "CriOS/130.0"),
      "ios",
      "chrome",
      "phone",
    ],
    [
      iphoneSafari.replace("Version/18.0", "FxiOS/130.0"),
      "ios",
      "firefox",
      "phone",
    ],
    [androidChrome, "android", "chrome", "phone"],
    [
      "Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0",
      "android",
      "firefox",
      "phone",
    ],
    [androidChrome.replace("Mobile ", ""), "android", "chrome", "tablet"],
    [androidChrome + " SamsungBrowser/25.0", "android", "samsung", "phone"],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0",
      "windows",
      "edge",
      "desktop",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Gecko/20100101 Firefox/130.0",
      "windows",
      "firefox",
      "desktop",
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Version/18.0 Safari/605.1.15",
      "macos",
      "safari",
      "desktop",
    ],
    [androidChrome + " Instagram 300", "android", "in-app", "phone"],
    ["", "unknown", "unknown", "unknown"],
  ])("detects %s", (userAgent, os, browser, kind) => {
    expect(detectPushDevice({ userAgent })).toMatchObject({
      os,
      browser,
      kind,
      installed: false,
    })
  })
  it("recognizes an iPad requesting desktop pages", () => {
    expect(
      detectPushDevice({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/18.0 Safari/605.1.15",
        platform: "MacIntel",
        maxTouchPoints: 5,
      })
    ).toMatchObject({ os: "ios", kind: "tablet" })
  })
  it.each([{ standalone: true }, { displayModeStandalone: true }])(
    "does not repeat installation steps for an installed app",
    (signal) => {
      const device = detectPushDevice({ userAgent: iphoneSafari, ...signal })
      expect(device.installed).toBe(true)
      expect(getPushDeviceGuidance(device).steps).toEqual([])
      expect(pushDeviceLabel(device)).toContain("App instalado")
    }
  )
  it("does not show iPhone installation instructions on desktop", () => {
    const device = detectPushDevice({
      userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36",
    })
    expect(getPushDeviceGuidance(device).title).toBe(
      "Notificações no computador"
    )
    expect(getPushDeviceGuidance(device).steps).toEqual([])
  })
  it("distinguishes Chrome and Firefox instructions on Android", () => {
    const chrome = detectPushDevice({ userAgent: androidChrome })
    const firefox = detectPushDevice({
      userAgent: "Mozilla/5.0 (Android 14; Mobile) Firefox/130.0",
    })
    expect(getPushDeviceGuidance(chrome).steps[0]).toContain("Chrome")
    expect(getPushDeviceGuidance(firefox).steps[0]).toContain("Firefox")
  })
  it("provides a Safari path for Firefox on iPhone", () => {
    const device = detectPushDevice({
      userAgent: iphoneSafari.replace("Version/18.0", "FxiOS/130.0"),
    })
    expect(getPushDeviceGuidance(device).steps[0]).toContain("Safari")
  })
  it("explains denied permissions instead of asking to reinstall", () => {
    const device = detectPushDevice({ userAgent: androidChrome })
    expect(getPushDeviceGuidance(device, true).title).toContain("configurações")
  })
})
