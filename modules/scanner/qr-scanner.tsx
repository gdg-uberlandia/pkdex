"use client"

import type { IScannerControls } from "@zxing/browser"
import {
  AlertCircle,
  Camera,
  CameraOff,
  CheckCircle2,
  LoaderCircle,
  ScanLine,
  WifiOff,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { AchievementConfetti } from "@/components/motion/achievement-confetti"
import { Button } from "@/components/ui/button"
import { SCORES } from "@/config/scores"
import { reviewMissionAction } from "@/modules/missions/mission.actions"
import { connectFromScanAction } from "@/modules/networking/connection.actions"
import { parseQrCodeUrl } from "@/modules/qr-code/qr-code.contract"

import {
  classifyCameraError,
  getScannerFeedback,
  mapQrCodeError,
  type ScannerFailure,
} from "./scanner-feedback"
import { awaitScannerRequest } from "./scanner-request"

type ScannerStatus =
  | "idle"
  | "requesting-permission"
  | "scanning"
  | "processing"
  | "failure"
  | "result"

type QrScannerProps = Readonly<{
  appUrl: string
  eventId: string
  mode?:
    | Readonly<{
        type: "mission-review"
        missionId: string
        title: string
      }>
    | Readonly<{
        type: "participant-service"
        title: string
      }>
}>

export function QrScanner({ appUrl, eventId, mode }: QrScannerProps) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const scanSessionRef = useRef(0)
  const isProcessingRef = useRef(false)
  const [status, setStatus] = useState<ScannerStatus>("requesting-permission")
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean
    code?: string
    message?: string
  } | null>(null)
  const [failure, setFailure] = useState<ScannerFailure | null>(null)

  const releaseCamera = useCallback(() => {
    scanSessionRef.current += 1
    controlsRef.current?.stop()
    controlsRef.current = null

    const stream = videoRef.current?.srcObject

    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop())
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const showFailure = useCallback(
    (nextFailure: ScannerFailure) => {
      releaseCamera()
      isProcessingRef.current = true
      setFailure(nextFailure)
      setStatus("failure")
    },
    [releaseCamera]
  )

  const handleDecodedValue = useCallback(
    async (value: string, controls: IScannerControls) => {
      if (isProcessingRef.current) {
        return
      }

      isProcessingRef.current = true
      controls.stop()
      controlsRef.current = null
      scanSessionRef.current += 1
      setStatus("processing")

      const parsedQrCode = parseQrCodeUrl(value, {
        appUrl,
        eventId,
      })

      if (!parsedQrCode.valid) {
        showFailure(mapQrCodeError(parsedQrCode))
        return
      }

      if (!navigator.onLine) {
        showFailure("offline")
        return
      }

      if (
        parsedQrCode.target.type === "company" ||
        parsedQrCode.target.type === "tag" ||
        parsedQrCode.target.type === "mission"
      ) {
        if (mode) {
          showFailure("target-unavailable")
          return
        }

        router.replace(
          `/qr/${encodeURIComponent(parsedQrCode.target.eventId)}/${parsedQrCode.target.type}/${encodeURIComponent(parsedQrCode.target.qrId)}`
        )
        return
      }

      if (parsedQrCode.target.type !== "user") {
        showFailure("target-unavailable")
        return
      }

      try {
        if (mode?.type === "mission-review") {
          const result = await awaitScannerRequest(
            reviewMissionAction({
              eventId: parsedQrCode.target.eventId,
              missionId: mode.missionId,
              participantQrId: parsedQrCode.target.qrId,
              token: parsedQrCode.target.token,
            })
          )
          const query = new URLSearchParams({
            reviewResult: result.code,
          })

          if (result.success) {
            query.set("participant", result.participantName ?? "Participante")
            query.set("mission", result.missionTitle)
            query.set("xp", String(result.xpAwarded))
            if (result.code === "MISSION_COMPLETED") {
              toast.success(`Missão “${result.missionTitle}” validada`, {
                description: `${result.participantName ?? "Participante"} recebeu ${result.xpAwarded} XP.`,
                duration: 5_000,
              })
            } else {
              toast.warning(
                `Missão “${result.missionTitle}” já estava validada`,
                {
                  description: "Nenhum XP adicional foi concedido.",
                  duration: 5_000,
                }
              )
            }
          }

          if (!result.success)
            toast.error("Não foi possível validar a missão", {
              description:
                result.code === "MISSIONS_DISABLED"
                  ? "A organização pausou as conclusões de missões."
                  : "Confira a mensagem na lista de missões e tente novamente.",
              duration: 5_000,
            })

          router.replace(`/missions?${query.toString()}`)
          return
        }

        if (mode?.type === "participant-service") {
          const query = new URLSearchParams({
            token: parsedQrCode.target.token,
          })

          router.replace(
            `/operations/participant/${encodeURIComponent(parsedQrCode.target.qrId)}?${query.toString()}`
          )
          return
        }

        const result = await awaitScannerRequest(
          connectFromScanAction({
            eventId: parsedQrCode.target.eventId,
            targetQrId: parsedQrCode.target.qrId,
            token: parsedQrCode.target.token,
          })
        )
        setConnectionResult(result)
        setStatus("result")
      } catch {
        showFailure(navigator.onLine ? "validation-failed" : "offline")
      }
    },
    [appUrl, eventId, mode, router, showFailure]
  )

  const startScanner = useCallback(async () => {
    releaseCamera()
    setFailure(null)
    setConnectionResult(null)
    isProcessingRef.current = false

    if (!window.isSecureContext) {
      showFailure("insecure-context")
      return
    }

    if (!navigator.onLine) {
      showFailure("offline")
      return
    }

    if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) {
      showFailure("camera-unavailable")
      return
    }

    const scanSession = scanSessionRef.current
    setStatus("requesting-permission")

    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser")
      const codeReader = new BrowserQRCodeReader()
      const controls = await codeReader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: {
              ideal: "environment",
            },
            height: {
              ideal: 720,
            },
            width: {
              ideal: 1280,
            },
          },
        },
        videoRef.current,
        (result, _error, scannerControls) => {
          if (result && scanSession === scanSessionRef.current) {
            void handleDecodedValue(result.getText(), scannerControls)
          }
        }
      )

      if (scanSession !== scanSessionRef.current) {
        controls.stop()
        return
      }

      controlsRef.current = controls
      setStatus("scanning")
    } catch (error) {
      if (scanSession !== scanSessionRef.current) {
        return
      }

      showFailure(classifyCameraError(error))
    }
  }, [handleDecodedValue, releaseCamera, showFailure])

  useEffect(() => {
    const startTimeout = window.setTimeout(() => {
      void startScanner()
    }, 0)

    function handleVisibilityChange() {
      if (isProcessingRef.current) {
        return
      }
      if (document.hidden) {
        releaseCamera()
        isProcessingRef.current = false
        setFailure(null)
        setStatus("idle")
        return
      }

      void startScanner()
    }

    function handleOffline() {
      if (controlsRef.current) {
        showFailure("offline")
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.clearTimeout(startTimeout)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("offline", handleOffline)
      releaseCamera()
    }
  }, [releaseCamera, showFailure, startScanner])

  const feedback = failure ? getScannerFeedback(failure) : null
  const FailureIcon = failure === "offline" ? WifiOff : CameraOff

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background">
      <p className="shrink-0 border-b border-border bg-card px-4 py-2 text-center text-xs text-muted-foreground">
        Antes de escanear, limpe as lentes da câmera para facilitar a leitura.
      </p>
      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          className="size-full object-cover"
          aria-label="Visualização da câmera"
          autoPlay
          muted
          playsInline
        />

        {status === "scanning" && (
          <>
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center px-6 pt-6">
              <span className="rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                {mode ? mode.title : "Scanner do evento"}
              </span>
            </div>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-10">
              <div className="relative aspect-square w-full max-w-72 overflow-hidden rounded-3xl border-2 border-[#8BFF3D] shadow-[0_0_24px_rgb(139_255_61/0.45),0_0_0_999px_rgb(2_6_23/58%)]">
                <span className="absolute inset-x-4 top-1/2 h-px bg-[#8BFF3D] shadow-[0_0_12px_#8BFF3D] motion-safe:animate-pulse" />
                <span className="sr-only">Área de leitura do QR Code</span>
              </div>
            </div>
          </>
        )}

        {status !== "scanning" && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-5 overflow-y-auto bg-background/95 px-6 py-6 text-center"
            aria-live="polite"
          >
            {status === "idle" && (
              <>
                <span className="rounded-full bg-[#8BFF3D]/15 p-4 text-[#3F7800] dark:text-[#AFFF78]">
                  <Camera className="size-8" aria-hidden="true" />
                </span>
                <div className="max-w-sm space-y-2">
                  <h1 className="text-xl font-semibold">
                    {mode
                      ? "Leia o QR Code do participante"
                      : "Leia um QR Code do evento"}
                  </h1>
                  <p className="text-sm leading-6 text-muted-foreground">
                    A câmera será usada somente enquanto esta tela estiver
                    aberta.
                  </p>
                </div>
                <Button type="button" size="lg" onClick={startScanner}>
                  <Camera data-icon="inline-start" aria-hidden="true" />
                  Ativar câmera
                </Button>
              </>
            )}

            {(status === "requesting-permission" ||
              status === "processing") && (
              <>
                <LoaderCircle
                  className="size-9 animate-spin text-[#3F7800] dark:text-[#AFFF78]"
                  aria-hidden="true"
                />
                <div className="space-y-2">
                  <h1 className="text-xl font-semibold">
                    {status === "processing"
                      ? "Validando QR Code"
                      : "Preparando a câmera"}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {status === "processing"
                      ? "Aguarde enquanto verificamos o código."
                      : "Autorize o acesso quando o navegador solicitar."}
                  </p>
                </div>
              </>
            )}

            {status === "result" && connectionResult && (
              <>
                {connectionResult.success &&
                  connectionResult.code === "CONNECTION_CREATED" && (
                    <AchievementConfetti />
                  )}
                {connectionResult.success ? (
                  <CheckCircle2
                    className="size-12 text-success"
                    aria-hidden="true"
                  />
                ) : (
                  <AlertCircle
                    className="size-12 text-destructive"
                    aria-hidden="true"
                  />
                )}
                <div
                  className="max-w-sm space-y-2"
                  role={connectionResult.success ? "status" : "alert"}
                >
                  <h1 className="text-xl font-semibold">
                    {connectionResult.success
                      ? connectionResult.code === "ALREADY_CONNECTED"
                        ? "Vocês já estão conectados"
                        : "Nova conexão registrada!"
                      : connectionResult.code === "QR_EXPIRED"
                        ? "Este QR Code expirou"
                        : "Não foi possível criar a conexão"}
                  </h1>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {connectionResult.success
                      ? connectionResult.code === "ALREADY_CONNECTED"
                        ? "Esta conexão já está na sua lista. Nenhum XP adicional foi concedido."
                        : `Vocês receberam ${SCORES.PARTICIPANT_CONNECTION} XP cada. A conexão já está na sua lista.`
                      : (connectionResult.message ??
                        "Tente ler o código novamente. Repetir a leitura não duplica o XP.")}
                  </p>
                </div>
                <Button type="button" size="lg" onClick={startScanner}>
                  Ler outro QR
                </Button>
                <Button
                  variant="outline"
                  render={<Link href="/connections" replace />}
                  nativeButton={false}
                >
                  Ver conexões
                </Button>
              </>
            )}

            {status === "failure" && feedback && (
              <>
                <span className="rounded-full bg-destructive/10 p-4 text-destructive">
                  {failure === "offline" ? (
                    <WifiOff className="size-8" aria-hidden="true" />
                  ) : failure === "invalid-qr" ||
                    failure === "invalid-origin" ||
                    failure === "invalid-event" ||
                    failure === "unsupported-type" ||
                    failure === "target-unavailable" ? (
                    <AlertCircle className="size-8" aria-hidden="true" />
                  ) : (
                    <FailureIcon className="size-8" aria-hidden="true" />
                  )}
                </span>
                <div className="max-w-sm space-y-2" role="alert">
                  <h1 className="text-xl font-semibold">{feedback.title}</h1>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {feedback.description}
                  </p>
                </div>
                <Button type="button" size="lg" onClick={startScanner}>
                  <ScanLine data-icon="inline-start" aria-hidden="true" />
                  Tentar novamente
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {status === "scanning" && (
        <div
          className="shrink-0 space-y-1 border-t border-border bg-card px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-center"
          aria-live="polite"
        >
          <p className="font-medium">Aponte para o QR Code</p>
          <p className="text-xs text-muted-foreground">
            {mode
              ? `Validando: ${mode.title}`
              : "Mantenha o código dentro da área destacada."}
          </p>
        </div>
      )}
    </div>
  )
}
