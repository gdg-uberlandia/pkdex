"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"

function decodeKey(value: string) {
  const decoded = atob(value.replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0))
}
async function waitForWorker() {
  const registration = await navigator.serviceWorker.register("/sw.js")
  await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Recarregue a página e tente novamente.")),
        15000
      )
    ),
  ])
  return registration
}
export function PushPreferences() {
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("Verificando suporte a notificações…")
  useEffect(() => {
    let active = true
    async function initialize() {
      if (
        !window.isSecureContext ||
        !("Notification" in window) ||
        !("PushManager" in window) ||
        !("serviceWorker" in navigator)
      ) {
        if (active)
          setMessage(
            "Este navegador não oferece push aqui. No iPhone, adicione a Pokedex à Tela de Início e abra por lá. Os avisos continuam disponíveis abaixo."
          )
        return
      }
      const response = await fetch("/api/notices/subscription")
      if (!response.ok)
        throw new Error("Não foi possível verificar as notificações.")
      const data: { enabled: boolean; publicKey: string | null } =
        await response.json()
      if (!active) return
      setPublicKey(data.publicKey)
      if (!data.enabled) {
        setMessage(
          "As notificações push estão desativadas pela organização. Os avisos continuam disponíveis abaixo."
        )
        return
      }
      if (!data.publicKey) {
        setMessage(
          "Push ainda não está configurado. Você pode consultar todos os avisos abaixo."
        )
        return
      }
      const registration = await waitForWorker()
      const subscription = await registration.pushManager.getSubscription()
      if (!active) return
      if (subscription && Notification.permission === "granted") {
        const saved = await fetch("/api/notices/subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: subscription.toJSON().keys,
          }),
        })
        if (!saved.ok) throw new Error("Inscrição não sincronizada")
      }
      if (!active) return
      setEnabled(Boolean(subscription) && Notification.permission === "granted")
      setMessage(
        Notification.permission === "denied"
          ? "As notificações estão bloqueadas. Para ativar, altere a permissão nas configurações do navegador."
          : "Receba também notificações neste dispositivo. Dispensar o push não remove o aviso."
      )
    }
    void initialize().catch(() => {
      if (active)
        setMessage(
          "Não foi possível verificar o push. Recarregue para tentar novamente."
        )
    })
    return () => {
      active = false
    }
  }, [])
  async function toggle() {
    if (!publicKey) return
    setBusy(true)
    try {
      // Permission must be requested directly from the user's click.
      if (!enabled && (await Notification.requestPermission()) !== "granted")
        throw new Error(
          "Permissão não concedida. Os avisos continuam disponíveis na Pokedex."
        )
      const registration = await waitForWorker()
      let subscription = await registration.pushManager.getSubscription()
      if (enabled) {
        if (subscription) {
          const response = await fetch("/api/notices/subscription", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              endpoint: subscription.endpoint,
              keys: subscription.toJSON().keys,
            }),
          })
          if (!response.ok)
            throw new Error("Não foi possível desativar. Tente novamente.")
          await subscription.unsubscribe()
        }
        setEnabled(false)
        setMessage("Notificações desativadas neste dispositivo.")
      } else {
        if (!subscription)
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: decodeKey(publicKey),
          })
        const response = await fetch("/api/notices/subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: subscription.toJSON().keys,
          }),
        })
        if (!response.ok)
          throw new Error(
            "Não foi possível salvar a inscrição. Tente ativar novamente."
          )
        setEnabled(true)
        setMessage("Notificações ativadas neste dispositivo.")
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar as notificações."
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="space-y-3 rounded-2xl border p-4">
      <h2 className="font-semibold">Notificações no dispositivo</h2>
      <p role="status" className="text-sm text-muted-foreground">
        {message}
      </p>
      {publicKey && (
        <Button variant="outline" disabled={busy} onClick={() => void toggle()}>
          {busy
            ? "Aguarde…"
            : enabled
              ? "Desativar push neste dispositivo"
              : "Ativar notificações"}
        </Button>
      )}
    </section>
  )
}
