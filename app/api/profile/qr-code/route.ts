import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import {
  issueUserQrCode,
  SponsorQrForbiddenError,
} from "@/modules/qr-code/user-qr-code.service"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      {
        code: "UNAUTHORIZED",
        message: "Faça login para gerar seu QR Code.",
      },
      { status: 401 }
    )
  }

  try {
    const qrCode = await issueUserQrCode(session)

    return NextResponse.json(qrCode, {
      headers: {
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    if (error instanceof SponsorQrForbiddenError)
      return NextResponse.json(
        {
          code: "FORBIDDEN",
          message:
            "Esta conta possui acesso somente à validação de missões da empresa.",
        },
        { status: 403 }
      )
    console.error("Failed to issue authenticated user QR Code", error)

    return NextResponse.json(
      {
        code: "QR_GENERATION_FAILED",
        message: "Não foi possível gerar o QR Code.",
      },
      { status: 500 }
    )
  }
}
