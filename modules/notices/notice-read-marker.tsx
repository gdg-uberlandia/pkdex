"use client"

import { useEffect, useState } from "react"

import { markNoticeReadAction } from "./notice.actions"

export function NoticeReadMarker({ id }: { id: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    void markNoticeReadAction(id)
      .then((result) => {
        setFailed(!result.success)
        if (result.success) window.dispatchEvent(new Event("focus"))
      })
      .catch(() => setFailed(true))
  }, [id])
  return failed ? (
    <p role="status" className="text-sm text-muted-foreground">
      Não foi possível marcar como lido. Reabra o aviso para tentar novamente.
    </p>
  ) : null
}
