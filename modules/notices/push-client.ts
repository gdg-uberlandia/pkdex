export type PushStatus =
  "loading" | "active" | "inactive" | "blocked" | "unavailable" | "error"
export type PushState = {
  status: PushStatus
  publicKey: string | null
  message: string
}

export const INITIAL_PUSH_STATE: PushState = {
  status: "loading",
  publicKey: null,
  message: "Verificando notificações neste dispositivo…",
}

async function pushFetch(input: string, init?: RequestInit) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch {
    throw new Error(
      controller.signal.aborted
        ? "A verificação demorou mais que o esperado. Tente novamente."
        : "Não foi possível conectar ao serviço de notificações. Confira sua conexão e tente novamente."
    )
  } finally {
    clearTimeout(timer)
  }
}

function decodeKey(value: string) {
  const decoded = atob(value.replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0))
}
async function waitForWorker() {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      (async () => {
        const registration = await navigator.serviceWorker.register("/sw.js")
        await navigator.serviceWorker.ready
        return registration
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Recarregue a página e tente novamente.")),
          15000
        )
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}
async function syncSubscription(
  subscription: PushSubscription,
  remove = false
) {
  const response = await pushFetch("/api/notices/subscription", {
    method: remove ? "DELETE" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: subscription.toJSON().keys,
    }),
  })
  if (!response.ok)
    throw new Error(
      remove
        ? "Não foi possível desativar. Tente novamente."
        : "Não foi possível salvar a inscrição. Tente ativar novamente."
    )
}
export async function loadPushState(sync = true): Promise<PushState> {
  const response = await pushFetch("/api/notices/subscription", {
    cache: "no-store",
  })
  if (response.status === 401 || response.redirected)
    throw new Error(
      "Sua sessão expirou. Entre novamente para configurar as notificações."
    )
  if (!response.ok)
    throw new Error(
      "O serviço de notificações está indisponível no momento. Tente novamente."
    )
  let raw: unknown
  try {
    raw = await response.json()
  } catch {
    throw new Error(
      "Não foi possível ler a configuração de notificações. Recarregue a página e tente novamente."
    )
  }
  if (
    !raw ||
    typeof raw !== "object" ||
    !("enabled" in raw) ||
    typeof raw.enabled !== "boolean" ||
    !("publicKey" in raw) ||
    (raw.publicKey !== null && typeof raw.publicKey !== "string")
  )
    throw new Error(
      "A configuração de notificações não está disponível. Tente novamente."
    )
  const config = raw as { enabled: boolean; publicKey: string | null }
  if (!config.enabled)
    return {
      status: "unavailable",
      publicKey: null,
      message:
        "As notificações push estão desativadas pela organização. Você pode consultar o histórico em Avisos.",
    }
  if (!config.publicKey)
    return {
      status: "unavailable",
      publicKey: null,
      message:
        "Push ainda não está configurado. Você pode consultar o histórico em Avisos.",
    }
  if (
    !window.isSecureContext ||
    !("Notification" in window) ||
    !("PushManager" in window) ||
    !("serviceWorker" in navigator)
  )
    return {
      status: "unavailable",
      publicKey: config.publicKey,
      message:
        "Este navegador não oferece notificações push neste modo. Confira as orientações para seu dispositivo no Perfil. Os avisos continuam disponíveis na Pokédex.",
    }
  // A first-time user must not wait for service-worker activation to be allowed to opt in.
  if (Notification.permission === "default")
    return {
      status: "inactive",
      publicKey: config.publicKey,
      message:
        "Receba avisos do evento neste dispositivo, mesmo quando a Pokedex não estiver aberta.",
    }
  const registration =
    Notification.permission === "granted"
      ? await navigator.serviceWorker.getRegistration()
      : undefined
  const subscription = await registration?.pushManager.getSubscription()
  if (subscription && Notification.permission === "granted") {
    if (sync) await syncSubscription(subscription)
    return {
      status: "active",
      publicKey: config.publicKey,
      message: "Notificações ativadas neste dispositivo.",
    }
  }
  return {
    status: Notification.permission === "denied" ? "blocked" : "inactive",
    publicKey: config.publicKey,
    message:
      Notification.permission === "denied"
        ? "As notificações estão bloqueadas. Para ativar, altere a permissão nas configurações do navegador."
        : "Receba avisos do evento neste dispositivo, mesmo quando a Pokedex não estiver aberta.",
  }
}
export async function enablePushNotifications(publicKey: string) {
  // Keep this as the first browser operation: permission requires the user's click.
  const permission = await Notification.requestPermission()
  if (permission !== "granted")
    return {
      status:
        permission === "denied" ? ("blocked" as const) : ("inactive" as const),
      publicKey,
      message:
        permission === "denied"
          ? "As notificações foram bloqueadas. Você pode alterar a permissão nas configurações do navegador."
          : "Você pode ativar as notificações depois, no seu perfil.",
    }
  const registration = await waitForWorker()
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription)
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeKey(publicKey),
    })
  await syncSubscription(subscription)
  return {
    status: "active" as const,
    publicKey,
    message: "Notificações ativadas neste dispositivo.",
  }
}
export async function disablePushNotifications(publicKey: string) {
  const registration = await waitForWorker()
  const subscription = await registration.pushManager.getSubscription()
  if (subscription) {
    await syncSubscription(subscription, true)
    if (!(await subscription.unsubscribe()))
      throw new Error(
        "Não foi possível desativar no navegador. Tente novamente."
      )
  }
  return {
    status: "inactive" as const,
    publicKey,
    message: "Notificações desativadas neste dispositivo.",
  }
}
