import { Tags, Target } from "lucide-react"

import { cn } from "@/lib/utils"

import type { ActivityAvailability } from "./activity-availability.schema"
import { ActivityAvailabilityToggle } from "./activity-availability-toggle"

export function ActivityAvailabilityControls({
  availability,
}: {
  availability: ActivityAvailability
}) {
  return (
    <section className="space-y-3" aria-labelledby="activity-controls-title">
      <h2 id="activity-controls-title" className="text-lg font-semibold">
        Atividades do evento
      </h2>
      <p className="text-sm text-muted-foreground">
        Pause novas descobertas e conclusões para todo o evento. As conquistas
        já registradas são mantidas.
      </p>
      <div className="divide-y divide-border overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
        {(
          [
            {
              service: "tags",
              label: "Tags",
              enabled: availability.tagsEnabled,
              icon: Tags,
            },
            {
              service: "missions",
              label: "Missões",
              enabled: availability.missionsEnabled,
              icon: Target,
            },
          ] as const
        ).map(({ service, label, enabled, icon: Icon }) => (
          <div key={service} className="flex items-center gap-3 p-4">
            <span
              className={cn(
                "flex size-11 items-center justify-center rounded-xl",
                enabled
                  ? "bg-success/10 text-success"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Icon className="size-6" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{label}</p>
              <p className="text-sm text-muted-foreground">
                {label} {enabled ? "liberadas" : "bloqueadas"}
              </p>
            </div>
            <ActivityAvailabilityToggle service={service} enabled={enabled} />
          </div>
        ))}
      </div>
    </section>
  )
}
