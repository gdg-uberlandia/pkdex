import {
  CheckCircle2,
  LockKeyhole,
  ScanLine,
  Sparkles,
  Tags,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { EmptyState } from "@/components/layout/empty-state"
import {
  CollectionEntryMotion,
  SpringProgress,
} from "@/components/motion/collection-motion"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
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
import { requireAuth } from "@/lib/require-auth"
import { cn } from "@/lib/utils"
import {
  listTagsForSession,
  type TagCollectionItem,
} from "@/modules/tags/tag.service"

export const metadata: Metadata = {
  title: "Tags",
}

export const dynamic = "force-dynamic"

export default async function TagsPage() {
  const session = await requireAuth()
  const collection = await listTagsForSession(session)

  if (collection.totalCount === 0) {
    return (
      <EmptyState
        icon={<Tags className="size-8" aria-hidden="true" />}
        title="Nenhuma tag disponível"
        description="As tags escondidas aparecerão aqui quando a busca começar."
      />
    )
  }

  const progress = (collection.discoveredCount / collection.totalCount) * 100
  const latestDiscovery = collection.items
    .filter((item) => item.status === "discovered")
    .sort(
      (first, second) =>
        second.discoveredAt.getTime() - first.discoveredAt.getTime()
    )[0]

  return (
    <div className="space-y-6 p-6">
      <section className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Tags escondidas</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Procure os QR Codes espalhados pelo evento e revele toda a coleção.
        </p>
      </section>

      {!collection.discoveryEnabled && (
        <p
          role="status"
          className="rounded-xl bg-warning/15 p-4 text-sm text-warning"
        >
          A organização pausou novas descobertas de tags. Sua coleção continua
          disponível.
        </p>
      )}

      <section className="space-y-2" aria-label="Progresso da coleção">
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="font-medium">Sua coleção</p>
          <p className="text-muted-foreground tabular-nums">
            {collection.discoveredCount} de {collection.totalCount} encontradas
          </p>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Tags encontradas"
          aria-valuemin={0}
          aria-valuemax={collection.totalCount}
          aria-valuenow={collection.discoveredCount}
        >
          <SpringProgress progress={progress} className="bg-primary" />
        </div>
      </section>

      <TagCollectionHighlight
        latestDiscovery={latestDiscovery ?? null}
        remaining={collection.totalCount - collection.discoveredCount}
      />

      <section className="space-y-3" aria-labelledby="tag-collection-title">
        <h2 id="tag-collection-title" className="text-lg font-semibold">
          Sua coleção
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {collection.items.map((item) => (
            <TagSlot
              key={item.slot}
              item={item}
              isLatest={
                item.status === "discovered" &&
                item.slot === latestDiscovery?.slot
              }
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function TagCollectionHighlight({
  latestDiscovery,
  remaining,
}: Readonly<{
  latestDiscovery: Extract<TagCollectionItem, { status: "discovered" }> | null
  remaining: number
}>) {
  return (
    <section className="overflow-hidden rounded-3xl bg-(image:--gradient-immersive) p-5 text-white shadow-card">
      <div className="flex items-start gap-4">
        {latestDiscovery ? (
          <Avatar className="size-16 shrink-0 rounded-2xl bg-white">
            <AvatarImage
              src={latestDiscovery.imageUrl}
              alt=""
              className="rounded-2xl object-contain"
            />
            <AvatarFallback className="rounded-2xl">TAG</AvatarFallback>
          </Avatar>
        ) : (
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white/10">
            <Tags className="size-7" aria-hidden="true" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-white/65">
            {latestDiscovery ? "Última descoberta" : "Comece a caça"}
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            {latestDiscovery?.name ?? "Encontre sua primeira tag"}
          </h2>
          <p className="mt-1 text-sm leading-5 text-white/70">
            {remaining === 0
              ? "Você revelou toda a coleção escondida."
              : `${remaining} ${remaining === 1 ? "tag ainda está escondida" : "tags ainda estão escondidas"} pelo evento.`}
          </p>
          {latestDiscovery && (
            <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary/25 px-2.5 py-1 text-xs font-semibold">
              <Sparkles className="size-3.5" aria-hidden="true" />+
              {latestDiscovery.xpAwarded} XP
            </p>
          )}
        </div>
      </div>

      {remaining > 0 && (
        <Link
          href="/scan"
          className={cn(
            buttonVariants({ variant: "secondary", size: "lg" }),
            "mt-5 w-full"
          )}
        >
          <ScanLine data-icon="inline-start" aria-hidden="true" />
          Abrir scanner
        </Link>
      )}
    </section>
  )
}

function TagSlot({
  item,
  isLatest,
}: Readonly<{ item: TagCollectionItem; isLatest: boolean }>) {
  if (item.status === "locked") {
    return (
      <article className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/40 p-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <LockKeyhole className="size-6" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-sm font-medium">Tag #{item.slot}</h3>
          <p className="mt-1 text-xs text-muted-foreground">Ainda escondida</p>
        </div>
      </article>
    )
  }

  return (
    <CollectionEntryMotion
      achievementKey={`tags-page:${item.slot}:${item.discoveredAt.getTime()}`}
      completedAt={item.discoveredAt.getTime()}
      enabled={isLatest}
      variant="card"
      className="h-full"
    >
      <Dialog>
        <DialogTrigger
          render={
            <button
              type="button"
              className="relative flex min-h-44 w-full touch-manipulation flex-col items-center gap-2 rounded-2xl bg-card p-3 text-center ring-1 ring-foreground/10 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={`Ver detalhes da tag ${item.name}`}
            />
          }
        >
          <CheckCircle2
            className="absolute top-3 right-3 size-4 text-success"
            aria-label="Encontrada"
          />
          <Avatar className="size-16 rounded-2xl">
            <AvatarImage
              src={item.imageUrl}
              alt=""
              className="rounded-2xl object-contain"
            />
            <AvatarFallback className="rounded-2xl">TAG</AvatarFallback>
          </Avatar>

          <span className="min-w-0">
            <span className="line-clamp-2 text-sm font-semibold">
              {item.name}
            </span>
            {item.description && (
              <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {item.description}
              </span>
            )}
          </span>

          <span className="mt-auto text-xs font-medium text-primary">
            +{item.xpAwarded} XP
          </span>
        </DialogTrigger>

        <DialogContent
          className="block overflow-hidden rounded-3xl bg-[#070b18] p-0 text-white ring-white/10 sm:max-w-sm"
          showCloseButton={false}
        >
          <div className="flex min-h-64 items-center justify-center bg-[#070b18] p-8">
            <Avatar className="size-40 rounded-2xl bg-transparent">
              <AvatarImage
                src={item.imageUrl}
                alt={`Imagem da tag ${item.name}`}
                className="rounded-2xl object-contain"
              />
              <AvatarFallback className="rounded-2xl bg-white/10 text-white">
                TAG
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="relative -mt-5 space-y-4 rounded-t-[2rem] bg-[#0d1324] p-4 pt-6">
            <DialogHeader>
              <div className="flex items-start gap-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-violet-400/15 text-violet-300 ring-1 ring-violet-300/20">
                  <Tags className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-xl leading-snug text-white">
                    {item.name}
                  </DialogTitle>
                  <Badge className="mt-1.5 border-violet-300/25 bg-violet-400/15 text-violet-200">
                    <CheckCircle2 aria-hidden="true" />
                    Encontrada
                  </Badge>
                </div>
              </div>
              <DialogDescription className="pt-1 leading-6 whitespace-pre-wrap text-white/65">
                {item.description ||
                  "Esta tag não possui uma descrição cadastrada."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10">
              <div className="bg-white/5 p-4">
                <p className="text-xs font-medium text-white/50">Recompensa</p>
                <p className="mt-2 text-xl font-bold text-violet-300">
                  +{item.xpAwarded} XP
                </p>
              </div>
              <div className="bg-white/5 p-4">
                <p className="text-xs font-medium text-white">Tag encontrada</p>
                <p className="mt-2 text-sm leading-5 text-white/60">
                  Descoberta em{" "}
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(item.discoveredAt)}
                  .
                </p>
              </div>
            </div>

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
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </CollectionEntryMotion>
  )
}
