"use client"

import { useEffect, useRef, useState } from "react"

import { ActivityRevealCard } from "@/modules/qr-code/activity-reveal-card"
import { QrResult } from "@/modules/qr-code/qr-result"

import {
  completeQrMissionAction,
  type MissionActionResult,
} from "./mission.actions"

type State =
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "complete"; result: MissionActionResult }>

const MISSION_COMPLETION_TIMEOUT_MS = 15_000

const errors: Record<
  Extract<MissionActionResult, { success: false }>["code"],
  Readonly<{ title: string; description: string }>
> = {
  QUIZ_NOT_PASSED: {
    title: "Tente novamente",
    description: "Você ainda não atingiu o mínimo de acertos.",
  },
  INVALID_ANSWERS: {
    title: "Respostas inválidas",
    description: "Responda todas as perguntas.",
  },
  QUIZ_CHANGED: {
    title: "Quiz atualizado",
    description: "Atualize a página para responder às perguntas atuais.",
  },
  INCORRECT_ANSWER: {
    title: "Resposta incorreta",
    description: "Confira a palavra-chave e tente novamente.",
  },
  ATTEMPTS_EXHAUSTED: {
    title: "Tentativas esgotadas",
    description: "Você atingiu o limite de tentativas desta missão.",
  },
  FORBIDDEN: {
    title: "Ação não permitida",
    description: "Esta conta não pode concluir atividades de participante.",
  },
  INVALID_EVENT: {
    title: "QR Code de outro evento",
    description: "Este código não pertence à edição atual.",
  },
  INVALID_INPUT: {
    title: "QR Code inválido",
    description: "Não foi possível reconhecer os dados deste código.",
  },
  INVALID_QR: {
    title: "QR Code inválido",
    description: "Não foi possível validar este código.",
  },
  MISSIONS_DISABLED: {
    title: "Missões temporariamente bloqueadas",
    description:
      "A organização pausou as conclusões de missões. Tente novamente quando forem liberadas.",
  },
  MISSION_INACTIVE: {
    title: "Missão indisponível",
    description: "Esta missão não pode ser concluída neste momento.",
  },
  MISSION_NOT_FOUND: {
    title: "Missão não encontrada",
    description: "Este código não está associado a uma missão.",
  },
  PREREQUISITE_MISSING: {
    title: "Missão bloqueada",
    description: "Conclua os pré-requisitos antes de realizar esta missão.",
  },
  PROFILE_UNAVAILABLE: {
    title: "Complete seu perfil",
    description: "Finalize a configuração antes de concluir missões.",
  },
  QR_EXPIRED: {
    title: "QR Code expirado",
    description: "Atualize o código e tente novamente.",
  },
  WRONG_VALIDATION_TYPE: {
    title: "Validação presencial necessária",
    description: "Esta missão precisa ser validada por um reviewer.",
  },
  UNEXPECTED_ERROR: {
    title: "Não foi possível concluir",
    description: "Tente novamente. Sua pontuação não será duplicada.",
  },
}

export function MissionCompletionResult({
  eventId,
  qrId,
}: Readonly<{ eventId: string; qrId: string }>) {
  const requestRef = useRef<Promise<MissionActionResult> | null>(null)
  const [state, setState] = useState<State>({ status: "loading" })

  useEffect(() => {
    let active = true
    requestRef.current ??= completeQrMissionAction({ eventId, qrId })

    const timeoutId = window.setTimeout(() => {
      if (active) {
        setState({
          status: "complete",
          result: { success: false, code: "UNEXPECTED_ERROR" },
        })
      }
    }, MISSION_COMPLETION_TIMEOUT_MS)

    void requestRef.current
      .then((result) => {
        if (active) setState({ status: "complete", result })
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
        title="Validando missão"
        description="Aguarde enquanto verificamos a conclusão e a pontuação."
      />
    )
  }

  if (!state.result.success) {
    const feedback = errors[state.result.code]

    return (
      <QrResult
        appearance="reveal"
        status="error"
        actionHref="/scan"
        actionLabel="Ler QR novamente"
        secondaryActionHref="/missions"
        secondaryActionLabel="Ver missões"
        title={feedback.title}
        description={feedback.description}
      />
    )
  }

  const repeated = state.result.code === "MISSION_ALREADY_COMPLETED"

  return (
    <ActivityRevealCard
      kind="mission"
      title={state.result.missionTitle}
      description={state.result.missionDescription}
      imageUrl={state.result.missionImageUrl}
      xpAwarded={state.result.xpAwarded}
      repeated={repeated}
      href="/missions"
      actionLabel="Ver missões"
    />
  )
}
