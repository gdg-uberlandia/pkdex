import { Bell, ChevronRight, Clock3, MailOpen, Megaphone } from "lucide-react"
import Link from "next/link"

import { requireAuth } from "@/lib/require-auth"
import { cn } from "@/lib/utils"
import { MarkAllNoticesReadButton } from "@/modules/notices/mark-all-notices-read-button"
import { getNoticesForSession } from "@/modules/notices/notice.service"
import { NoticeTimestamp } from "@/modules/notices/notice-timestamp"
import { PushSettingsLink } from "@/modules/notices/push-settings-link"

export const metadata = { title: "Avisos" }
export default async function NoticesPage() {
  const notices = await getNoticesForSession(await requireAuth())
  const unread = notices.filter((notice) => !notice.read).length
  return (
    <div className="space-y-6 p-6">
      <section className="relative overflow-hidden rounded-3xl bg-(image:--gradient-immersive) p-5 text-white shadow-card">
        <Megaphone
          className="pointer-events-none absolute -right-4 -bottom-5 size-32 -rotate-12 text-white/5"
          strokeWidth={1.25}
          aria-hidden="true"
        />
        <div className="relative flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary/15 text-secondary ring-1 ring-secondary/20">
            <Bell className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-1">
            <h1 className="text-xl font-bold tracking-tight">
              Fique por dentro
            </h1>
            <p className="text-sm leading-5 text-white/70">
              Os recados da organização, sempre à mão.
            </p>
            {unread > 0 && (
              <p className="pt-2 text-xs font-medium text-secondary">
                {unread === 1
                  ? "Você tem 1 aviso não lido"
                  : `Você tem ${unread} avisos não lidos`}
              </p>
            )}
          </div>
        </div>
      </section>
      <PushSettingsLink />
      {!notices.length ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-card px-5 py-10 text-center shadow-card ring-1 ring-foreground/5">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MailOpen className="size-6" aria-hidden="true" />
          </span>
          <h2 className="font-semibold">Tudo em dia por aqui</h2>
          <p className="max-w-60 text-sm leading-6 text-muted-foreground">
            Os avisos do evento aparecerão aqui quando forem publicados.
          </p>
        </div>
      ) : (
        <section className="space-y-3" aria-labelledby="notice-list-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="notice-list-title" className="text-lg font-semibold">
              Recados do evento
            </h2>
            <span className="text-xs text-muted-foreground">
              {notices.length} {notices.length === 1 ? "aviso" : "avisos"}
            </span>
          </div>
          {unread > 0 && <MarkAllNoticesReadButton />}
          <ul className="space-y-3">
            {notices.map((notice) => {
              const Icon = notice.read ? MailOpen : Bell
              return (
                <li key={notice.id}>
                  <Link
                    href={`/notices/${notice.id}`}
                    className={cn(
                      "group relative flex items-start gap-3 overflow-hidden rounded-3xl bg-card p-4 shadow-card ring-1 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      notice.read ? "ring-foreground/5" : "ring-primary/25"
                    )}
                  >
                    {!notice.read && (
                      <span
                        className="absolute inset-y-5 left-0 w-1 rounded-r-full bg-primary"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-2xl",
                        notice.read
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary/10 text-primary"
                      )}
                    >
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm leading-5 font-semibold break-words">
                          {notice.title}
                        </h3>
                        {!notice.read && (
                          <span className="shrink-0 rounded-full bg-secondary/20 px-2 py-0.5 text-tiny font-semibold text-accent-foreground">
                            Novo
                          </span>
                        )}
                      </div>
                      <p className="line-clamp-2 text-xs leading-5 break-words whitespace-pre-wrap text-muted-foreground">
                        {notice.body}
                      </p>
                      <div className="flex items-center justify-between gap-2 pt-1 text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="size-3" aria-hidden="true" />
                          <NoticeTimestamp value={notice.createdAt} />
                        </span>
                        <ChevronRight
                          className="size-4 text-primary transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
