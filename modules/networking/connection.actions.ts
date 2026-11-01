"use server"

import { revalidatePath } from "next/cache"
import { ZodError } from "zod"

import { requireAuth } from "@/lib/require-auth"

import {
  createConnectionRequestForSession,
  removeConnectionForSession,
} from "./connection.service"

export type ConnectFromScanActionResult = Readonly<{
  success: boolean
  code?: string
  message?: string
}>

export async function connectFromScanAction(
  input: unknown
): Promise<ConnectFromScanActionResult> {
  const session = await requireAuth()

  try {
    const result = await createConnectionRequestForSession(session, input)

    if (result.success) {
      revalidatePath("/connections")

      return {
        success: true,
        code: result.code,
        message:
          result.code === "ALREADY_CONNECTED"
            ? "Vocês já estão conectados."
            : "Conexão criada. Vocês receberam 5 XP.",
      }
    }

    const messages: Record<string, string> = {
      INVALID_EVENT: "Este QR Code pertence a outro evento.",
      FORBIDDEN: "Esta conta não participa das atividades do evento.",
      INVALID_QR: "Não foi possível validar este QR Code.",
      PROFILE_NOT_FOUND: "O perfil deste participante não está disponível.",
      QR_EXPIRED:
        "Este QR Code expirou. Peça ao participante para atualizá-lo.",
      EVENT_CLOSED: "O evento foi encerrado. Novas conexões estão bloqueadas.",
      SCAN_COOLDOWN:
        "Aguarde um minuto antes de se conectar novamente com esta pessoa.",
      SELF_CONNECTION: "Você não pode se conectar com o próprio perfil.",
    }

    return {
      success: false,
      code: result.code,
      message: messages[result.code] ?? "Não foi possível criar a conexão.",
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        code: "INVALID_INPUT",
        message: "Os dados do QR Code são inválidos.",
      }
    }

    console.error("Failed to connect participants from scan", error)

    return {
      success: false,
      code: "UNEXPECTED_ERROR",
      message: "Não foi possível criar a conexão. Tente novamente.",
    }
  }
}

export type ConnectionMutationActionState = Readonly<{
  success: boolean
  message?: string
}>

export async function mutateConnectionAction(
  _previousState: ConnectionMutationActionState,
  formData: FormData
): Promise<ConnectionMutationActionState> {
  const session = await requireAuth()
  const input = {
    connectionId: formData.get("connectionId"),
  }
  const intent = formData.get("intent")

  try {
    const result =
      intent === "remove"
        ? await removeConnectionForSession(session, input)
        : { success: false as const, code: "INVALID_ACTION" }

    if (result.success) {
      revalidatePath("/connections")

      const messages: Record<string, string> = {
        CONNECTION_REMOVED: "Conexão removida.",
      }

      return {
        success: true,
        message: messages[result.code] ?? "Conexão atualizada.",
      }
    }

    return {
      success: false,
      message: "Não foi possível atualizar esta conexão.",
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        message: "A conexão informada é inválida.",
      }
    }

    console.error("Failed to mutate connection", error)

    return {
      success: false,
      message: "Não foi possível atualizar esta conexão. Tente novamente.",
    }
  }
}
