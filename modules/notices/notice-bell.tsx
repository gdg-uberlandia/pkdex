"use client"

import { Bell } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

import { SeasonalNotificationDecoration } from "@/modules/seasonal-theme/seasonal-decorations"

export function NoticeBell() {
  const pathname = usePathname()
  const [count, setCount] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    async function refresh() {
      try {
        const response = await fetch("/api/notices/unread", {
          signal: controller.signal,
        })
        if (response.ok) {
          const data: { count: number } = await response.json()
          setCount(data.count)
        }
      } catch {
        /* Keep the shortcut available when the network is unavailable. */
      }
    }
    void refresh()
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh()
    }, 60000)
    window.addEventListener("focus", refresh)
    return () => {
      controller.abort()
      clearInterval(timer)
      window.removeEventListener("focus", refresh)
    }
  }, [pathname])
  return (
    <Link
      href="/notices"
      aria-label={count ? `Avisos: ${count} não lidos` : "Avisos"}
      className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="relative">
        <Bell className="size-5" aria-hidden="true" />
        <SeasonalNotificationDecoration />
      </span>
      {count > 0 && (
        <span className="absolute top-0 right-0 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  )
}
