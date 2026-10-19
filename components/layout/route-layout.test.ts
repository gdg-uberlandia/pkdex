import { describe, expect, it } from "vitest"

import { getRouteLayout } from "./route-layout"

describe("return destinations", () => {
  it("shows the notification invitation as a full screen step", () => {
    const layout = getRouteLayout("/notifications/enable", null, [
      "participant",
    ])
    expect(layout.showHeader).toBe(false)
    expect(layout.showNavigation).toBe(false)
  })
  it.each([
    "/tags",
    "/missions",
    "/ranking",
    "/tickets",
    "/passport",
    "/companies",
    "/connections",
    "/talks",
    "/schedule",
  ])("returns %s to Home regardless of scan history", (pathname) => {
    expect(getRouteLayout(pathname, null, ["participant"]).backHref).toBe(
      "/home"
    )
  })

  it.each(["reviewer", "admin"] as const)(
    "returns mission operators with role %s to operations",
    (role) => {
      expect(
        getRouteLayout("/missions", null, ["participant", role]).backHref
      ).toBe("/operations")
    }
  )

  it.each([
    ["/missions/review/123", "/missions"],
    ["/operations/scan", "/operations"],
    ["/operations/participant/123", "/operations"],
    ["/operations/talks", "/operations"],
    ["/companies/123", "/companies"],
    ["/connections/123", "/connections"],
    ["/talks/123", "/talks"],
    ["/profile/edit", "/profile"],
  ])("returns %s to its parent %s", (pathname, destination) => {
    expect(getRouteLayout(pathname, null, ["participant"]).backHref).toBe(
      destination
    )
  })

  it.each([
    ["home", "/home"],
    ["missions", "/missions"],
    [null, "/profile"],
    ["https://example.com", "/profile"],
  ])("accepts only known QR origins: %s", (source, destination) => {
    expect(
      getRouteLayout("/profile/qr-code", source, ["participant"]).backHref
    ).toBe(destination)
  })

  it("ignores QR origins on unrelated routes", () => {
    expect(getRouteLayout("/tags", "missions", ["participant"]).backHref).toBe(
      "/home"
    )
  })
})
