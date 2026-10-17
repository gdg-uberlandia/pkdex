import Link from "next/link"
import { notFound } from "next/navigation"

import { buttonVariants } from "@/components/ui/button"
import { requireAuth } from "@/lib/require-auth"
import { noticeIdSchema } from "@/modules/notices/notice.schema"
import { getNoticeForSession } from "@/modules/notices/notice.service"
import { NoticeReadMarker } from "@/modules/notices/notice-read-marker"

export const metadata = { title: "Aviso" }
export default async function NoticePage({
  params,
}: {
  params: Promise<{ noticeId: string }>
}) {
  const { noticeId } = await params
  if (!noticeIdSchema.safeParse(noticeId).success) notFound()
  const notice = await getNoticeForSession(await requireAuth(), noticeId)
  if (!notice) notFound()
  return (
    <article className="mx-auto max-w-3xl space-y-5 p-5">
      <h1 className="text-2xl font-bold">{notice.title}</h1>
      <time
        dateTime={notice.createdAt}
        className="text-sm text-muted-foreground"
      >
        {new Date(notice.createdAt).toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        })}
      </time>
      <p className="leading-relaxed break-words whitespace-pre-wrap">
        {notice.body}
      </p>
      {notice.link && (
        <Link href={notice.link} className={buttonVariants()}>
          Acessar conteúdo
        </Link>
      )}
      <NoticeReadMarker id={notice.id} />
    </article>
  )
}
