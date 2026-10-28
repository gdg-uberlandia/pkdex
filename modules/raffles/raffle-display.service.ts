import "server-only"

import { env } from "@/env"

import { findRaffleClosureState, findRaffles } from "./raffle.repository"
import type { Raffle } from "./raffle.schema"
import {
  findActiveRaffleSimulation,
  findSimulationRaffles,
} from "./raffle-simulation.repository"

function toDisplayRaffle(raffle: Raffle) {
  return {
    id: raffle.id,
    prizeName: raffle.prizeName,
    status: raffle.status,
    currentCandidateName:
      raffle.status === "awaiting_confirmation"
        ? raffle.currentCandidateName
        : null,
    winnerName: raffle.status === "drawn" ? raffle.winnerName : null,
    drawnAt: raffle.status === "drawn" ? raffle.drawnAt : null,
    revision: raffle.updatedAt.getTime(),
  }
}

/** Public read-only presentation, always scoped to the deployed event. */
export async function getPublicRaffleDisplay() {
  const eventId = env.EVENT_ID
  const [closure, raffles, simulation] = await Promise.all([
    findRaffleClosureState(eventId),
    findRaffles(eventId),
    findActiveRaffleSimulation(eventId),
  ])

  return {
    eventId,
    closure: { status: closure.status },
    raffles: raffles.map(toDisplayRaffle),
    simulation: simulation
      ? {
          status: simulation.status,
          raffles: (await findSimulationRaffles(simulation.id)).map(
            toDisplayRaffle
          ),
        }
      : null,
  }
}
