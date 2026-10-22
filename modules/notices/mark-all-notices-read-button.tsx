"use client"

import { CheckCheck, LoaderCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"

import { markAllNoticesReadAction } from "./notice.actions"

export function MarkAllNoticesReadButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [failed, setFailed] = useState(false)

  function handleClick() {
    setFailed(false)
    startTransition(async () => {
      try {
        const result = await markAllNoticesReadAction()
        if (!result.success) {
          setFailed(true)
          return
        }
        window.dispatchEvent(new Event("focus"))
        router.refresh()
      } catch {
        setFailed(true)
      }
    })
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        className="w-full sm:w-auto"
        disabled={pending}
        onClick={handleClick}
      >
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <CheckCheck className="size-4" aria-hidden="true" />
        )}
        {pending ? "Marcando como lidas…" : "Marcar todas como lidas"}
      </Button>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível marcar todas como lidas. Tente novamente.
        </p>
      )}
    </div>
  )
}
