"use client"

import { usePathname, useSearchParams } from "next/navigation"
import type { ReactNode } from "react"

import { Toaster } from "@/components/ui/sonner"
import { NoticeBell } from "@/modules/notices/notice-bell"
import type { AccessRole } from "@/modules/profile/profile.schema"

import { AppHeader } from "./app-header"
import { AppShell } from "./app-shell"
import { BottomNavigation } from "./bottom-navigation"
import { getRouteLayout } from "./route-layout"

export function AuthenticatedAppShell({
  children,
  accessRoles,
}: Readonly<{ children: ReactNode; accessRoles: AccessRole[] }>) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const routeLayout = getRouteLayout(
    pathname,
    searchParams.get("source"),
    accessRoles
  )

  return (
    <>
      <Toaster position="top-center" />
      <AppShell
        header={
          routeLayout.showHeader ? (
            <AppHeader
              title={routeLayout.title}
              actions={<NoticeBell />}
              showBack={Boolean(routeLayout.backHref)}
              backHref={routeLayout.backHref}
            />
          ) : undefined
        }
        navigation={
          routeLayout.showNavigation ? (
            <BottomNavigation accessRoles={accessRoles} />
          ) : undefined
        }
        theme={routeLayout.theme}
      >
        {children}
      </AppShell>
    </>
  )
}
