"use client"

import { Monitor, Smartphone } from "lucide-react"
import { useEffect, useId, useState } from "react"

import type { PushStatus } from "./push-client"
import {
  detectPushDevice,
  getPushDeviceGuidance,
  type PushDevice,
  pushDeviceLabel,
} from "./push-device"

export function PushDeviceGuidance({
  status,
  hasPublicKey,
}: {
  status: PushStatus
  hasPublicKey: boolean
}) {
  const [device, setDevice] = useState<PushDevice | null>(null)
  const heading = useId()
  useEffect(() => {
    const modes = ["standalone", "minimal-ui"].map((mode) =>
      window.matchMedia(`(display-mode: ${mode})`)
    )
    const refresh = () =>
      setDevice(
        detectPushDevice({
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          maxTouchPoints: navigator.maxTouchPoints,
          standalone: (navigator as Navigator & { standalone?: boolean })
            .standalone,
          displayModeStandalone: modes.some((mode) => mode.matches),
        })
      )
    refresh()
    modes.forEach((mode) => mode.addEventListener("change", refresh))
    window.addEventListener("appinstalled", refresh)
    return () => {
      modes.forEach((mode) => mode.removeEventListener("change", refresh))
      window.removeEventListener("appinstalled", refresh)
    }
  }, [])
  if (!device) return null
  const Icon = device.kind === "desktop" ? Monitor : Smartphone
  const guidance = getPushDeviceGuidance(device, status === "blocked")
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {pushDeviceLabel(device)}
      </p>
      {hasPublicKey && status !== "active" && status !== "loading" && (
        <aside
          className="space-y-3 rounded-xl bg-muted p-4"
          aria-labelledby={heading}
        >
          <h3 id={heading} className="text-sm font-semibold">
            {guidance.title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {guidance.description}
          </p>
          {guidance.steps.length > 0 && (
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              {guidance.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}
          {guidance.helpUrl && (
            <a
              href={guidance.helpUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-sm font-medium text-primary underline underline-offset-4"
            >
              Ver orientação oficial
            </a>
          )}
        </aside>
      )}
    </div>
  )
}
