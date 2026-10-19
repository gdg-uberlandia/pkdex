import { Skeleton } from "@/components/ui/skeleton"

export default function ScheduleLoading() {
  return (
    <div className="space-y-7 p-4 sm:p-6" aria-label="Carregando programação">
      <Skeleton className="h-4 w-full max-w-sm" />
      {[1, 2, 3].map((slot) => (
        <div key={slot} className="space-y-3">
          <Skeleton className="h-6 w-44" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        </div>
      ))}
    </div>
  )
}
