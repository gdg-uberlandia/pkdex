const LEVEL_TITLES = [
  "Newbie",
  "Aprendiz do Terminal",
  "Caçador de Bugs",
  "Alquimista do Código",
  "Guardião dos Logs",
  "Feiticeiro do Runtime",
  "Invocador de Builds",
  "Lenda do Commit",
  "Arquimago Digital",
  "Mestre do Endgame",
] as const

export type Level = Readonly<{
  number: number
  title: string
  minimumXp: number
}>

/** Increasing XP costs, normalized to the event's finite activity budget. */
export function createLevels(maximumXp: number): readonly Level[] {
  const maximum = Number.isFinite(maximumXp)
    ? Math.max(0, Math.floor(maximumXp))
    : 0
  const count = Math.min(
    LEVEL_TITLES.length,
    Math.floor((1 + Math.sqrt(1 + 8 * maximum)) / 2)
  )
  if (count < 2) return [{ number: 1, title: LEVEL_TITLES[0], minimumXp: 0 }]
  const steps = count - 1
  const baseCost = (steps * (steps + 1)) / 2
  const remaining = maximum - baseCost
  const weights = Array.from({ length: steps }, (_, index) => 2 ** (index / 2))
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  const costs = weights.map(
    (weight, index) =>
      index + 1 + Math.floor((remaining * weight) / totalWeight)
  )
  const remainder = maximum - costs.reduce((sum, cost) => sum + cost, 0)
  for (let index = costs.length - remainder; index < costs.length; index++)
    costs[index]++
  let threshold = 0
  return Array.from({ length: count }, (_, index) => {
    if (index > 0) threshold += costs[index - 1]
    return {
      number: index + 1,
      title: LEVEL_TITLES[index],
      minimumXp: threshold,
    }
  })
}

export function getLevelForXp(xp: number, levels: readonly Level[]): Level {
  const normalizedXp = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0
  for (let index = levels.length - 1; index >= 0; index--) {
    if (normalizedXp >= levels[index].minimumXp) return levels[index]
  }
  return levels[0] ?? { number: 1, title: LEVEL_TITLES[0], minimumXp: 0 }
}

export function getNextLevel(
  level: Level,
  levels: readonly Level[]
): Level | null {
  return (
    levels.find((candidate) => candidate.number === level.number + 1) ?? null
  )
}

export function formatLevelLabel(level: Level) {
  return `Nível ${level.number} · ${level.title}`
}
