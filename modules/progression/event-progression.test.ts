import { describe, expect, it } from "vitest"

import { SCORES } from "@/config/scores"

import { calculateEventXpBudget } from "./event-progression"

describe("event XP budget", () => {
  it("sums each available activity once, honoring overrides and excluding networking", () => {
    const result = calculateEventXpBudget({
      companies: [
        { active: true, xpAwarded: 150 },
        { active: true, xpAwarded: null },
        { active: false, xpAwarded: 9999 },
      ],
      missions: [{ active: true, xpAwarded: 100 }],
      tags: [{ active: true, xpAwarded: null }],
      talks: [{ isActive: true }, { isActive: false }],
    })
    expect(result.maximumXp).toBe(75 + 150 + 50 + 100 + 75 + 75)
    expect(result.breakdown).not.toHaveProperty("connections")
    expect(SCORES.PARTICIPANT_CONNECTION).toBe(5)
  })
})
