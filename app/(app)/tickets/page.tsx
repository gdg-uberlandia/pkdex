import { randomUUID } from "node:crypto"

import { Clock3, Sparkles, Ticket, Zap } from "lucide-react"
import type { Metadata } from "next"

import { TICKET_EXCHANGE_RATE_XP } from "@/config/tickets"
import { requireAuth } from "@/lib/require-auth"
import { findActiveRewards } from "@/modules/rewards/reward.repository"
import { getTicketsForSession } from "@/modules/tickets/ticket.service"
import { TicketConversionForm } from "@/modules/tickets/ticket-conversion-form"
import { TicketIntroductionDialog } from "@/modules/tickets/ticket-introduction-dialog"

export const metadata: Metadata = { title: "Tickets" }
export const dynamic = "force-dynamic"

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

export default async function TicketsPage() {
  const session = await requireAuth()
  const tickets = await getTicketsForSession(session)

  if (!tickets.available) {
    return (
      <section className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="rounded-full bg-gamification/10 p-4 text-gamification">
          <Ticket className="size-8" aria-hidden="true" />
        </span>
        <div className="max-w-sm space-y-2">
          <h1 className="text-xl font-semibold">Tickets de participantes</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Esta área está disponível somente para participantes do evento.
          </p>
        </div>
      </section>
    )
  }

  const rewards = await findActiveRewards(tickets.eventId)
  const conversionIdempotencyKey = randomUUID()

  return (
    <div className="space-y-6 p-6">
      <TicketIntroductionDialog
        storageScope={`${tickets.eventId}:${tickets.participantId}`}
      />

      <section className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Seus tickets</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Converta XP disponível em chances para brindes e sorteios.
        </p>
      </section>

      <TicketBalanceOverview
        balance={tickets.ticketBalance}
        convertibleXp={tickets.convertibleXp}
        convertibleTickets={tickets.convertibleTickets}
      />

      <section className="space-y-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
        <div>
          <h2 className="font-semibold">Converter XP</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Cada {TICKET_EXCHANGE_RATE_XP} XP disponíveis equivalem a um ticket.
            Seu nível e sua posição no ranking não diminuem.
          </p>
        </div>

        {!tickets.conversionEnabled ? (
          <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
            As conversões estão temporariamente bloqueadas pela organização.
          </p>
        ) : tickets.convertibleTickets === 0 ? (
          <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
            Acumule pelo menos {TICKET_EXCHANGE_RATE_XP} XP disponíveis para
            realizar uma conversão.
          </p>
        ) : (
          <TicketConversionForm
            key={conversionIdempotencyKey}
            convertibleTickets={tickets.convertibleTickets}
            idempotencyKey={conversionIdempotencyKey}
          />
        )}
      </section>

      <section
        aria-labelledby="reward-ticket-reference-title"
        className="space-y-3 rounded-2xl bg-card p-5 ring-1 ring-foreground/10"
      >
        <div>
          <h2 id="reward-ticket-reference-title" className="font-semibold">
            Quanto vale cada brinde?
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Use estes valores como referência para planejar suas trocas na
            lojinha. Os resgates dependem da disponibilidade dos brindes.
          </p>
        </div>
        {rewards.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum brinde está disponível no momento.
          </p>
        )}
        <dl className="divide-y divide-border">
          {rewards.map((reward) => (
            <div
              key={reward.id}
              className="flex items-center justify-between gap-4 py-2.5 text-sm"
            >
              <dt>{reward.name}</dt>
              <dd className="shrink-0 font-semibold text-gamification tabular-nums">
                {reward.ticketCost}{" "}
                {reward.ticketCost === 1 ? "ticket" : "tickets"}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Histórico</h2>
        <div className="divide-y divide-border overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
          {tickets.transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex min-h-16 items-center gap-3 px-4 py-3"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-gamification/10 text-gamification">
                {transaction.type === "xp_conversion" ? (
                  <Zap className="size-5" aria-hidden="true" />
                ) : (
                  <Ticket className="size-5" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {transaction.type === "onboarding_grant"
                    ? "Ticket inicial"
                    : transaction.type === "xp_conversion"
                      ? "Conversão de XP"
                      : transaction.type === "reward_redemption"
                        ? "Resgate de brinde"
                        : transaction.referenceType === "raffle_winner"
                          ? "Tickets consumidos no sorteio"
                          : "Ajuste de tickets"}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock3 className="size-3" aria-hidden="true" />
                  {dateFormatter.format(transaction.createdAt)}
                </p>
              </div>
              <span
                className={`font-pixel-square text-sm tabular-nums ${
                  transaction.ticketDelta > 0
                    ? "text-gamification"
                    : "text-muted-foreground"
                }`}
              >
                {transaction.ticketDelta > 0 ? "+" : ""}
                {transaction.ticketDelta}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function TicketBalanceOverview({
  balance,
  convertibleXp,
  convertibleTickets,
}: Readonly<{
  balance: number
  convertibleXp: number
  convertibleTickets: number
}>) {
  return (
    <section className="overflow-hidden rounded-3xl bg-(image:--gradient-gamification) p-5 text-gamification-foreground shadow-glow-gamification">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium opacity-75">Saldo disponível</p>
          <p className="mt-2 font-pixel-square text-4xl tabular-nums">
            {balance}
          </p>
          <p className="mt-1 text-sm font-medium">
            {balance === 1 ? "ticket" : "tickets"}
          </p>
        </div>
        <span className="flex size-14 items-center justify-center rounded-2xl bg-black/10">
          <Ticket className="size-8" aria-hidden="true" />
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 divide-x divide-black/10 rounded-2xl bg-black/10">
        <div className="p-3">
          <p className="flex items-center gap-1 text-xs font-medium opacity-75">
            <Zap className="size-3.5" aria-hidden="true" />
            XP conversível
          </p>
          <p className="mt-1 font-pixel-square text-lg tabular-nums">
            {convertibleXp.toLocaleString("pt-BR")}
          </p>
        </div>
        <div className="p-3">
          <p className="flex items-center gap-1 text-xs font-medium opacity-75">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Pode gerar
          </p>
          <p className="mt-1 font-pixel-square text-lg tabular-nums">
            {convertibleTickets}{" "}
            <span className="font-sans text-xs font-medium">
              {convertibleTickets === 1 ? "ticket" : "tickets"}
            </span>
          </p>
        </div>
      </div>
    </section>
  )
}
