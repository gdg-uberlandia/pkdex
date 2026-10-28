import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  closure: vi.fn(),
  raffles: vi.fn(),
  simulation: vi.fn(),
  simulationRaffles: vi.fn(),
}))
vi.mock("@/env", () => ({ env: { EVENT_ID: "public-event" } }))
vi.mock("./raffle.repository", () => ({
  findRaffleClosureState: mocks.closure,
  findRaffles: mocks.raffles,
}))
vi.mock("./raffle-simulation.repository", () => ({
  findActiveRaffleSimulation: mocks.simulation,
  findSimulationRaffles: mocks.simulationRaffles,
}))

import { getPublicRaffleDisplay } from "./raffle-display.service"

const date = new Date("2026-10-28T12:00:00Z")
const candidate = {
  id: "prize",
  prizeName: "Prêmio",
  status: "awaiting_confirmation",
  currentCandidateName: "Candidata",
  currentCandidateId: "private-person",
  currentAttemptId: "private-attempt",
  winnerName: null,
  drawnAt: null,
  drawnBy: "private-operator",
  eligibleTicketTotal: 1234,
  updatedAt: date,
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.closure.mockResolvedValue({
    status: "closed",
    processedParticipants: 400,
  })
  mocks.raffles.mockResolvedValue([candidate])
  mocks.simulation.mockResolvedValue(null)
})

describe("public raffle display", () => {
  it("loads without a session and uses only the deployed event", async () => {
    const display = await getPublicRaffleDisplay()
    expect(mocks.closure).toHaveBeenCalledWith("public-event")
    expect(mocks.raffles).toHaveBeenCalledWith("public-event")
    expect(mocks.simulation).toHaveBeenCalledWith("public-event")
    expect(display).toEqual({
      eventId: "public-event",
      closure: { status: "closed" },
      simulation: null,
      raffles: [
        {
          id: "prize",
          prizeName: "Prêmio",
          status: "awaiting_confirmation",
          currentCandidateName: "Candidata",
          winnerName: null,
          drawnAt: null,
          revision: date.getTime(),
        },
      ],
    })
    expect(mocks.simulationRaffles).not.toHaveBeenCalled()
  })
  it("exposes only confirmed winners and hides stale names on pending prizes", async () => {
    mocks.raffles.mockResolvedValue([
      {
        ...candidate,
        status: "pending",
        winnerName: "Stale winner",
        drawnAt: date,
      },
      {
        ...candidate,
        id: "confirmed",
        status: "drawn",
        winnerName: "Vencedora",
        drawnAt: date,
      },
    ])
    const { raffles } = await getPublicRaffleDisplay()
    expect(raffles[0]).toMatchObject({
      currentCandidateName: null,
      winnerName: null,
      drawnAt: null,
    })
    expect(raffles[1]).toMatchObject({
      currentCandidateName: null,
      winnerName: "Vencedora",
      drawnAt: date,
    })
  })
  it("preserves the simulation presentation without exposing its administrative data", async () => {
    mocks.simulation.mockResolvedValue({
      id: "simulation",
      status: "ready",
      createdBy: "private-admin",
      processedParticipants: 400,
    })
    mocks.simulationRaffles.mockResolvedValue([candidate])
    const display = await getPublicRaffleDisplay()
    expect(mocks.simulationRaffles).toHaveBeenCalledWith("simulation")
    expect(display.simulation).toEqual({
      status: "ready",
      raffles: display.raffles,
    })
    expect(JSON.stringify(display)).not.toContain("private-")
    expect(JSON.stringify(display)).not.toContain("eligibleTicketTotal")
    expect(JSON.stringify(display)).not.toContain("processedParticipants")
  })
})
