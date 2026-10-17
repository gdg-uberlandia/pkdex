"use client"

import { useEffect, useRef } from "react"

import { Button } from "@/components/ui/button"

import { usePushNotifications } from "./use-push-notifications"

export function PushPreferences() {
  const push = usePushNotifications()
  const section = useRef<HTMLElement>(null)
  useEffect(() => {
    if (push.status === "loading") return
    let frame = 0
    function scrollToSettings() {
      if (window.location.hash !== "#notifications") return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const target = section.current
        const container = target?.closest<HTMLElement>("#main-content")
        if (!target || !container) return
        const margin =
          Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0
        container.scrollTo({
          top: Math.max(
            0,
            container.scrollTop +
              target.getBoundingClientRect().top -
              container.getBoundingClientRect().top -
              margin
          ),
          behavior: "instant",
        })
      })
    }
    scrollToSettings()
    window.addEventListener("hashchange", scrollToSettings)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("hashchange", scrollToSettings)
    }
  }, [push.status])
  return (
    <section
      ref={section}
      id="notifications"
      className="scroll-mt-6 space-y-3 rounded-2xl border p-4"
      aria-labelledby="notification-preferences-title"
    >
      <h2 id="notification-preferences-title" className="font-semibold">
        Notificações
      </h2>
      <p role="status" className="text-sm text-muted-foreground">
        {push.message}
      </p>
      {push.publicKey && push.status !== "active" && (
        <aside
          className="space-y-3 rounded-xl bg-muted p-4"
          aria-labelledby="iphone-push-help-title"
        >
          <h3 id="iphone-push-help-title" className="text-sm font-semibold">
            Usa iPhone? Adicione à Tela de Início
          </h3>
          <p className="text-sm text-muted-foreground">
            No iPhone, é necessário adicionar a Pokedex à Tela de Início e abrir
            pelo ícone para permitir as notificações. Faça isso pelo Chrome:
          </p>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Abra a Pokedex no Chrome do iPhone.</li>
            <li>
              Use <strong>Compartilhar</strong>, junto à barra de endereço
              (quadrado com seta para cima).
            </li>
            <li>
              Escolha <strong>Adicionar à Tela de Início</strong> e confirme em{" "}
              <strong>Adicionar</strong>. Se aparecer{" "}
              <strong>Abrir como App da Web</strong>, mantenha ativado.
            </li>
            <li>Volte à Tela de Início e abra pelo novo ícone da Pokedex.</li>
            <li>
              Entre na sua conta, vá a <strong>Perfil → Notificações</strong> e
              toque em <strong>Ativar notificações</strong>. Confirme{" "}
              <strong>Permitir</strong> quando o iPhone perguntar.
            </li>
          </ol>
          <a
            href="https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DiOS&hl=pt-BR"
            target="_blank"
            rel="noreferrer"
            className="inline-block text-sm font-medium text-primary underline underline-offset-4"
          >
            Ver orientação do Chrome
          </a>
        </aside>
      )}
      {(push.canEnable || push.status === "active") && (
        <Button
          className="w-full"
          variant="outline"
          disabled={push.busy}
          onClick={() =>
            void (push.status === "active" ? push.disable() : push.enable())
          }
        >
          {push.busy
            ? "Aguarde…"
            : push.status === "active"
              ? "Desativar push neste dispositivo"
              : "Ativar notificações"}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        Esta preferência vale apenas para este dispositivo. Todos os avisos
        continuam disponíveis na Pokedex.
      </p>
    </section>
  )
}
