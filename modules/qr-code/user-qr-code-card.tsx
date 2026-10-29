"use client"

import { RefreshCw } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { QR_CODE_CONFIG } from "@/config/qr-code"

import type { UserQrCode } from "./user-qr-code.service"

const MAX_SAFE_TIMEOUT_MS = 2_147_000_000

function isUserQrCodeResponse(value: unknown): value is UserQrCode {
  if (!value || typeof value !== "object") {
    return false
  }

  return (
    "value" in value &&
    typeof value.value === "string" &&
    "svg" in value &&
    typeof value.svg === "string" &&
    "expiresAt" in value &&
    typeof value.expiresAt === "string"
  )
}

function formatRemainingTime(totalSeconds: number) {
  if (totalSeconds < 60) {
    return `${totalSeconds} ${totalSeconds === 1 ? "segundo" : "segundos"}`
  }

  const totalMinutes = Math.ceil(totalSeconds / 60)

  if (totalMinutes < 60) {
    return `${totalMinutes} ${totalMinutes === 1 ? "minuto" : "minutos"}`
  }

  const totalHours = Math.ceil(totalMinutes / 60)

  if (totalHours < 48) {
    return `${totalHours} ${totalHours === 1 ? "hora" : "horas"}`
  }

  const totalDays = Math.ceil(totalHours / 24)

  return `${totalDays} dias`
}

export function UserQrCodeCard({
  initialQrCode,
}: Readonly<{ initialQrCode: UserQrCode }>) {
  const [qrCode, setQrCode] = useState<UserQrCode>(initialQrCode)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    QR_CODE_CONFIG.USER_TOKEN_DURATION_SECONDS
  )
  const [validitySeconds, setValiditySeconds] = useState<number>(
    QR_CODE_CONFIG.USER_TOKEN_DURATION_SECONDS
  )

  const loadQrCode = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/profile/qr-code", {
        cache: "no-store",
        signal,
      })
      const body: unknown = await response.json()

      if (!response.ok || !isUserQrCodeResponse(body)) {
        throw new Error("Invalid QR Code response")
      }

      setQrCode(body)
      const nextRemainingSeconds = Math.max(
        0,
        Math.ceil((new Date(body.expiresAt).getTime() - Date.now()) / 1_000)
      )
      setRemainingSeconds(nextRemainingSeconds)
      setValiditySeconds(Math.max(1, nextRemainingSeconds))
    } catch (loadError) {
      if (
        loadError instanceof DOMException &&
        loadError.name === "AbortError"
      ) {
        return
      }

      setError("Não foi possível gerar seu QR Code. Tente novamente.")
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    const expiresAt = new Date(qrCode.expiresAt).getTime()
    let refreshTimeout: number | undefined
    const updateCountdown = () => {
      setRemainingSeconds(
        Math.max(0, Math.ceil((expiresAt - Date.now()) / 1_000))
      )
    }
    updateCountdown()
    const countdownInterval = window.setInterval(updateCountdown, 1_000)

    function scheduleRefresh() {
      const refreshDelay =
        expiresAt -
        Date.now() -
        QR_CODE_CONFIG.USER_TOKEN_REFRESH_LEAD_SECONDS * 1_000

      if (refreshDelay <= 0) {
        void loadQrCode()
        return
      }

      refreshTimeout = window.setTimeout(
        scheduleRefresh,
        Math.min(refreshDelay, MAX_SAFE_TIMEOUT_MS)
      )
    }

    scheduleRefresh()

    return () => {
      window.clearInterval(countdownInterval)
      if (refreshTimeout !== undefined) {
        window.clearTimeout(refreshTimeout)
      }
    }
  }, [loadQrCode, qrCode])

  if (error) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
        <Button type="button" onClick={() => void loadQrCode()}>
          <RefreshCw data-icon="inline-start" aria-hidden="true" />
          Tentar novamente
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4 text-center text-white">
      <div className="-mx-9">
        <div
          className="relative z-10 aspect-square w-full overflow-hidden rounded-2xl bg-white shadow-[0_16px_48px_rgb(0_0_0/0.45)] ring-4 ring-white/15"
          aria-label="QR Code temporário do participante"
        >
          <div
            className="absolute inset-0 leading-none [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qrCode.svg }}
          />
        </div>
      </div>

      <div aria-live="polite">
        <p className="text-sm font-medium">
          Código válido por {formatRemainingTime(remainingSeconds)}
        </p>
        <div
          className="mx-auto mt-2 h-1.5 max-w-56 overflow-hidden rounded-full bg-white/15"
          role="progressbar"
          aria-label="Tempo restante do QR Code"
          aria-valuemin={0}
          aria-valuemax={validitySeconds}
          aria-valuenow={remainingSeconds}
        >
          <div
            className="h-full rounded-full bg-[#8BFF3D] transition-[width] duration-1000 motion-reduce:transition-none"
            style={{
              width: `${Math.min(100, (remainingSeconds / validitySeconds) * 100)}%`,
            }}
          />
        </div>
        <p className="mt-2 text-xs text-white/65">
          O código é renovado automaticamente antes de expirar.
        </p>
      </div>

      <Button
        type="button"
        variant="secondary"
        disabled={isLoading}
        onClick={() => void loadQrCode()}
      >
        <RefreshCw
          data-icon="inline-start"
          className={isLoading ? "animate-spin" : undefined}
          aria-hidden="true"
        />
        Renovar agora
      </Button>
    </div>
  )
}
