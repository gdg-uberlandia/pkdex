import {
  CheckCircle2,
  Clock3,
  LockKeyhole,
  MapPin,
  MessageSquareText,
  Mic2,
  Sparkles,
  Star,
} from "lucide-react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { requireAuth } from "@/lib/require-auth"
import {
  formatScheduleInterval,
  formatScheduleLocation,
} from "@/modules/schedule/schedule-format"
import { getTalkDetailsForSession } from "@/modules/talks/talk.service"
import { TalkRatingForm } from "@/modules/talks/talk-rating-form"

type TalkDetailsPageProps = Readonly<{
  params: Promise<{ talkId: string }>
}>

export const metadata: Metadata = { title: "Palestra" }
export const dynamic = "force-dynamic"

const formatLabels = {
  talk: "Palestra",
  panel: "Painel",
  keynote: "Keynote",
  workshop: "Workshop",
} as const

export default async function TalkDetailsPage({
  params,
}: TalkDetailsPageProps) {
  const [{ talkId }, session] = await Promise.all([params, requireAuth()])
  const talk = await getTalkDetailsForSession(session, talkId)

  if (!talk) {
    notFound()
  }

  return (
    <div className="space-y-6 p-6">
      <section className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge className="border-transparent bg-(image:--gradient-primary-card) text-primary-foreground">
            {formatLabels[talk.format]}
          </Badge>
          {talk.category && <Badge variant="outline">{talk.category}</Badge>}
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{talk.title}</h1>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
            <Clock3 className="size-4" aria-hidden="true" />
            {formatScheduleInterval(talk.schedule.startAt, talk.schedule.endAt)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
            <MapPin className="size-4" aria-hidden="true" />
            {formatScheduleLocation(
              talk.schedule.track,
              talk.schedule.activityType
            )}
          </span>
        </div>
        <p className="text-sm leading-6 whitespace-pre-wrap text-muted-foreground">
          {talk.description}
        </p>
      </section>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>
            {talk.speakers.length > 1 ? "Palestrantes" : "Palestrante"}
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {talk.speakers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Palestrante a confirmar.
            </p>
          ) : (
            talk.speakers.map((speaker) => (
              <article
                key={speaker.id}
                className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
              >
                <Avatar className="size-16">
                  <AvatarImage
                    src={speaker.photoUrl ?? undefined}
                    alt={`Foto de ${speaker.name}`}
                  />
                  <AvatarFallback>
                    <Mic2 aria-hidden="true" />
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{speaker.name}</h2>
                  {(speaker.title || speaker.company) && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {[speaker.title, speaker.company]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
              </article>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle>Avaliação</CardTitle>
        </CardHeader>
        <CardContent>
          {talk.rating ? (
            <div className="space-y-4 rounded-2xl bg-success/5 p-4 ring-1 ring-success/20">
              <p className="flex items-center gap-2 font-medium text-success">
                <CheckCircle2 className="size-5" aria-hidden="true" />
                Avaliação concluída
              </p>
              <p className="text-sm text-muted-foreground">
                Obrigado pelo feedback. Você recebeu {talk.rating.xpAwarded} XP
                por esta avaliação.
              </p>
              <dl className="grid grid-cols-3 gap-2 text-center">
                {[
                  ["Palestrante", talk.rating.speakerRating],
                  ["Conteúdo", talk.rating.contentRating],
                  ["Acompanhamento", talk.rating.comprehensionRating],
                ].map(([label, score]) => (
                  <div key={label} className="rounded-xl bg-muted p-2.5">
                    <dt className="text-[11px] text-muted-foreground">
                      {label}
                    </dt>
                    <dd className="mt-1 flex items-center justify-center gap-1 font-semibold">
                      <Star
                        className="size-3.5 fill-[#F6F118] text-[#8B8700] dark:text-[#F6F118]"
                        aria-hidden="true"
                      />
                      {score}/5
                    </dd>
                  </div>
                ))}
              </dl>
              <blockquote className="rounded-xl border-l-4 border-primary bg-primary/5 p-3 text-sm leading-6 text-muted-foreground">
                {talk.rating.comment}
              </blockquote>
            </div>
          ) : talk.evaluationStatus === "open" && talk.canEvaluate ? (
            <div className="space-y-5">
              <p className="flex items-center gap-2 rounded-xl bg-[#8BFF3D]/12 p-3 text-sm font-medium text-[#3F7800] dark:text-[#AFFF78]">
                <Sparkles className="size-4" aria-hidden="true" />
                Complete a avaliação para receber XP.
              </p>
              <TalkRatingForm talkId={talk.id} />
            </div>
          ) : talk.evaluationStatus === "open" ? (
            <div className="flex items-start gap-3 rounded-2xl bg-[#8BFF3D]/10 p-4">
              <MessageSquareText
                className="mt-0.5 size-5 shrink-0 text-[#3F7800] dark:text-[#AFFF78]"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">Avaliação disponível</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Somente contas participantes podem enviar avaliações e receber
                  XP.
                </p>
              </div>
            </div>
          ) : (
            <div
              className={
                talk.evaluationStatus === "locked"
                  ? "flex items-start gap-3 rounded-2xl bg-amber-500/10 p-4"
                  : "flex items-start gap-3 rounded-2xl bg-destructive/10 p-4"
              }
            >
              {talk.evaluationStatus === "locked" ? (
                <LockKeyhole
                  className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300"
                  aria-hidden="true"
                />
              ) : (
                <MessageSquareText
                  className="mt-0.5 size-5 shrink-0 text-destructive"
                  aria-hidden="true"
                />
              )}
              <div>
                <p className="font-medium">
                  {talk.evaluationStatus === "locked"
                    ? "Avaliação ainda não liberada"
                    : "Avaliação encerrada"}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {talk.evaluationStatus === "locked"
                    ? "A organização avisará quando esta avaliação estiver disponível."
                    : "Esta apresentação não aceita mais avaliações."}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
