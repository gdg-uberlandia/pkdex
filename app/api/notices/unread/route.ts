import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { getUnreadCountForSession } from "@/modules/notices/notice.service"

export async function GET() {
  const session = await auth()
  if (!session?.user)
    return NextResponse.json({ error: "Entre novamente" }, { status: 401 })
  const count = await getUnreadCountForSession(session)
  return NextResponse.json(
    { count },
    { headers: { "Cache-Control": "no-store" } }
  )
}
