import type { ScheduleTrack } from "./schedule.schema"

export const TRACK_COLORS = {
  MINAS: {
    card: "border-amber-400/60",
    badge: "bg-amber-400/15 text-amber-800 dark:text-amber-300",
  },
  CURADO: {
    card: "border-red-400/60",
    badge: "bg-red-400/15 text-red-800 dark:text-red-300",
  },
  CANASTRA: {
    card: "border-pink-400/60",
    badge: "bg-pink-400/15 text-pink-800 dark:text-pink-300",
  },
  TRANCA: {
    card: "border-blue-400/60",
    badge: "bg-blue-400/15 text-blue-800 dark:text-blue-300",
  },
  COMUNIDADE: {
    card: "border-emerald-400/60",
    badge: "bg-emerald-400/15 text-emerald-800 dark:text-emerald-300",
  },
  COMUNIDADE_2: {
    card: "border-teal-400/60",
    badge: "bg-teal-400/15 text-teal-800 dark:text-teal-300",
  },
  LOUNGE_SENIOR: {
    card: "border-violet-400/60",
    badge: "bg-violet-400/15 text-violet-800 dark:text-violet-300",
  },
} satisfies Record<ScheduleTrack, { card: string; badge: string }>
