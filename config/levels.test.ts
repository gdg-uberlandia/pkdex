import { describe, expect, it } from "vitest"

import {
  createLevels,
  formatLevelLabel,
  getLevelForXp,
  getNextLevel,
} from "./levels"

describe("event levels", () => {
  it.each([75, 4000, 7385, 12000])(
    "normalizes growing level costs to %i XP",
    (maximum) => {
      const levels = createLevels(maximum)
      expect(levels).toHaveLength(10)
      expect(levels[0].minimumXp).toBe(0)
      expect(levels.at(-1)!.minimumXp).toBe(maximum)
      const gaps = levels
        .slice(1)
        .map((level, index) => level.minimumXp - levels[index].minimumXp)
      for (let i = 1; i < gaps.length; i++)
        expect(gaps[i]).toBeGreaterThan(gaps[i - 1])
      for (const level of levels)
        expect(getLevelForXp(level.minimumXp, levels).number).toBe(level.number)
    }
  )
  it("keeps bonuses above the finite budget at the maximum level", () => {
    const levels = createLevels(7385)
    expect(getLevelForXp(9000, levels).number).toBe(10)
    expect(getNextLevel(levels.at(-1)!, levels)).toBeNull()
    expect(formatLevelLabel(levels[4])).toBe("Nível 5 · Guardião dos Logs")
    expect(getNextLevel(levels[4], levels)?.number).toBe(6)
  })
  it("handles an empty or tiny budget without duplicate thresholds", () => {
    expect(createLevels(0)).toHaveLength(1)
    expect(new Set(createLevels(5).map((level) => level.minimumXp)).size).toBe(
      createLevels(5).length
    )
  })
})
