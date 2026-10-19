import type { ScheduleEntry, ScheduleTrack } from "./schedule.schema"

export const TRACK_LABELS: Record<ScheduleTrack, string> = {
  MINAS: "Minas",
  CURADO: "Curado",
  CANASTRA: "Canastra",
  TRANCA: "Trança",
  COMUNIDADE: "Arena Comunidade 1",
  COMUNIDADE_2: "Arena Comunidade 2",
  LOUNGE_SENIOR: "Lounge Sênior",
}

export const ACTIVITY_LABELS = {
  break: "Intervalo",
  talk: "Palestra",
  opening: "Abertura",
  opening_keynote: "Keynote de abertura",
  closing: "Encerramento",
  closing_keynote: "Keynote de encerramento",
} as const

export function formatScheduleTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Sao_Paulo",
  }).format(date)
}

export function formatScheduleInterval(startAt: Date, endAt: Date) {
  return `${formatScheduleTime(startAt)}–${formatScheduleTime(endAt)}`
}

export function formatScheduleLocation(
  track: ScheduleTrack | null,
  activityType: Exclude<ScheduleEntry["activity"]["type"], "break">
) {
  return track ? `Trilha ${TRACK_LABELS[track]}` : ACTIVITY_LABELS[activityType]
}
