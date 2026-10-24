"use server"

import { revalidatePath } from "next/cache"
import { ZodError } from "zod"

import { requireAuth } from "@/lib/require-auth"

import { discoverTagForSession } from "./tag.service"

export type DiscoverTagActionResult =
  | Readonly<{
      success: true
      code: "TAG_DISCOVERED" | "TAG_ALREADY_DISCOVERED"
      tagName: string
      tagDescription: string
      imageUrl: string
      xpAwarded: number
    }>
  | Readonly<{
      success: false
      code:
        | "INVALID_EVENT"
        | "INVALID_INPUT"
        | "PROFILE_INCOMPLETE"
        | "TAGS_DISABLED"
        | "TAG_INACTIVE"
        | "TAG_NOT_FOUND"
        | "UNEXPECTED_ERROR"
    }>

export async function discoverTagAction(
  input: unknown
): Promise<DiscoverTagActionResult> {
  const session = await requireAuth()

  try {
    const result = await discoverTagForSession(session, input)

    if (result.success) {
      revalidatePath("/tags")
      revalidatePath("/missions")
      revalidatePath("/passport")
    }

    return result
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, code: "INVALID_INPUT" }
    }

    console.error("Failed to complete tag discovery", error)

    return { success: false, code: "UNEXPECTED_ERROR" }
  }
}
