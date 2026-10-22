"use client"

import {
  BookOpen,
  ClipboardList,
  House,
  type LucideIcon,
  ScanLine,
  Target,
  UserRound,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import type { AccessRole } from "@/modules/profile/profile.schema"

type NavigationItem = {
  href: string
  label: string
  icon: LucideIcon
  isScanner?: boolean
}

const navigationItems: NavigationItem[] = [
  { href: "/home", label: "Início", icon: House },
  { href: "/missions", label: "Missões", icon: Target },
  { href: "/scan", label: "Scanner", icon: ScanLine, isScanner: true },
  { href: "/passport", label: "Passaporte", icon: BookOpen },
  { href: "/profile", label: "Perfil", icon: UserRound },
]

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function BottomNavigation({
  accessRoles = ["participant"],
}: Readonly<{ accessRoles?: AccessRole[] }>) {
  const pathname = usePathname()
  const canOperate =
    accessRoles.includes("reviewer") || accessRoles.includes("admin")
  const sponsor = accessRoles[0] === "sponsor"
  const visibleNavigationItems = sponsor
    ? [
        { href: "/missions", label: "Validar missões", icon: Target },
        { href: "/sponsor/account", label: "Conta", icon: UserRound },
      ]
    : navigationItems.map((item) =>
        item.href === "/passport" && canOperate
          ? {
              ...item,
              href: "/operations",
              label: "Operações",
              icon: ClipboardList,
            }
          : item
      )

  return (
    <nav
      className="relative z-10 shrink-0 border-t border-border/70 bg-background/95 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-sm"
      aria-label="Navegação principal"
    >
      <ul
        className={cn(
          "grid items-end",
          sponsor ? "grid-cols-2" : "grid-cols-5"
        )}
      >
        {visibleNavigationItems.map(
          ({ href, label, icon: Icon, isScanner }) => {
            const isActive = isItemActive(pathname, href)

            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 flex-col items-center justify-end gap-1 rounded-xl px-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    isActive && "text-primary",
                    isScanner && "relative -mt-7"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center",
                      isScanner &&
                        "size-14 rounded-full bg-primary text-primary-foreground shadow-glow-primary ring-4 ring-background"
                    )}
                  >
                    <Icon
                      className={cn("size-5", isScanner && "size-6")}
                      aria-hidden="true"
                    />
                  </span>
                  <span>{label}</span>
                </Link>
              </li>
            )
          }
        )}
      </ul>
    </nav>
  )
}
