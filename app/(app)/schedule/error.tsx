"use client"

import { RouteErrorState } from "@/components/layout/route-error-state"

export default function ScheduleError({
  reset,
}: Readonly<{ reset: () => void }>) {
  return (
    <RouteErrorState
      title="Não foi possível carregar a programação"
      description="Confira sua conexão e tente carregar a programação novamente."
      reset={reset}
    />
  )
}
