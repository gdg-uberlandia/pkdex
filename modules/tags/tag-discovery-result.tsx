"use client"

import { useEffect, useRef, useState } from "react"

import { ActivityRevealCard } from "@/modules/qr-code/activity-reveal-card"
import { QrResult } from "@/modules/qr-code/qr-result"

import { discoverTagAction, type DiscoverTagActionResult } from "./tag.actions"

type TagDiscoveryState =
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "complete"; result: DiscoverTagActionResult }>

const TAG_DISCOVERY_TIMEOUT_MS = 15_000

const tagDiscoveryErrorMessages: Record<
  Extract<DiscoverTagActionResult, { success: false }>["code"],
  Readonly<{ title: string; description: string }>
> = {
  INVALID_EVENT: {
    title: "QR Code de outro evento",
    description: "Este código não pertence à edição atual do evento.",
  },
  INVALID_INPUT: {
    title: "QR Code inválido",
    description: "Não foi possível reconhecer os dados deste código.",
  },
  PROFILE_INCOMPLETE: {
    title: "Complete seu perfil",
    description: "Finalize seu perfil antes de encontrar tags e receber XP.",
  },
  TAGS_DISABLED: {
    title: "Tags temporariamente bloqueadas",
    description:
      "A organização pausou novas descobertas de tags. Tente novamente quando forem liberadas.",
  },
  TAG_INACTIVE: {
    title: "Tag indisponível",
    description: "Esta tag não pode ser descoberta neste momento.",
  },
  TAG_NOT_FOUND: {
    title: "Tag não encontrada",
    description: "Este QR Code não está associado a uma tag do evento.",
  },
  UNEXPECTED_ERROR: {
    title: "Não foi possível registrar a tag",
    description: "Tente novamente. Sua pontuação não será duplicada.",
  },
}

export function TagDiscoveryResult({
  eventId,
  qrId,
}: Readonly<{ eventId: string; qrId: string }>) {
  const requestRef = useRef<Promise<DiscoverTagActionResult> | null>(null)
  const [state, setState] = useState<TagDiscoveryState>({
    status: "loading",
  })

  useEffect(() => {
    let active = true
    requestRef.current ??= discoverTagAction({ eventId, qrId })

    const timeoutId = window.setTimeout(() => {
      if (active) {
        setState({
          status: "complete",
          result: { success: false, code: "UNEXPECTED_ERROR" },
        })
      }
    }, TAG_DISCOVERY_TIMEOUT_MS)

    void requestRef.current
      .then((result) => {
        if (active) {
          setState({ status: "complete", result })
        }
      })
      .catch(() => {
        if (active) {
          setState({
            status: "complete",
            result: { success: false, code: "UNEXPECTED_ERROR" },
          })
        }
      })
      .finally(() => {
        window.clearTimeout(timeoutId)
      })

    return () => {
      active = false
      window.clearTimeout(timeoutId)
    }
  }, [eventId, qrId])

  if (state.status === "loading") {
    return (
      <QrResult
        appearance="reveal"
        status="loading"
        title="Revelando a tag"
        description="Aguarde enquanto verificamos sua descoberta e pontuação."
      />
    )
  }

  if (!state.result.success) {
    const feedback = tagDiscoveryErrorMessages[state.result.code]

    return (
      <QrResult
        appearance="reveal"
        status="error"
        actionHref="/scan"
        actionLabel="Ler QR novamente"
        secondaryActionHref="/tags"
        secondaryActionLabel="Ver coleção"
        title={feedback.title}
        description={feedback.description}
      />
    )
  }

  const alreadyDiscovered = state.result.code === "TAG_ALREADY_DISCOVERED"

  return (
    <ActivityRevealCard
      kind="tag"
      title={state.result.tagName}
      description={state.result.tagDescription}
      imageUrl={state.result.imageUrl}
      xpAwarded={state.result.xpAwarded}
      repeated={alreadyDiscovered}
      href="/tags"
      actionLabel="Ver coleção"
    />
  )
}
