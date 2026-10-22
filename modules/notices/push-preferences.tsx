"use client"

import { useEffect, useRef } from "react"

import { Button } from "@/components/ui/button"

import { PushDeviceGuidance } from "./push-device-guidance"
import { usePushNotifications } from "./use-push-notifications"

export function PushPreferences() {
  const push = usePushNotifications()
  const section = useRef<HTMLElement>(null)
  useEffect(() => {
    if (push.status === "loading") return
    let frame = 0
    function scrollToSettings() {
      if (window.location.hash !== "#notifications") return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const target = section.current
        const container = target?.closest<HTMLElement>("#main-content")
        if (!target || !container) return
        const margin =
          Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0
        container.scrollTo({
          top: Math.max(
            0,
            container.scrollTop +
              target.getBoundingClientRect().top -
              container.getBoundingClientRect().top -
              margin
          ),
          behavior: "instant",
        })
      })
    }
    scrollToSettings()
    window.addEventListener("hashchange", scrollToSettings)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("hashchange", scrollToSettings)
    }
  }, [push.status])
  return (
    <section
      ref={section}
      id="notifications"
      className="scroll-mt-6 space-y-3 rounded-2xl border p-4"
      aria-labelledby="notification-preferences-title"
    >
      <h2 id="notification-preferences-title" className="font-semibold">
        Notificações
      </h2>
      <p role="status" className="text-sm text-muted-foreground">
        {push.message}
      </p>
      <PushDeviceGuidance
        status={push.status}
        hasPublicKey={Boolean(push.publicKey)}
      />
      {(push.canEnable || push.status === "active") && (
        <Button
          className="w-full"
          variant="outline"
          disabled={push.busy}
          onClick={() =>
            void (push.status === "active" ? push.disable() : push.enable())
          }
        >
          {push.busy
            ? "Aguarde…"
            : push.status === "active"
              ? "Desativar push neste dispositivo"
              : "Ativar notificações"}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        Esta preferência vale apenas para este dispositivo. Todos os avisos
        continuam disponíveis na Pokedex.
      </p>
    </section>
  )
}
