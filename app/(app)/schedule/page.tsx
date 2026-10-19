import { CalendarDays, Clock3, UsersRound } from "lucide-react"
import type { Metadata } from "next"

import { EmptyState } from "@/components/layout/empty-state"
import { requireAuth } from "@/lib/require-auth"
import { cn } from "@/lib/utils"
import {
  listScheduleForSession,
  type ScheduleItem,
} from "@/modules/schedule/schedule.service"
import {
  ACTIVITY_LABELS,
  formatScheduleInterval,
  TRACK_LABELS,
} from "@/modules/schedule/schedule-format"
import { TRACK_COLORS } from "@/modules/schedule/schedule-presentation"

export const metadata: Metadata = { title: "Programação" }
export const dynamic = "force-dynamic"

export default async function SchedulePage() {
  const session = await requireAuth()
  const schedule = await listScheduleForSession(session)
  if (schedule.length === 0)
    return (
      <EmptyState
        icon={<CalendarDays className="size-8" aria-hidden="true" />}
        title="Programação em breve"
        description="A programação do evento aparecerá aqui quando for publicada."
      />
    )
  const slots = new Map<string, ScheduleItem[]>()
  for (const item of schedule) {
    const key = `${item.startAt.toISOString()}-${item.endAt.toISOString()}`
    slots.set(key, [...(slots.get(key) ?? []), item])
  }
  const date = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    timeZone: "America/Sao_Paulo",
  })
  return (
    <div className="space-y-7 p-4 pb-8 sm:p-6">
      <h1 className="sr-only">Programação do evento</h1>
      <p className="text-sm text-muted-foreground">
        Confira os horários, trilhas e conteúdos do DevFest Triângulo.
      </p>
      {Array.from(slots, ([key, items]) => (
        <section
          key={key}
          aria-labelledby={`slot-${items[0].id}`}
          className="space-y-3"
        >
          <h2
            id={`slot-${items[0].id}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base font-bold"
          >
            <span className="inline-flex items-center gap-2">
              <Clock3
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              {formatScheduleInterval(items[0].startAt, items[0].endAt)}
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              {date.format(items[0].startAt)}
            </span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <article
                key={item.id}
                className={cn(
                  "min-w-0 rounded-2xl border bg-card p-4 shadow-sm",
                  item.track
                    ? TRACK_COLORS[item.track].card
                    : "border-border sm:col-span-2"
                )}
              >
                <span
                  className={cn(
                    "inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase",
                    item.track
                      ? TRACK_COLORS[item.track].badge
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {item.track
                    ? TRACK_LABELS[item.track]
                    : ACTIVITY_LABELS[item.activity.type]}
                </span>
                <h3 className="mt-3 text-base leading-snug font-bold break-words">
                  {item.title}
                </h3>
                {item.description && (
                  <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                    {item.description}
                  </p>
                )}
                {item.speakerNames.length > 0 && (
                  <p className="mt-3 flex items-start gap-2 text-sm">
                    <UsersRound
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span>{item.speakerNames.join(" · ")}</span>
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
