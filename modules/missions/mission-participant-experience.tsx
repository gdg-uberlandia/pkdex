"use client"

import {
  CheckCircle2,
  ChevronRight,
  CircleDot,
  LockKeyhole,
  QrCode,
  Sparkles,
  Target,
  UnlockKeyhole,
  XCircle,
} from "lucide-react"
import Link from "next/link"
import type { ReactElement } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { SeasonalCardDecoration } from "@/modules/seasonal-theme/seasonal-decorations"

import type { MissionListItem } from "./mission.service"
import { MissionKeywordForm } from "./mission-keyword-form"
import {
  orderMissionsForDisplay,
  selectFeaturedMission,
} from "./mission-presentation"
import { MissionQuizForm } from "./mission-quiz-form"

const statusContent = {
  available: { label: "Disponível", icon: CircleDot },
  blocked: { label: "Bloqueada", icon: LockKeyhole },
  completed: { label: "Concluída", icon: CheckCircle2 },
  failed: { label: "Encerrada sem sucesso", icon: XCircle },
} as const

const missionGroups = [
  {
    status: "available",
    title: "Disponíveis",
    empty: "Nenhuma missão disponível no momento.",
  },
  {
    status: "blocked",
    title: "Bloqueadas",
    empty: "Nenhuma missão bloqueada.",
  },
  {
    status: "completed",
    title: "Concluídas",
    empty: "Você ainda não concluiu nenhuma missão.",
  },
  {
    status: "failed",
    title: "Encerradas",
    empty: "Nenhuma missão encerrada sem sucesso.",
  },
] as const

export function MissionParticipantExperience({
  missions,
}: Readonly<{ missions: MissionListItem[] }>) {
  const orderedMissions = orderMissionsForDisplay(missions)
  const featuredMission = selectFeaturedMission(missions)
  const completedCount = missions.filter(
    (mission) => mission.status === "completed"
  ).length
  const progress = Math.round((completedCount / missions.length) * 100)

  return (
    <div className="space-y-6">
      <section className="space-y-2" aria-label="Progresso das missões">
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="font-medium">Seu progresso</p>
          <p className="text-muted-foreground tabular-nums">
            {completedCount} de {missions.length} concluídas
          </p>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Missões concluídas"
          aria-valuemin={0}
          aria-valuemax={missions.length}
          aria-valuenow={completedCount}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="featured-mission-title">
        <h2
          id="featured-mission-title"
          className="text-sm font-semibold text-muted-foreground"
        >
          Em destaque
        </h2>
        {featuredMission ? (
          <FeaturedMission mission={featuredMission} />
        ) : (
          <div className="flex items-center gap-4 rounded-3xl bg-(image:--gradient-primary-card) p-5 text-primary-foreground shadow-glow-primary">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-foreground/15">
              <CheckCircle2 className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h3 className="font-semibold">
                {completedCount === missions.length
                  ? "Todas as missões concluídas"
                  : "Nenhuma missão disponível"}
              </h3>
              <p className="mt-1 text-sm text-primary-foreground/75">
                {completedCount === missions.length
                  ? "Você completou todos os desafios disponíveis."
                  : "Confira abaixo suas missões concluídas e encerradas."}
              </p>
            </div>
          </div>
        )}
      </section>

      {missionGroups.map(({ status, title, empty }) => {
        const group = orderedMissions.filter(
          (mission) => mission.status === status
        )
        const StatusIcon = statusContent[status].icon
        return (
          <section
            key={status}
            className="space-y-3"
            aria-labelledby={`missions-${status}-title`}
          >
            <h2
              id={`missions-${status}-title`}
              className="flex items-center gap-2 text-lg font-semibold"
            >
              <StatusIcon
                className={cn(
                  "size-5",
                  status === "failed"
                    ? "text-destructive"
                    : status === "blocked"
                      ? "text-muted-foreground"
                      : "text-primary"
                )}
                aria-hidden="true"
              />
              {title}
              <Badge variant="secondary" className="ml-auto tabular-nums">
                {group.length}
              </Badge>
            </h2>
            {group.length ? (
              <div className="divide-y divide-border overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
                {group.map((mission) => (
                  <MissionRow key={mission.id} mission={mission} />
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
                {empty}
              </p>
            )}
          </section>
        )
      })}
    </div>
  )
}

function FeaturedMission({ mission }: Readonly<{ mission: MissionListItem }>) {
  const blocked = mission.status === "blocked"

  return (
    <MissionDialog
      mission={mission}
      trigger={
        <button
          type="button"
          className={cn(
            "group relative w-full overflow-hidden rounded-3xl p-5 text-left shadow-card transition-transform focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.99]",
            blocked
              ? "bg-card ring-1 ring-border"
              : "bg-(image:--gradient-immersive) text-white"
          )}
        >
          <SeasonalCardDecoration />
          <div className="relative flex items-start gap-4">
            <MissionImage mission={mission} featured />
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-xs font-medium",
                  blocked ? "text-muted-foreground" : "text-white/65"
                )}
              >
                {blocked ? "Próxima a desbloquear" : "Disponível agora"}
              </p>
              <h3 className="mt-1 font-semibold">{mission.title}</h3>
              <p
                className={cn(
                  "mt-1 line-clamp-2 text-sm leading-5",
                  blocked ? "text-muted-foreground" : "text-white/70"
                )}
              >
                {mission.description}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                    blocked
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/25 text-white"
                  )}
                >
                  <Sparkles className="size-3.5" aria-hidden="true" />+
                  {mission.xpAwarded} XP
                </span>
                <ChevronRight
                  className={cn(
                    "size-5",
                    blocked ? "text-muted-foreground" : "text-white/70"
                  )}
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>
        </button>
      }
    />
  )
}

