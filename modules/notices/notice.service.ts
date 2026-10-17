import "server-only"

import type { Session } from "next-auth"

import { requireProfileForSession } from "@/modules/profile/profile.service"

import {
  countUnreadNotices,
  findNotice,
  listNotices,
  markNoticeRead,
  removeSubscription,
  saveSubscription,
} from "./notice.repository"
import { noticeIdSchema } from "./notice.schema"
import { isPushEnabled } from "./push-config"

export async function getNoticesForSession(session: Session) {
  const profile = await requireProfileForSession(session)
  return listNotices(profile.eventId, profile.userId)
}
export async function getNoticeForSession(session: Session, input: unknown) {
  const id = noticeIdSchema.parse(input)
  const profile = await requireProfileForSession(session)
  return findNotice(profile.eventId, id)
}
export async function readNoticeForSession(session: Session, input: unknown) {
  const id = noticeIdSchema.parse(input)
  const profile = await requireProfileForSession(session)
  await markNoticeRead(profile.eventId, profile.userId, id)
}
export async function updateSubscriptionForSession(
  session: Session,
  input: unknown,
  remove = false
) {
  if (!remove && !isPushEnabled()) throw new Error("Push desativado")
  const profile = await requireProfileForSession(session)
  if (!profile.onboardingCompleted)
    throw new Error("Conclua seu perfil primeiro")
  return remove
    ? removeSubscription(profile.eventId, profile.userId, input)
    : saveSubscription(profile.eventId, profile.userId, input)
}

export async function getUnreadCountForSession(session: Session) {
  const profile = await requireProfileForSession(session)
  return countUnreadNotices(profile.eventId, profile.userId)
}
