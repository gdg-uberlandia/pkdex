"use client"

import { useEffect, useRef, useState } from "react"

import {
  disablePushNotifications,
  enablePushNotifications,
  INITIAL_PUSH_STATE,
  loadPushState,
  type PushState,
} from "./push-client"

export function usePushNotifications() {
  const [state, setState] = useState<PushState>(INITIAL_PUSH_STATE)
  const [busy, setBusy] = useState(false)
  const updating = useRef(false)
  const generation = useRef(0)
  const retry = useRef<() => Promise<void>>(async () => {})
  useEffect(() => {
    let active = true
    async function refresh(sync: boolean) {
      if (updating.current) return
      const current = ++generation.current
      try {
        const next = await loadPushState(sync)
        if (active && current === generation.current) setState(next)
      } catch (error) {
        if (active && current === generation.current)
          setState({
            status: "error",
            publicKey: null,
            message:
              error instanceof Error
                ? error.message
                : "Não foi possível verificar as notificações. Tente novamente.",
          })
      }
    }
    retry.current = async () => {
      setState(INITIAL_PUSH_STATE)
      await refresh(false)
    }
    void refresh(true)
    const onFocus = () => void refresh(false)
    window.addEventListener("focus", onFocus)
    return () => {
      active = false
      window.removeEventListener("focus", onFocus)
    }
  }, [])
  async function update(enable: boolean) {
    if (!state.publicKey || updating.current) return false
    updating.current = true
    generation.current++
    setBusy(true)
    try {
      const next = await (enable
        ? enablePushNotifications(state.publicKey)
        : disablePushNotifications(state.publicKey))
      setState(next)
      return next.status === "active"
    } catch (error) {
      setState((previous) => ({
        ...previous,
        status: previous.status === "active" ? "active" : "error",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar as notificações.",
      }))
      return false
    } finally {
      updating.current = false
      setBusy(false)
    }
  }
  return {
    ...state,
    busy,
    canEnable:
      Boolean(state.publicKey) &&
      (state.status === "inactive" || state.status === "error"),
    enable: () => update(true),
    disable: () => update(false),
    retry: () => retry.current(),
  }
}
