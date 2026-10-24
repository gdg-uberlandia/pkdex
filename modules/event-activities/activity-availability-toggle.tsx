"use client"
import { LoaderCircle, LockKeyhole, UnlockKeyhole } from "lucide-react"
import { useActionState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

import { toggleActivityAvailabilityAction } from "./activity-availability.actions"
import type { ActivityService } from "./activity-availability.schema"

export function ActivityAvailabilityToggle({
  service,
  enabled,
}: {
  service: ActivityService
  enabled: boolean
}) {
  const [, action, pending] = useActionState(
    async (_state: null, formData: FormData) => {
      try {
        await toggleActivityAvailabilityAction(formData)
      } catch {
        toast.error(
          `Não foi possível alterar ${service === "tags" ? "as tags" : "as missões"}. Tente novamente.`
        )
      }
      return null
    },
    null
  )
  const label = `${enabled ? "Bloquear" : "Liberar"} ${service === "tags" ? "tags" : "missões"}`
  return (
    <form action={action}>
      <input type="hidden" name="service" value={service} />
      <input type="hidden" name="enabled" value={String(!enabled)} />
      <Button
        type="submit"
        size="icon"
        variant={enabled ? "destructive" : "outline"}
        disabled={pending}
        aria-label={label}
      >
        {pending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : enabled ? (
          <LockKeyhole aria-hidden="true" />
        ) : (
          <UnlockKeyhole aria-hidden="true" />
        )}
      </Button>
    </form>
  )
}
