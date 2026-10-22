"use server"

import { revalidatePath } from "next/cache"

import { requireAuth } from "@/lib/require-auth"

import {
  readAllNoticesForSession,
  readNoticeForSession,
} from "./notice.service"

export async function markNoticeReadAction(id: string) {
  const session = await requireAuth()
  try {
    await readNoticeForSession(session, id)
    revalidatePath("/notices")
    return { success: true }
  } catch {
    return { success: false }
  }
}

export async function markAllNoticesReadAction() {
  const session = await requireAuth()
  try {
    await readAllNoticesForSession(session)
    revalidatePath("/notices")
    return { success: true }
  } catch {
    return { success: false }
  }
}