function MissionRow({ mission }: Readonly<{ mission: MissionListItem }>) {
  const status = statusContent[mission.status]
  const StatusIcon = status.icon
  const firstBlocker = mission.blockedBy[0]

  return (
    <MissionDialog
      mission={mission}
      trigger={
        <button
          type="button"
          className={cn(
            "flex min-h-18 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
            mission.status === "completed" && "bg-primary/5",
            mission.status === "blocked" && "opacity-70"
          )}
        >
          <MissionImage mission={mission} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {mission.title}
            </span>
            {firstBlocker ? (
              <span className="mt-1 block truncate text-xs text-muted-foreground">
                Requer: {formatBlocker(firstBlocker)}
                {mission.blockedBy.length > 1 &&
                  ` e mais ${mission.blockedBy.length - 1}`}
              </span>
            ) : (
              <span className="mt-1 block text-xs text-muted-foreground">
                {mission.validationType === "reviewer"
                  ? "Validação presencial"
                  : mission.validationType === "automatic"
                    ? mission.networkingByInterest
                      ? "Networking por interesse"
                      : "Progresso automático"
                    : mission.validationType === "keyword"
                      ? "Descubra a palavra-chave"
                      : mission.validationType === "quiz"
                        ? "Quiz relâmpago"
                        : "Encontre o QR Code"}
              </span>
            )}
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-xs font-semibold text-primary">
              {mission.status === "failed"
                ? "Sem XP"
                : `+${mission.xpAwarded} XP`}
            </span>
            <span
              className={cn(
                "mt-1 flex items-center justify-end",
                mission.status === "available" &&
                  "text-[#00788A] drop-shadow-[0_0_6px_#00E5FF] dark:text-[#66F3FF]",
                mission.status === "blocked" && "text-muted-foreground",
                mission.status === "completed" && "text-success",
                mission.status === "failed" && "text-destructive"
              )}
            >
              <StatusIcon className="size-4" aria-hidden="true" />
              <span className="sr-only">{status.label}</span>
            </span>
          </span>
        </button>
      }
    />
  )
}

function MissionImage({
  mission,
  featured = false,
  dialog = false,
}: Readonly<{
  mission: MissionListItem
  featured?: boolean
  dialog?: boolean
}>) {
  return (
    <Avatar
      className={cn(
        "rounded-xl",
        dialog ? "size-40" : featured ? "size-16" : "size-11"
      )}
    >
      {(dialog || mission.status === "completed") && mission.imageUrl && (
        <AvatarImage
          src={mission.imageUrl}
          alt=""
          className="rounded-xl object-contain"
        />
      )}
      <AvatarFallback
        className={cn(
          "rounded-xl",
          mission.status === "available" &&
            "bg-[#00E5FF]/15 text-[#00788A] shadow-[0_0_18px_color-mix(in_oklab,#00E5FF_20%,transparent)] dark:text-[#66F3FF]",
          mission.status === "completed" && "bg-success/15 text-success"
        )}
      >
        {mission.status === "blocked" ? (
          <LockKeyhole aria-hidden="true" />
        ) : mission.status === "completed" ? (
          <CheckCircle2 aria-hidden="true" />
        ) : (
          <UnlockKeyhole aria-hidden="true" />
        )}
      </AvatarFallback>
    </Avatar>
  )
}

