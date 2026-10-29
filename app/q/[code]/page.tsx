import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { env } from "@/env"
import { auth } from "@/lib/auth"
import { CompanyVisitResult } from "@/modules/companies/company-visit-result"
import { MissionCompletionResult } from "@/modules/missions/mission-completion-result"
import UserQrCodePage from "@/modules/qr-code/pages/user-qr-code-page"
import { QrResult } from "@/modules/qr-code/qr-result"
import { resolveQrCodeUrl } from "@/modules/qr-code/resolve-qr-code.service"
import { TagDiscoveryResult } from "@/modules/tags/tag-discovery-result"

export const metadata: Metadata = { title: "QR Code do evento" }
export const dynamic = "force-dynamic"

export default async function QrCodePage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ code: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}>) {
  const [{ code }, query] = await Promise.all([params, searchParams])
  if (Object.keys(query).length > 0)
    return (
      <QrResult
        status="error"
        title="QR Code inválido"
        description="Não foi possível reconhecer este código."
      />
    )
  const url = new URL(`/q/${encodeURIComponent(code)}`, env.NEXT_PUBLIC_APP_URL)
  const session = await auth()
  if (!session?.user)
    redirect(`/login?callbackUrl=${encodeURIComponent(url.pathname)}`)
  const parsed = await resolveQrCodeUrl(url.toString())
  if (!parsed.valid)
    return (
      <QrResult
        status="error"
        title="QR Code inválido"
        description="Não foi possível validar este código. Se for de um participante, peça para renová-lo."
      />
    )
  const target = parsed.target
  switch (target.type) {
    case "user":
      return <UserQrCodePage target={target} callbackPath={url.pathname} />
    case "company":
      return <CompanyVisitResult eventId={target.eventId} qrId={target.qrId} />
    case "mission":
      return (
        <MissionCompletionResult eventId={target.eventId} qrId={target.qrId} />
      )
    case "tag":
      return <TagDiscoveryResult eventId={target.eventId} qrId={target.qrId} />
  }
}
