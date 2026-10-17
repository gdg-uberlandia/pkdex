"use client"

import { RouteErrorState } from "@/components/layout/route-error-state"

export default function NoticesError({
  reset,
}: Readonly<{ reset: () => void }>) {
  return (
    <RouteErrorState
      title="Não foi possível carregar os avisos"
      description="Confira sua conexão e tente carregar os avisos novamente."
      reset={reset}
    />
  )
}
