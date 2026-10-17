import { Skeleton } from "@/components/ui/skeleton"

export default function NoticesLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-2 rounded-full" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-44 rounded-3xl" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <div className="divide-y overflow-hidden rounded-2xl ring-1 ring-foreground/10">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-20 rounded-none" />
          ))}
        </div>
      </div>
    </div>
  )
}
