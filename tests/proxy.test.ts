import { type NextFetchEvent, NextRequest } from "next/server"
import type { Session } from "next-auth"
import { beforeEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ session: null as Session | null }))
vi.mock("@/lib/auth", () => ({
  auth:
    (
      handler: (
        request: NextRequest & { auth: Session | null },
        event: NextFetchEvent
      ) => unknown
    ) =>
    (request: NextRequest, event: NextFetchEvent) =>
      handler(Object.assign(request, { auth: mocks.session }), event),
}))
import { proxy } from "../proxy"
const event = {} as NextFetchEvent
beforeEach(() => {
  mocks.session = null
})
it("overwrites a client-supplied pathname before forwarding the request", async () => {
  const response = await proxy(
    new NextRequest("https://pokedex.example/missions", {
      headers: { "x-pokedex-pathname": "/sponsor/account" },
    }),
    event
  )
  expect(response?.headers.get("x-middleware-request-x-pokedex-pathname")).toBe(
    "/missions"
  )
})
it("preserves login redirects on previously protected routes", async () => {
  const response = await proxy(
    new NextRequest("https://pokedex.example/home"),
    event
  )
  const destination = new URL(response!.headers.get("location")!)
  expect(destination.pathname).toBe("/login")
  expect(destination.searchParams.get("callbackUrl")).toBe(
    "https://pokedex.example/home"
  )
})
it("forwards authenticated protected routes with the trusted pathname", async () => {
  mocks.session = { user: { id: "employee" } } as Session
  const response = await proxy(
    new NextRequest("https://pokedex.example/profile"),
    event
  )
  expect(response?.headers.get("x-middleware-request-x-pokedex-pathname")).toBe(
    "/profile"
  )
})
