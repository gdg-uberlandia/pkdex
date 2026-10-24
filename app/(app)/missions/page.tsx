import { ScanLine, ShieldCheck, Target } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { EmptyState } from "@/components/layout/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireAuth } from "@/lib/require-auth"
import { cn } from "@/lib/utils"
import {
  getMissionReviewContextForSession,
  listMissionsForSession,
  type listReviewableMissionsForSession,
} from "@/modules/missions/mission.service"
import { MissionParticipantExperience } from "@/modules/missions/mission-participant-experience"

export const metadata: Metadata = { title: "Missões" }
export const dynamic = "force-dynamic"

type MissionsPageProps = Readonly<{
  searchParams: Promise<{
    reviewResult?: string
    participant?: string
    mission?: string
    xp?: string
  }>
}>

export default async function MissionsPage({
  searchParams,
}: MissionsPageProps) {
  const session = await requireAuth()
  const [reviewContext, resultParams] = await Promise.all([
    getMissionReviewContextForSession(session),
    searchParams,
  ])

  if (reviewContext) {
    const { sponsor, companyName, missions: reviewableMissions } = reviewContext
    return (
      <div className="space-y-6 p-6">
        <section className="space-y-1">
          <Badge variant="secondary">
            <ShieldCheck aria-hidden="true" />
            {sponsor ? "Área da empresa" : "Área da organização"}
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight">Validar missões</h1>
          {sponsor && (
            <p className="font-medium">
              {companyName ?? "Empresa indisponível"}
            </p>
          )}
          <p className="text-sm leading-6 text-muted-foreground">
            {sponsor && !companyName
              ? "Peça à organização para conferir seu vínculo com uma empresa ativa."
              : "Escolha a missão realizada e depois leia o QR Code do participante."}
          </p>
        </section>

        {!reviewContext.missionsEnabled && (
          <p
            role="status"
            className="rounded-xl bg-warning/15 p-4 text-sm text-warning"
          >
            A organização pausou as conclusões de missões. Novas validações
            estão bloqueadas para todas as empresas.
          </p>
        )}
        {resultParams.reviewResult && <ReviewFeedback params={resultParams} />}

        <MissionReviewerList missions={reviewableMissions} />
      </div>
    )
  }

  const missions = await listMissionsForSession(session)
  if (missions.length === 0) {
    return (
      <EmptyState
        icon={<Target className="size-8" aria-hidden="true" />}
        title="Nenhuma missão disponível"
        description="As missões aparecerão aqui quando forem liberadas."
      />
    )
  }

  return (
    <div className="space-y-6 p-6">
      <section className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Missões</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Complete os desafios do evento para acumular XP.
        </p>
      </section>

      <MissionParticipantExperience missions={missions} />
    </div>
  )
}

function ReviewFeedback({
  params,
}: Readonly<{
  params: Awaited<MissionsPageProps["searchParams"]>
}>) {
  const success =
    params.reviewResult === "MISSION_COMPLETED" ||
    params.reviewResult === "MISSION_ALREADY_COMPLETED"
  const descriptions: Record<string, string> = {
    FORBIDDEN: "Sua conta não tem permissão para validar missões.",
    INVALID_QR: "O QR Code do participante não pôde ser validado.",
    MISSION_INACTIVE: "Esta missão não está mais disponível.",
    MISSION_NOT_FOUND: "A missão selecionada não foi encontrada.",
    PREREQUISITE_MISSING: "O participante ainda não cumpriu os pré-requisitos.",
    PROFILE_UNAVAILABLE: "O perfil do participante não está disponível.",
    QR_EXPIRED: "O QR Code expirou. Peça ao participante para atualizá-lo.",
    MISSIONS_DISABLED: "A organização pausou as conclusões de missões.",
    WRONG_VALIDATION_TYPE: "Esta missão não aceita validação presencial.",
  }

  return (
    <div
      role={success ? "status" : "alert"}
      className={cn(
        "rounded-xl border p-4 text-sm",
        params.reviewResult === "MISSION_COMPLETED"
          ? "border-success/30 bg-success/15 text-success"
          : params.reviewResult === "MISSION_ALREADY_COMPLETED"
            ? "border-warning/30 bg-warning/15 text-warning"
            : "border-destructive/30 bg-destructive/15 text-destructive"
      )}
    >
      {params.reviewResult === "MISSION_COMPLETED"
        ? `${params.participant} concluiu “${params.mission}” e recebeu ${params.xp} XP.`
        : params.reviewResult === "MISSION_ALREADY_COMPLETED"
          ? `${params.participant} já havia concluído “${params.mission}”. Nenhum XP adicional foi concedido.`
          : (descriptions[params.reviewResult ?? ""] ??
            "Não foi possível validar a missão. Tente novamente.")}
    </div>
  )
}

function MissionReviewerList({
  missions,
}: Readonly<{
  missions: Awaited<ReturnType<typeof listReviewableMissionsForSession>>
}>) {
  if (!missions?.length) {
    return (
      <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
        Não há missões presenciais disponíveis para validação.
      </p>
    )
  }

  return (
    <section className="space-y-3" aria-label="Missões para validação">
      {missions.map((mission) => (
        <Card key={mission.id}>
          <CardHeader>
            <CardTitle>{mission.title}</CardTitle>
            <CardDescription>{mission.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-primary">
              +{mission.xpAwarded} XP
            </span>
            <Button
              render={
                <Link
                  href={`/missions/review/${encodeURIComponent(mission.id)}`}
                />
              }
              nativeButton={false}
            >
              <ScanLine data-icon="inline-start" aria-hidden="true" />
              Validar
            </Button>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
