import { afterEach, describe, expect, it, vi } from "vitest"

import { isPushEnabled } from "./push-config"

afterEach(() => vi.unstubAllEnvs())
describe("global push switch", () => {
  it("requires explicit activation", () => {
    for (const value of [undefined, "", "false", "1", "yes"]) {
      vi.stubEnv("PUSH_ENABLED", value)
      expect(isPushEnabled()).toBe(false)
    }
    vi.stubEnv("PUSH_ENABLED", " TRUE ")
    expect(isPushEnabled()).toBe(true)
  })
})
