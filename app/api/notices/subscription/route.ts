import { NextResponse } from "next/server"

import { env } from "@/env"
import { auth } from "@/lib/auth"
import { isAllowedRequestOrigin } from "@/lib/http/request-origin"
import { updateSubscriptionForSession } from "@/modules/notices/notice.service"
import { isPushEnabled } from "@/modules/notices/push-config"

export async function GET() {
  const session = await auth()
  if (!session?.user)
    return NextResponse.json({ error: "Entre novamente" }, { status: 401 })
  return NextResponse.json(
    {
      enabled: isPushEnabled(),
      publicKey: isPushEnabled() ? process.env.VAPID_PUBLIC_KEY || null : null,
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
async function mutate(request: Request, remove: boolean) {
  if (!isAllowedRequestOrigin(request, env.NEXT_PUBLIC_APP_URL))
    return NextResponse.json({ error: "Origem inválida" }, { status: 403 })
  const session = await auth()
  if (!session?.user)
    return NextResponse.json({ error: "Entre novamente" }, { status: 401 })
  try {
    await updateSubscriptionForSession(session, await request.json(), remove)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: "Não foi possível atualizar a inscrição" },
      { status: 400 }
    )
  }
}
export async function POST(request: Request) {
  return mutate(request, false)
}
export async function DELETE(request: Request) {
  return mutate(request, true)
}