function MissionDialog({
  mission,
  trigger,
}: Readonly<{ mission: MissionListItem; trigger: ReactElement }>) {
  const status = statusContent[mission.status]
  const StatusIcon = status.icon
  const links =
    mission.externalLinks ??
    (mission.externalUrl
      ? [{ label: "Acessar atividade", url: mission.externalUrl }]
      : [])

  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent
        className="block max-h-[90dvh] overflow-y-auto rounded-3xl bg-[#070b18] p-0 text-white ring-white/10 sm:max-w-sm"
        showCloseButton={false}
      >
        <div className="flex min-h-64 items-center justify-center bg-[#070b18] p-8">
          <MissionImage mission={mission} dialog />
        </div>

        <div className="relative -mt-5 space-y-4 rounded-t-[2rem] bg-[#0d1324] p-4 pt-6">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-orange-400/15 text-orange-300 ring-1 ring-orange-300/20">
                <Target className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-xl leading-snug text-white">
                  {mission.title}
                </DialogTitle>
                <Badge
                  className="mt-1.5 border-orange-300/25 bg-orange-400/15 text-orange-200"
                  variant={
                    mission.status === "completed" ? "default" : "outline"
                  }
                >
                  <StatusIcon aria-hidden="true" />
                  {status.label}
                </Badge>
              </div>
            </div>
            <DialogDescription className="pt-1 leading-6 whitespace-pre-wrap text-white/65">
              {mission.description}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10">
            <div className="bg-white/5 p-4">
              <p className="text-xs font-medium text-white/50">Recompensa</p>
              <p className="mt-2 text-xl font-bold text-orange-300">
                {mission.status === "failed"
                  ? "Sem XP"
                  : `+${mission.xpAwarded} XP`}
              </p>
            </div>
            <div className="bg-white/5 p-4">
              <p className="text-xs font-medium text-white">Como concluir</p>
              <p className="mt-2 text-sm leading-5 text-white/60">
                {mission.validationType === "reviewer"
                  ? "Realize a atividade e apresente seu QR Code para uma pessoa da organização."
                  : mission.validationType === "automatic"
                    ? mission.networkingByInterest
                      ? "Escolha seus interesses no perfil e conecte-se com pessoas que tenham pelo menos um interesse em comum. Cada pessoa conta uma vez."
                      : "Continue participando. A missão será concluída automaticamente quando você atingir a meta."
                    : mission.validationType === "keyword"
                      ? "Descubra a palavra-chave e envie sua resposta abaixo. As tentativas são limitadas."
                      : mission.validationType === "quiz"
                        ? "Responda às perguntas e alcance o mínimo de acertos para concluir."
                        : "Encontre e leia o QR Code desta missão durante o evento."}
              </p>
            </div>
          </div>

          {links.length > 0 && (
            <div className="grid grid-cols-3 items-stretch gap-2">
              {links.map((link, index) => (
                <Button
                  key={`${index}-${link.url}`}
                  className="h-auto min-w-0 px-2 py-3 text-center text-xs [overflow-wrap:anywhere] whitespace-normal"
                  render={
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                  nativeButton={false}
                >
                  {link.label}
                </Button>
              ))}
            </div>
          )}

          {mission.status === "failed" && (
            <div
              className="rounded-xl border border-destructive/30 bg-destructive/10 p-4"
              role="status"
            >
              <p className="font-medium text-destructive">
                Tentativas esgotadas — missão encerrada sem XP.
              </p>
              {mission.lastScore !== undefined &&
                mission.questionCount !== undefined && (
                  <p className="mt-2 text-sm text-white/70">
                    Na última tentativa, você acertou {mission.lastScore} de{" "}
                    {mission.questionCount} perguntas.
                  </p>
                )}
            </div>
          )}
          {mission.status !== "failed" && mission.blockedBy.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-sm font-medium">Para desbloquear, conclua:</p>
              <ul className="mt-2 space-y-2 text-sm text-white/60">
                {mission.blockedBy.map((prerequisite) => (
                  <li
                    key={`${prerequisite.type}:${prerequisite.label}`}
                    className="flex gap-2"
                  >
                    <LockKeyhole
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    {formatBlocker(prerequisite)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {mission.networkingByInterest && mission.status !== "completed" && (
            <Button
              variant="outline"
              render={<Link href="/profile/edit" />}
              nativeButton={false}
            >
              Editar meus interesses
            </Button>
          )}
          {mission.status === "available" &&
            mission.validationType === "keyword" && (
              <MissionKeywordForm
                missionId={mission.id}
                maxAttempts={mission.keywordMaxAttempts}
                attemptsUsed={mission.attemptsUsed ?? 0}
              />
            )}
          {mission.status === "available" && mission.quiz && (
            <MissionQuizForm
              key={mission.quiz.revision}
              missionId={mission.id}
              quiz={mission.quiz}
              attemptsUsed={mission.attemptsUsed ?? 0}
            />
          )}
          <DialogFooter className="mx-0 mb-0 flex-row rounded-none border-0 bg-transparent p-0 pt-2">
            <DialogClose
              render={
                <Button
                  variant="outline"
                  className="flex-1 border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                />
              }
            >
              Fechar
            </DialogClose>
            {mission.status === "available" &&
              mission.validationType === "reviewer" && (
                <Button
                  className="flex-1"
                  render={<Link href="/profile/qr-code?source=missions" />}
                  nativeButton={false}
                >
                  <QrCode aria-hidden="true" />
                  Meu QR Code
                </Button>
              )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function formatBlocker(prerequisite: MissionListItem["blockedBy"][number]) {
  if (prerequisite.type === "progress") return prerequisite.label

  return prerequisite.type === "company"
    ? `Visite ${prerequisite.label}`
    : `Complete “${prerequisite.label}”`
}
