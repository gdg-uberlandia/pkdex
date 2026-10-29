import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { getProfileByPublicQrId } from "@/modules/profile/profile.service"
import { type QrCodeTarget } from "@/modules/qr-code/qr-code.contract"
import { QrResult } from "@/modules/qr-code/qr-result"
import { validateUserQrToken } from "@/modules/qr-code/user-qr-token"

export default async function UserQrCodePage({
  target,
  callbackPath,
}: Readonly<{
  target: Extract<QrCodeTarget, { type: "user" }>
  callbackPath: string
}>) {
  const session = await auth()
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackPath)}`)
  }

  const validation = validateUserQrToken({
    token: target.token,
    eventId: target.eventId,
    qrId: target.qrId,
  })

  if (!validation.valid) {
    const isExpired = validation.code === "QR_EXPIRED"

    return (
      <QrResult
        status="error"
        title={isExpired ? "Este QR Code expirou" : "QR Code inválido"}
        description={
          isExpired
            ? "Peça ao participante para abrir novamente o QR Code atualizado."
            : "Não foi possível validar este código."
        }
      />
    )
  }

  const targetProfile = await getProfileByPublicQrId(
    target.eventId,
    target.qrId
  )

  if (!targetProfile) {
    return (
      <QrResult
        status="error"
        title="Participante não encontrado"
        description="O perfil associado a este QR Code não está disponível."
      />
    )
  }

  if (targetProfile.userId === session.user.id) {
    return (
      <QrResult
        status="error"
        title="Este é o seu QR Code"
        description="Peça para outro participante escanear o código para iniciar uma conexão."
      />
    )
  }

  return (
    <QrResult
      status="success"
      title={targetProfile.displayName}
      description="QR Code válido. Use o scanner do aplicativo para registrar a conexão."
    />
  )
}
