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
      className={buttonVariants({ variant: "outline" })}
    >
      Configurar notificações no perfil
    </Link>
  )
}
