import { hasPermission } from "@/modules/profile/profile.authorization"
import type { AccessRole } from "@/modules/profile/profile.schema"

type RouteLayout = {
  title: string
  showHeader?: boolean
  showNavigation: boolean
  backHref?: string
  theme?: "light" | "dark"
}

const routeLayouts: Record<string, RouteLayout> = {
  "/notifications/enable": {
    title: "Permitir notificações",
    showHeader: false,
    showNavigation: false,
  },
  "/notices": {
    title: "Avisos",
    showHeader: true,
    showNavigation: false,
    backHref: "/home",
  },
  "/home": {
    title: "Início",
    showNavigation: true,
  },
  "/missions": {
    title: "Missões",
    showHeader: true,
    backHref: "/home",
    showNavigation: false,
  },
  "/scan": {
    title: "Scanner",
    showNavigation: true,
    theme: "dark",
  },
  "/passport": {
    title: "Passaporte",
    showHeader: true,
    showNavigation: false,
    backHref: "/home",
  },
  "/ranking": {
    title: "Ranking",
    showHeader: true,
    showNavigation: false,
    backHref: "/home",
  },
  "/tickets": {
    title: "Tickets",
    showHeader: true,
    showNavigation: false,
    backHref: "/home",
  },
  "/schedule": {
    title: "Programação",
    showHeader: true,
    showNavigation: false,
    backHref: "/home",
  },
  "/talks": {
    title: "Palestras",
    showHeader: true,
    showNavigation: false,
    backHref: "/home",
  },
  "/operations": {
    title: "Operações",
    showNavigation: true,
  },
  "/operations/talks": {
    title: "Avaliações de palestras",
    showHeader: true,
    showNavigation: false,
    backHref: "/operations",
  },
  "/profile": {
    title: "Perfil",
    showNavigation: true,
  },
  "/profile/edit": {
    title: "Editar perfil",
    showHeader: true,
    showNavigation: false,
    backHref: "/profile",
    theme: "dark",
  },
  "/profile/qr-code": {
    title: "Meu QR Code",
    showHeader: true,
    showNavigation: false,
    backHref: "/profile",
    theme: "dark",
  },
  "/connections": {
    title: "Conexões",
    showHeader: true,
    showNavigation: false,
    backHref: "/home",
  },
  "/companies": {
    title: "Empresas",
    showHeader: true,
    showNavigation: false,
    backHref: "/home",
  },
  "/tags": {
    title: "Tags",
    showHeader: true,
    showNavigation: false,
    backHref: "/home",
  },
}

const fallbackLayout: RouteLayout = {
  title: "DevFest",
  showHeader: true,
  showNavigation: false,
  backHref: "/home",
}

export function getRouteLayout(
  pathname: string,
  source: string | null,
  accessRoles: AccessRole[]
): RouteLayout {
  const routeLayout =
    routeLayouts[pathname] ??
    (pathname.startsWith("/notices/")
      ? {
          title: "Aviso",
          showHeader: true,
          showNavigation: false,
          backHref: "/notices",
        }
      : undefined) ??
    (pathname === "/operations/scan"
      ? {
          title: "Atender participante",
          showHeader: true,
          showNavigation: false,
          backHref: "/operations",
          theme: "dark" as const,
        }
      : pathname.startsWith("/operations/participant/")
        ? {
            title: "Atendimento",
            showHeader: true,
            showNavigation: false,
            backHref: "/operations",
          }
        : pathname.startsWith("/missions/review/")
          ? {
              title: "Validar missão",
              showHeader: true,
              showNavigation: false,
              backHref: "/missions",
              theme: "dark" as const,
            }
          : pathname.startsWith("/connections/")
            ? {
                title: "Perfil da conexão",
                showHeader: true,
                showNavigation: false,
                backHref: "/connections",
              }
            : pathname.startsWith("/companies/")
              ? {
                  title: "Empresa",
                  showHeader: true,
                  showNavigation: false,
                  backHref: "/companies",
                }
              : pathname.startsWith("/talks/")
                ? {
                    title: "Palestra",
                    showHeader: true,
                    showNavigation: false,
                    backHref: "/talks",
                  }
                : fallbackLayout)
  const qrCodeSource = pathname === "/profile/qr-code" ? source : null
  const backHref =
    qrCodeSource === "home"
      ? "/home"
      : qrCodeSource === "missions"
        ? "/missions"
        : pathname === "/missions" &&
            hasPermission({ accessRoles }, "serve-participants")
          ? "/operations"
          : routeLayout.backHref

  return { ...routeLayout, backHref }
}
