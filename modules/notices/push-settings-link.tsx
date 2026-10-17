"use client"

import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

import { usePushNotifications } from "./use-push-notifications"

export function PushSettingsLink() {
  const push = usePushNotifications()
  if (push.status === "loading" || push.status === "active" || !push.publicKey)
    return null
  return (
    <Link
      href="/profile#notifications"
      className={buttonVariants({
        variant: "outline",
        className:
          "h-auto min-h-11 w-full rounded-2xl text-center whitespace-normal",
      })}
    >
      Configurar notificações no perfil
    </Link>
  )
}
