"use server"

import { requireAuth } from "@/lib/require-auth"

import { resolveQrCodeUrl } from "./resolve-qr-code.service"

export async function resolveQrCodeAction(input: unknown) {
  await requireAuth()
  return resolveQrCodeUrl(input)
}
