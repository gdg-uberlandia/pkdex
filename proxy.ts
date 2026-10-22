import {
  type NextFetchEvent,
  type NextRequest,
  NextResponse,
} from "next/server"

import { auth } from "@/lib/auth"

function withPathname(request: NextRequest) {
  const headers = new Headers(request.headers)
  headers.set("x-pokedex-pathname", request.nextUrl.pathname)
  return NextResponse.next({ request: { headers } })
}

const protectedProxy = auth((request, _event: NextFetchEvent) => {
  if (!request.auth?.user) {
    const destination = new URL("/login", request.url)
    destination.searchParams.set("callbackUrl", request.url)
    return NextResponse.redirect(destination)
  }
  return withPathname(request)
})

export function proxy(request: NextRequest, event: NextFetchEvent) {
  const pathname = request.nextUrl.pathname
  if (
    ["/home", "/onboarding", "/profile"].some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    )
  )
    return protectedProxy(request, event)
  return withPathname(request)
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images|manifest.webmanifest|sw.js).*)",
  ],
}
