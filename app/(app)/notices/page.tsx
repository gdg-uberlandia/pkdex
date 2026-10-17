import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { requireAuth } from "@/lib/require-auth"
import { getNoticesForSession } from "@/modules/notices/notice.service"
import { PushPreferences } from "@/modules/notices/push-preferences"

export const metadata = { title: "Avisos" }
export default async function NoticesPage() {
  const notices = await getNoticesForSession(await requireAuth())
  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4">
      <p className="text-sm text-muted-foreground">
        Todos os avisos do evento ficam aqui, mesmo depois de dispensar a
        notificação.
      </p>
      <PushPreferences />
      {!notices.length ? (
        <p className="rounded-2xl border p-6 text-center text-muted-foreground">
          Nenhum aviso publicado ainda.
        </p>
      ) : (
        <ul className="space-y-3">
          {notices.map((notice) => (
            <li key={notice.id}>
              <Link
                href={`/notices/${notice.id}`}
                className="block space-y-2 rounded-2xl border p-4 hover:bg-muted"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold">{notice.title}</h2>
                  {!notice.read && <Badge>Novo</Badge>}
                </div>
                <p className="line-clamp-2 text-sm whitespace-pre-wrap text-muted-foreground">
                  {notice.body}
                </p>
                <time
                  dateTime={notice.createdAt}
                  className="text-xs text-muted-foreground"
                >
                  {new Date(notice.createdAt).toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
