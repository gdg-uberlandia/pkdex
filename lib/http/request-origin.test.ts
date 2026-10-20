import { describe, expect, it } from "vitest"

import { isAllowedRequestOrigin } from "./request-origin"

const publicUrl = "https://pokedex.devfesttriangulo.com.br"
const request = (origin?: string) =>
  new Request("http://internal-service:8080/api/notices/subscription", {
    method: "POST",
    headers: origin ? { Origin: origin } : {},
  })

describe("request origin behind a proxy", () => {
  it("accepts the configured public HTTPS origin despite the internal HTTP address", () => {
    expect(isAllowedRequestOrigin(request(publicUrl), publicUrl)).toBe(true)
  })
  it("preserves same-origin requests in the local environment", () => {
    expect(
      isAllowedRequestOrigin(
        new Request("http://localhost:3001/api/notices/subscription", {
          method: "POST",
          headers: { Origin: "http://localhost:3001" },
        }),
        publicUrl
      )
    ).toBe(true)
  })
  it.each([
    undefined,
    "null",
    "https://evil.example",
    "https://pokedex.devfesttriangulo.com.br.evil.example",
    "http://pokedex.devfesttriangulo.com.br",
  ])("rejects untrusted origin %s", (origin) => {
    expect(isAllowedRequestOrigin(request(origin), publicUrl)).toBe(false)
  })
  it("does not trust a forged forwarded host", () => {
    const value = request("https://evil.example")
    value.headers.set("x-forwarded-host", "evil.example")
    value.headers.set("x-forwarded-proto", "https")
    expect(isAllowedRequestOrigin(value, publicUrl)).toBe(false)
  })
})
