import {
  ChevronRight,
  ScanLine,
  Sparkles,
  UserRoundSearch,
  UsersRound,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { EmptyState } from "@/components/layout/empty-state"
import { buttonVariants } from "@/components/ui/button"
import { SCORES } from "@/config/scores"
import { requireAuth } from "@/lib/require-auth"
import { cn } from "@/lib/utils"
import { listConnectionsForSession } from "@/modules/networking/connection.service"
import { ConnectionCard } from "@/modules/networking/connection-card"

export const metadata: Metadata = {
  title: "Conexões",
}

export const dynamic = "force-dynamic"

export default async function ConnectionsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ result?: string | string[] }>
}>) {
  const [session, query] = await Promise.all([requireAuth(), searchParams])
  const connections = await listConnectionsForSession(session)
  const result = typeof query.result === "string" ? query.result : null

  return (
    <div className="space-y-6 p-6">
      <section className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Conexões</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Conheça participantes e amplie sua rede durante o evento.
        </p>
      </section>

      <ScanResultFeedback result={result} />

      <ConnectionOverview count={connections.length} />

      {connections.length === 0 ? (
        <EmptyState
          className="min-h-56 p-4"
          icon={<UserRoundSearch className="size-8" aria-hidden="true" />}
          title="Nenhuma conexão ainda"
          description="Leia o QR Code de outro participante para criar sua primeira conexão."
        />
      ) : (
        <ConnectionSection title="Minha rede" items={connections} />
      )}
    </div>
  )
}

function ConnectionOverview({ count }: Readonly<{ count: number }>) {
  const earnedXp = count * SCORES.PARTICIPANT_CONNECTION

  return (
    <section className="overflow-hidden rounded-3xl bg-(image:--gradient-immersive) p-5 text-white shadow-card">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
          <UsersRound className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-white/65">
            Sua rede no evento
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums">
            {count} {count === 1 ? "conexão" : "conexões"}
          </p>
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/25 px-2.5 py-1 text-xs font-semibold">
            <Sparkles className="size-3.5" aria-hidden="true" />
            {earnedXp.toLocaleString("pt-BR")} XP conquistados
          </p>
        </div>
      </div>

      <Link
        href="/scan"
        className={cn(
          buttonVariants({ variant: "secondary", size: "lg" }),
          "mt-5 w-full"
        )}
      >
        <ScanLine data-icon="inline-start" aria-hidden="true" />
        Encontrar participante
        <ChevronRight data-icon="inline-end" aria-hidden="true" />
      </Link>
    </section>
  )
}

function ScanResultFeedback({ result }: Readonly<{ result: string | null }>) {
  if (!result) {
    return null
  }

  const messages: Record<string, string> = {
    ALREADY_CONNECTED: "Vocês já estavam conectados.",
    CONNECTION_CREATED: "Conexão criada. Vocês receberam 5 XP.",
    INVALID_EVENT: "Este QR Code pertence a outro evento.",
    INVALID_QR: "Não foi possível validar este QR Code.",
    PROFILE_NOT_FOUND: "O perfil deste participante não está disponível.",
    QR_EXPIRED: "Este QR Code expirou. Peça um código atualizado.",
    EVENT_CLOSED: "O evento foi encerrado. Novas conexões estão bloqueadas.",
    SCAN_COOLDOWN: "Aguarde um minuto antes de tentar novamente.",
    SELF_CONNECTION: "Você não pode se conectar com o próprio perfil.",
  }
  const isSuccess =
    result === "CONNECTION_CREATED" || result === "ALREADY_CONNECTED"

  return (
    <p
      className={
        isSuccess
          ? "rounded-xl bg-success/10 p-4 text-sm text-success"
          : "rounded-xl bg-destructive/10 p-4 text-sm text-destructive"
      }
      role={isSuccess ? "status" : "alert"}
    >
      {messages[result] ?? "Não foi possível processar o QR Code."}
    </p>
  )
}

function ConnectionSection({
  title,
  items,
}: Readonly<{
  title: string
  items: Awaited<ReturnType<typeof listConnectionsForSession>>
}>) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="divide-y divide-border overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
        {items.map((connection) => (
          <ConnectionCard key={connection.id} connection={connection} />
        ))}
      </div>
    </section>
  )
}
