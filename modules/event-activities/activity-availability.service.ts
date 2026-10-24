import "server-only"

import type { Session } from "next-auth"

import { hasPermission } from "@/modules/profile/profile.authorization"
import { requireProfileForSession } from "@/modules/profile/profile.service"

import { setActivityAvailability } from "./activity-availability.repository"
import type { ActivityService } from "./activity-availability.schema"

export async function updateActivityAvailabilityForSession(
  session: Session,
  service: ActivityService,
  enabled: boolean
) {
  const profile = await requireProfileForSession(session)
  if (!hasPermission(profile, "manage-event-operations")) return false
  return setActivityAvailability(
    profile.eventId,
    service,
    enabled,
    profile.userId
  )
}
