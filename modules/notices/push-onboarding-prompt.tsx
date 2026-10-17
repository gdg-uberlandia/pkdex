"use client"

import { BellRing, Check } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { Button, buttonVariants } from "@/components/ui/button"

import { usePushNotifications } from "./use-push-notifications"

export function PushOnboardingPrompt() {
  const router = useRouter()
  const push = usePushNotifications()
  useEffect(() => {
    if (push.status === "active" || push.status === "unavailable")
      router.replace("/home")
  }, [push.status, router])
  const loading =
    push.status === "loading" ||
    push.status === "active" ||
    push.status === "unavailable"
  return (
    <section
      className="flex min-h-full flex-col justify-between gap-8 bg-(image:--gradient-immersive) px-6 pt-[max(3rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] text-white"
      aria-labelledby="push-prompt-title"
    >
      <div className="my-auto space-y-6 py-8">
        <span className="inline-flex size-24 items-center justify-center rounded-3xl bg-white/15 ring-1 ring-white/20">
          <BellRing className="size-12" aria-hidden="true" />
        </span>
        <div className="space-y-3">
          <p className="text-sm font-medium text-white/70">
            Seu perfil está pronto!
          </p>
          <h1
            id="push-prompt-title"
            className="text-3xl font-bold tracking-tight"
          >
            Fique por dentro do DevFest
          </h1>
          <p className="leading-relaxed text-white/80">
            Permita as notificações para receber os avisos da organização e
            saber quando as avaliações de palestras forem liberadas.
          </p>
        </div>
        <p className="flex items-start gap-2 text-sm text-white/70">
          <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Você pode mudar essa escolha no seu perfil a qualquer momento.
        </p>
        <p role="status" className="text-sm text-white/80">
          {push.message}
        </p>
      </div>
      <div className="space-y-3">
        {push.status === "blocked" ? (
          <Link
            href="/profile#notifications"
            replace
            className={buttonVariants({
              variant: "secondary",
              className: "w-full",
            })}
          >
            Configurar no perfil
          </Link>
        ) : (
          <Button
            className="w-full"
            variant="secondary"
            disabled={loading || push.busy || !push.canEnable}
            onClick={() =>
              void push.enable().then((enabled) => {
                if (enabled) router.replace("/home")
              })
            }
          >
            {push.busy
              ? "Ativando…"
              : loading
                ? "Aguarde…"
                : "Permitir notificações"}
          </Button>
        )}
        <Button
          className="w-full text-white hover:bg-white/10 hover:text-white"
          variant="ghost"
          disabled={push.busy}
          onClick={() => router.replace("/home")}
        >
          Agora não
        </Button>
      </div>
    </section>
  )
}
