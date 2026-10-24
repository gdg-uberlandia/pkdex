"use client"

import { usePathname, useSearchParams } from "next/navigation"
import type { ReactNode } from "react"

import { Toaster } from "@/components/ui/sonner"
import { IS_HALLOWEEN } from "@/config/seasonal-theme"
import { cn } from "@/lib/utils"
import { NoticeBell } from "@/modules/notices/notice-bell"
import type { AccessRole } from "@/modules/profile/profile.schema"
import halloweenStyles from "@/modules/seasonal-theme/halloween.module.css"
import {
  SeasonalNavigation,
  SeasonalPageDecorations,
  SeasonalPageFooter,
} from "@/modules/seasonal-theme/seasonal-decorations"

import { AppHeader } from "./app-header"
import { AppShell } from "./app-shell"
import { BottomNavigation } from "./bottom-navigation"
import { getRouteLayout, isScannerRoute } from "./route-layout"

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

  const scanner = isScannerRoute(pathname)

  return (
    <>
      <Toaster position="top-center" richColors />
      <AppShell
        className={IS_HALLOWEEN ? halloweenStyles.shell : undefined}
        contentClassName={cn(
          IS_HALLOWEEN && halloweenStyles.content,
          scanner && "flex flex-col overflow-hidden",
          scanner && routeLayout.showNavigation && "pb-8"
        )}
        header={
          routeLayout.showHeader ? (
            <AppHeader
              title={routeLayout.title}
              actions={
                accessRoles[0] === "sponsor" ? undefined : <NoticeBell />
              }
              showBack={Boolean(routeLayout.backHref)}
              backHref={routeLayout.backHref}
            />
          ) : undefined
        }
        navigation={
          routeLayout.showNavigation ? (
            <SeasonalNavigation>
              <BottomNavigation accessRoles={accessRoles} />
            </SeasonalNavigation>
          ) : undefined
        }
        theme={routeLayout.theme}
      >
        {!scanner && <SeasonalPageDecorations />}
        {children}
        {!scanner && <SeasonalPageFooter />}
      </AppShell>
    </>
  )
}
