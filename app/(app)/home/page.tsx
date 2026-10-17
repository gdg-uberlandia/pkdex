import {
  Building2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Gift,
  LockKeyhole,
  Mic2,
  MonitorUp,
  QrCode,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Stamp,
  Tags,
  Target,
  Ticket,
  Trophy,
  UnlockKeyhole,
  UsersRound,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import { formatLevelLabel, getLevelForXp, MAX_LEVEL_XP } from "@/config/levels"
import { requireAuth } from "@/lib/require-auth"
import { cn } from "@/lib/utils"
import { getHomeCatalogTotals } from "@/modules/home/home.service"
import { HomeTicketProgress } from "@/modules/home/home-guidance"
import {
  calculatePassportProgress,
  type HomeObjective,
  selectHomeObjective,
} from "@/modules/home/home-progress"
import { NoticeBell } from "@/modules/notices/notice-bell"
import { findOrInitializeParticipantSummary } from "@/modules/participant-summary/participant-summary.repository"
import { ParticipantSummaryCard } from "@/modules/participant-summary/participant-summary-card"
import { hasPermission } from "@/modules/profile/profile.authorization"
import { requireProfileForSession } from "@/modules/profile/profile.service"
import type { Profile } from "@/modules/profile/profile.types"
import {
  findEventOperations,
  isTicketConversionEnabled,
} from "@/modules/tickets/ticket.repository"

export const metadata: Metadata = {
  title: "Início",
}

const explorationItems = [
  {
    href: "/talks",
    label: "Palestras",
    icon: Mic2,
    className:
      "bg-[#00E5FF]/15 text-[#00788A] shadow-[0_0_18px_color-mix(in_oklab,#00E5FF_20%,transparent)] dark:text-[#66F3FF]",
  },
  {
    href: "/ranking",
    label: "Ranking",
    icon: Trophy,
    className:
      "bg-[#F6F118]/18 text-[#716E00] shadow-[0_0_18px_color-mix(in_oklab,#F6F118_22%,transparent)] dark:text-[#F6F118]",
  },
  {
    href: "/tickets",
    label: "Tickets",
    icon: Ticket,
    className:
      "bg-[#FF3DF2]/15 text-[#9B0091] shadow-[0_0_18px_color-mix(in_oklab,#FF3DF2_20%,transparent)] dark:text-[#FF78F5]",
  },
] as const

const objectiveIcons = {
  company: Building2,
  mission: Target,
  tag: Tags,
  connection: UsersRound,
} as const

function getFirstName(displayName: string) {
  return displayName.trim().split(/\s+/)[0]
}

function getInitials(displayName: string) {
  return displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
}

function calculateLevelProgress(xp: number) {
  const level = getLevelForXp(xp)

  return {
    level,
    percentage: Math.min(100, Math.max(0, (xp / MAX_LEVEL_XP) * 100)),
  }
}

export default async function HomePage() {
  const session = await requireAuth()
  const profile = await requireProfileForSession(session)

  if (!hasPermission(profile, "participate")) {
    const operations = hasPermission(profile, "serve-participants")
      ? await findEventOperations(profile.eventId)
      : null

    return <OrganizationHome profile={profile} operations={operations} />
  }

  const [summary, catalogTotals, conversionEnabled] = await Promise.all([
    findOrInitializeParticipantSummary(profile.eventId, profile.userId),
    getHomeCatalogTotals(profile.eventId),
    isTicketConversionEnabled(profile.eventId),
  ])
  const levelProgress = calculateLevelProgress(profile.xp)
  const passport = calculatePassportProgress(summary, catalogTotals)
  const objective = selectHomeObjective(summary, catalogTotals)

  return (
    <div className="space-y-7 px-6 py-6">
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">
              Boas-vindas ao DevFest
            </p>
            <h1 className="truncate text-2xl font-bold">
              Olá, {getFirstName(profile.displayName)}!
            </h1>
          </div>

          <NoticeBell />
          <Link
            href="/profile"
            className="shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
            aria-label="Abrir meu perfil"
          >
            <Avatar className="size-12">
              {profile.avatarUrl && (
                <AvatarImage
                  src={profile.avatarUrl}
                  alt={`Foto de ${profile.displayName}`}
                />
              )}
              <AvatarFallback>
                {getInitials(profile.displayName)}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-xs">
            <p className="font-medium">
              {formatLevelLabel(levelProgress.level)}
            </p>
            <p className="shrink-0 text-muted-foreground tabular-nums">
              {profile.xp.toLocaleString("pt-BR")} /{" "}
              {MAX_LEVEL_XP.toLocaleString("pt-BR")} XP
            </p>
          </div>
          <ProgressTrack
            value={levelProgress.percentage}
            label="Progresso até o nível máximo"
          />
        </div>
      </section>

      <Link
        href="/passport"
        className="group relative block overflow-hidden rounded-3xl bg-(image:--gradient-primary-card) p-5 text-primary-foreground shadow-glow-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Stamp
          className="absolute -right-5 -bottom-7 size-36 -rotate-12 text-primary-foreground/15 transition-transform group-hover:-rotate-6"
          strokeWidth={1.25}
          aria-hidden="true"
        />
        <div className="relative space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary-foreground/80">
                Seu Passaporte
              </p>
              <p className="mt-1 font-pixel-square text-5xl font-bold">
                {passport.percentage}%
              </p>
              <p className="mt-1 text-xs text-primary-foreground/70">
                {passport.completed} de {passport.total} atividades
              </p>
            </div>
            <ChevronRight
              className="size-6 text-primary-foreground/80"
              aria-hidden="true"
            />
          </div>
          <ProgressTrack
            value={passport.percentage}
            label="Progresso do passaporte"
            variant="success"
          />
        </div>
      </Link>

      <Link
        href="/profile/qr-code?source=home"
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-card px-4 py-3 text-sm font-medium ring-1 ring-foreground/10 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <QrCode
          className="size-5 text-[#357A12] dark:text-[#8CFF52]"
          aria-hidden="true"
        />
        Mostrar meu QR Code
      </Link>

      <NextObjective objective={objective} />

      <HomeTicketProgress
        xp={profile.xp}
        convertedXp={profile.convertedXp}
        conversionEnabled={conversionEnabled}
      />

      <ParticipantSummaryCard summary={summary} totals={catalogTotals} />

      <section className="space-y-3" aria-labelledby="explore-title">
        <div>
          <h2 id="explore-title" className="text-lg font-semibold">
            Explore o evento
          </h2>
          <p className="text-sm text-muted-foreground">
            Descubra outras experiências do aplicativo.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {explorationItems.map(({ href, label, icon: Icon, className }) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl bg-card px-2 py-3 text-center ring-1 ring-foreground/10 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl",
                  className
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="text-xs font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

function OrganizationHome({
  profile,
  operations,
}: Readonly<{
  profile: Profile
  operations: Awaited<ReturnType<typeof findEventOperations>> | null
}>) {
  const canServeParticipants = hasPermission(profile, "serve-participants")
  const canReviewMissions = hasPermission(profile, "review-missions")
  const canManage = hasPermission(profile, "manage-event-operations")
  const canViewRaffleDisplay = hasPermission(profile, "view-raffle-display")
  const roleLabel = canManage ? "Administrador" : "Equipe do evento"

  const shortcuts = [
    ...(canReviewMissions
      ? [
          {
            href: "/missions",
            label: "Validar missões",
            description: "Escolha uma missão e leia o QR do participante",
            icon: ClipboardCheck,
          },
        ]
      : []),
    ...(canServeParticipants
      ? [
          {
            href: "/operations",
            label: "Central de operações",
            description: "Acompanhe conversões, resgates e atendimentos",
            icon: ClipboardList,
          },
        ]
      : []),
    ...(canManage
      ? [
          {
            href: "/operations/talks",
            label: "Avaliações de palestras",
            description: "Libere, bloqueie ou encerre avaliações",
            icon: Mic2,
          },
        ]
      : []),
    ...(canViewRaffleDisplay
      ? [
          {
            href: "/raffles/live",
            label: "Telão do sorteio",
            description: "Abra a visualização do sorteio em outra tela",
            icon: MonitorUp,
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-6 px-6 py-6">
      <section className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            Organização do DevFest
          </p>
          <h1 className="truncate text-2xl font-bold">
            Olá, {getFirstName(profile.displayName)}!
          </h1>
        </div>

        <NoticeBell />
        <Link
          href="/profile"
          className="shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          aria-label="Abrir meu perfil"
        >
          <Avatar className="size-12">
            {profile.avatarUrl && (
              <AvatarImage
                src={profile.avatarUrl}
                alt={`Foto de ${profile.displayName}`}
              />
            )}
            <AvatarFallback>{getInitials(profile.displayName)}</AvatarFallback>
          </Avatar>
        </Link>
      </section>

      <section className="overflow-hidden rounded-3xl bg-(image:--gradient-immersive) p-5 text-white shadow-lg shadow-primary/15">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-medium text-white/65">Acesso ativo</p>
            <h2 className="mt-1 text-xl font-bold">{roleLabel}</h2>
            <p className="mt-1 text-sm leading-5 text-white/70">
              Acesse rapidamente as atividades necessárias para operar o evento.
            </p>
          </div>
        </div>
      </section>

      {canServeParticipants && (
        <Link
          href="/operations/scan"
          className="group flex items-center gap-4 rounded-3xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glow-primary">
            <ScanLine className="size-6" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Atender participante</span>
            <span className="mt-0.5 block text-sm text-muted-foreground">
              Leia um QR Code para iniciar o atendimento
            </span>
          </span>
          <ChevronRight
            className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      )}

      {operations && (
        <section className="space-y-3" aria-labelledby="services-status-title">
          <div>
            <h2 id="services-status-title" className="text-lg font-semibold">
              Estado dos serviços
            </h2>
            <p className="text-sm text-muted-foreground">
              Situação atual das operações com participantes.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ServiceStatus
              icon={Ticket}
              label="Conversões"
              enabled={operations.ticketConversionEnabled}
            />
            <ServiceStatus
              icon={Gift}
              label="Resgates"
              enabled={operations.rewardRedemptionEnabled}
            />
          </div>
        </section>
      )}

      {shortcuts.length > 0 && (
        <section className="space-y-3" aria-labelledby="staff-shortcuts-title">
          <div>
            <h2 id="staff-shortcuts-title" className="text-lg font-semibold">
              Atalhos operacionais
            </h2>
            <p className="text-sm text-muted-foreground">
              Ferramentas disponíveis para o seu acesso.
            </p>
          </div>
          <div className="divide-y divide-foreground/10 overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
            {shortcuts.map(
              ({ href, label, description, icon: ShortcutIcon }) => (
                <Link
                  key={href}
                  href={href}
                  target={href === "/raffles/live" ? "_blank" : undefined}
                  rel={href === "/raffles/live" ? "noreferrer" : undefined}
                  className="group flex items-center gap-3 p-4 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ShortcutIcon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{label}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {description}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              )
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function ServiceStatus({
  icon: Icon,
  label,
  enabled,
}: Readonly<{
  icon: typeof Ticket
  label: string
  enabled: boolean
}>) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-xl",
          enabled
            ? "bg-success/15 text-success"
            : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-semibold">{label}</p>
      <p
        className={cn(
          "mt-1 flex items-center gap-1.5 text-xs",
          enabled ? "text-success" : "text-muted-foreground"
        )}
      >
        {enabled ? (
          <UnlockKeyhole className="size-3.5" aria-hidden="true" />
        ) : (
          <LockKeyhole className="size-3.5" aria-hidden="true" />
        )}
        {enabled ? "Liberadas" : "Bloqueadas"}
      </p>
    </div>
  )
}

function NextObjective({ objective }: Readonly<{ objective: HomeObjective }>) {
  const Icon = objectiveIcons[objective.type]

  return (
    <section className="overflow-hidden rounded-3xl bg-(image:--gradient-immersive) p-5 text-white shadow-card">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-white/65">
            {objective.eyebrow}
          </p>
          <h2 className="mt-1 text-lg font-semibold">{objective.title}</h2>
          <p className="mt-1 text-sm leading-5 text-white/70">
            {objective.description}
          </p>
          {objective.xpAwarded !== null && (
            <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary/25 px-2.5 py-1 text-xs font-semibold text-white">
              <Sparkles className="size-3.5" aria-hidden="true" />+
              {objective.xpAwarded} XP
            </p>
          )}
        </div>
      </div>

      <Link
        href={objective.href}
        className={cn(
          buttonVariants({ variant: "secondary", size: "lg" }),
          "mt-5 w-full"
        )}
      >
        {objective.type === "connection" && (
          <ScanLine data-icon="inline-start" aria-hidden="true" />
        )}
        {objective.actionLabel}
        <ChevronRight data-icon="inline-end" aria-hidden="true" />
      </Link>
    </section>
  )
}

function ProgressTrack({
  value,
  label,
  variant = "primary",
}: Readonly<{
  value: number
  label: string
  variant?: "primary" | "success"
}>) {
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/15"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none",
          variant === "success" ? "bg-success" : "bg-primary"
        )}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}
