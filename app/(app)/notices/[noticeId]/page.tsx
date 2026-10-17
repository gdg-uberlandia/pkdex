import { ArrowUpRight, BellOff, Clock3, Megaphone } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { EmptyState } from "@/components/layout/empty-state"
import { buttonVariants } from "@/components/ui/button"
import { requireAuth } from "@/lib/require-auth"
import { noticeIdSchema } from "@/modules/notices/notice.schema"
import { getNoticeForSession } from "@/modules/notices/notice.service"
import { NoticeReadMarker } from "@/modules/notices/notice-read-marker"
import { NoticeTimestamp } from "@/modules/notices/notice-timestamp"

export const metadata = { title: "Aviso" }
export default async function NoticePage({
  params,
}: {
  params: Promise<{ noticeId: string }>
}) {
  const { noticeId } = await params
  if (!noticeIdSchema.safeParse(noticeId).success) notFound()
  const notice = await getNoticeForSession(await requireAuth(), noticeId)
  if (!notice)
    return (
      <EmptyState
        icon={<BellOff className="size-8" aria-hidden="true" />}
        title="Aviso não disponível"
        description="Este aviso foi removido ou não está mais disponível. Confira os outros recados do evento."
        action={
          <Link href="/notices" replace className={buttonVariants()}>
            Ver avisos
          </Link>
        }
      />
    )
  return (
    <div className="p-6">
      <article className="overflow-hidden rounded-3xl bg-card shadow-card ring-1 ring-foreground/5">
        <header className="relative overflow-hidden bg-(image:--gradient-immersive) p-5 text-white">
          <Megaphone
            className="pointer-events-none absolute -top-5 -right-5 size-36 -rotate-12 text-white/5"
            strokeWidth={1.25}
            aria-hidden="true"
          />
          <div className="relative space-y-5">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary/15 text-secondary ring-1 ring-secondary/20">
                <Megaphone className="size-5" aria-hidden="true" />
              </span>
              <p className="text-xs font-medium text-white/70">
                Comunicado da organização
              </p>
            </div>
            <h1 className="text-2xl leading-tight font-bold tracking-tight break-words">
              {notice.title}
            </h1>
            <div className="flex items-center gap-1.5 text-white/60">
              <Clock3 className="size-3" aria-hidden="true" />
              <NoticeTimestamp value={notice.createdAt} />
            </div>
          </div>
        </header>
        <div className="space-y-6 p-5">
          <p className="text-sm leading-7 break-words whitespace-pre-wrap text-foreground/85">
            {notice.body}
          </p>
          {notice.link && (
            <div className="border-t border-border/70 pt-5">
              <Link
                href={notice.link}
                className={buttonVariants({
                  className: "w-full gap-2 rounded-2xl",
                })}
              >
                Acessar conteúdo
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      </article>
      <NoticeReadMarker id={notice.id} />
    </div>
  )
}
